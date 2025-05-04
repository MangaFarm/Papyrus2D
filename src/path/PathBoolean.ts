/**
 * PathBoolean: Boolean演算クラス
 * paper.jsのPathItem.Boolean.jsを参考に実装
 */

import { Path } from './Path';
import { Segment } from './Segment';
import { Point } from '../basic/Point';
import { Curve } from './Curve';
import { Numerical } from '../util/Numerical';
import { CompoundPath } from './CompoundPath';
import { PathItem } from './PathItem';
import { CurveLocation } from './CurveLocation';
import { reorientPaths } from './PathBooleanReorient';
import { CollisionDetection } from '../util/CollisionDetection';
import { preparePath } from './PathBooleanPreparation';
import { CurveCalculation } from './CurveCalculation';
import { CurveSubdivision } from './CurveSubdivision';
import { CurveGeometry } from './CurveGeometry';
import { tracePaths } from './PathBooleanTracePaths';

/**
 * 交点情報
 */
/**
 * 交点情報
 */
export interface Intersection {
  // 交点の座標
  point: Point;
  // 交点のパス1上のカーブインデックス
  curve1Index: number;
  // 交点のパス2上のカーブインデックス
  curve2Index: number;
  // 交点のパス1上のカーブパラメータ
  t1?: number | null;
  // 交点のパス2上のカーブパラメータ
  t2?: number | null;
  // 交点の種類（entry/exit）
  type?: 'entry' | 'exit';
  // 交点のwinding number
  winding?: number;
  // 交点の処理済みフラグ
  visited?: boolean;
  // 次の交点への参照（リンクリスト構造）
  next?: Intersection;
  // 前の交点への参照（リンクリスト構造）
  prev?: Intersection;
  // 交点のセグメント
  segment?: Segment;
  // 交点が重なりかどうか
  _overlap?: boolean;
}

/**
 * セグメント拡張情報
 * paper.jsのSegmentクラスに追加されるプロパティを定義
 */
interface SegmentInfo {
  // セグメントが訪問済みかどうか
  _visited?: boolean;
  // セグメントの交点情報
  _intersection?: Intersection | null;
  // セグメントのwinding情報
  _winding?: {
    winding: number;
    windingL?: number;
    windingR?: number;
  };
  // セグメントのパス
  _path?: Path & {
    _overlapsOnly?: boolean;
    _closed?: boolean;
    _id?: number;
    compare?: (path: Path) => boolean;
  };
}

// 型安全性のためのヘルパー関数
// 注意: paper.jsとの互換性のため、型キャストを使用
function asSegmentInfo(segment: Segment | null | undefined): Segment & SegmentInfo | null | undefined {
  return segment as (Segment & SegmentInfo) | null | undefined;
}

/**
 * Boolean演算クラス
 */
export class PathBoolean {
  /**
   * 2つのパスの交点を計算
   * paper.jsのfilterIntersection関数を参考に実装
   */
  private static getIntersections(path1: Path, path2: Path): Intersection[] {
    // 交差点と重なりを区別するフィルター関数
    function filterIntersection(inter: CurveLocation): boolean {
      // 重なりまたは交差のみを返す
      return inter.hasOverlap() || inter.isCrossing();
    }
    
    // 交点計算（フィルター関数を使用）
    const rawIntersections = path1.getIntersections(path2, filterIntersection);
    
    // Intersection型に変換
    const intersections: Intersection[] = [];
    
    for (const loc of rawIntersections) {
      // 交点情報を抽出
      const point = loc.getPoint();
      const curve = loc.getCurve();
      const curveIndex = curve ? path1.getCurves().indexOf(curve) : 0;
      
      // 交差するカーブの情報
      const intersection = loc.getIntersection();
      const otherCurve = intersection ? intersection.getCurve() : null;
      const otherCurveIndex = otherCurve ? path2.getCurves().indexOf(otherCurve) : 0;
      
      // 交点情報を作成
      intersections.push({
        point,
        curve1Index: curveIndex,
        curve2Index: otherCurveIndex,
        t1: loc.getTime(),
        t2: intersection ? intersection.getTime() : null,
        visited: false
      });
    }
    
    // 交点をソート（curve1Index, t1の順）
    intersections.sort((a, b) => {
      if (a.curve1Index !== b.curve1Index) {
        return a.curve1Index - b.curve1Index;
      }
      // t1がnullの場合は0として扱う
      const t1A = a.t1 ?? 0;
      const t1B = b.t1 ?? 0;
      return t1A - t1B;
    });
    
    return intersections;
  }

  /**
   * 交点でパスを分割
   */
  private static dividePathAtIntersections(path: Path, intersections: Intersection[]): Path {
    if (intersections.length === 0) return path;
    
    // 交点でパスを分割
    const curves = path.getCurves();
    const segments: Segment[] = [];
    
    // 各カーブについて処理
    for (let i = 0; i < curves.length; i++) {
      const curve = curves[i];
      const curveIntersections = intersections.filter(inter => inter.curve1Index === i);
      
      // カーブの開始点を追加
      segments.push(curve._segment1);
      
      // 交点をt値でソート
      curveIntersections.sort((a, b) => (a.t1 ?? 0) - (b.t1 ?? 0));
      
      // 各交点でカーブを分割
      for (const intersection of curveIntersections) {
        const t = intersection.t1 ?? 0;
        if (t > Numerical.CURVETIME_EPSILON && t < 1 - Numerical.CURVETIME_EPSILON) {
          // カーブを分割して新しいセグメントを作成
          const result = curve.divideAtTime(t);
          
          // divideAtTimeの戻り値がCurveの場合
          if (result && typeof result === 'object' && 'getPoint' in result) {
            // 新しいセグメントを取得
            const newCurve = result as Curve;
            const newSegment = newCurve._segment1;
            
            segments.push(newSegment);
            
            // 交点情報にセグメントを関連付け
            intersection.segment = newSegment;
          }
        }
      }
    }
    
    // 新しいパスを作成
    const newPath = new Path(segments, path.isClosed());
    return newPath;
  }

  /**
   * winding numberを伝播する
   * paper.jsのpropagateWinding関数を移植
   */
  private static propagateWinding(
    segment: Segment,
    path1: Path,
    path2: Path | null,
    curveCollisionsMap: Record<string, Record<number, { hor: Curve[]; ver: Curve[] }>>,
    operator: Record<string, boolean>
  ): void {
    // セグメントから始まる曲線チェーンを追跡
    const chain: { segment: Segment; curve: Curve; length: number }[] = [];
    let start = segment;
    let totalLength = 0;
    
    // 交点または始点に戻るまで曲線チェーンを構築
    do {
      const curve = segment.getCurve();
      if (curve) {
        const length = curve.getLength();
        chain.push({ segment, curve, length });
        totalLength += length;
      }
      segment = segment.getNext() || segment;
    } while (segment && !(segment as any)._intersection && segment !== start);
    
    // チェーン上の3点でwinding numberを計算
    const offsets = [0.5, 0.25, 0.75];
    let windingResult = { winding: 0, quality: -1, windingL: 0, windingR: 0, onPath: false };
    const tMin = 1e-3;
    const tMax = 1 - tMin;
    
    // 十分な品質のwinding numberが見つかるまで計算
    for (let i = 0; i < offsets.length && windingResult.quality < 0.5; i++) {
      const length = totalLength * offsets[i];
      let chainLength = 0;
      
      for (let j = 0, l = chain.length; j < l; j++) {
        const entry = chain[j];
        const curveLength = entry.length;
        
        if (length <= chainLength + curveLength) {
          // 曲線上の点を計算
          const curve = entry.curve;
          const path = curve._path;
          const parent = path._parent;
          const operand = parent instanceof CompoundPath ? parent : path;
          const t = Numerical.clamp((length - chainLength) / curveLength, tMin, tMax);
          const pt = curve.getPointAtTime(t);
          
          // 接線の方向に基づいて、水平または垂直方向を決定
          const tangent = curve.getTangentAtTime(t);
          const dir = Math.abs(tangent.y) < Math.SQRT1_2;
          
          // 減算演算の場合の特殊処理
          let wind: { winding: number; windingL: number; windingR: number; quality: number; onPath: boolean } | null = null;
          if (operator.subtract && path2) {
            const otherPath = operand === path1 ? path2 : path1;
            // getWindingを使用して計算
            const pathWinding = this.getWinding(pt, otherPath.getCurves(), dir, true);
            
            // 曲線を省略すべきかチェック
            if ((operand === path1 && pathWinding.winding) ||
                (operand === path2 && !pathWinding.winding)) {
              if (pathWinding.quality < 1) {
                continue;
              } else {
                wind = { winding: 0, windingL: 0, windingR: 0, quality: 1, onPath: false };
              }
            }
          }
          
          // winding numberを計算
          wind = wind || this.getWinding(
            pt,
            curveCollisionsMap[path._id][curve.getIndex()],
            dir,
            true
          );
          
          // より高品質なwinding numberを採用
          if (wind.quality > windingResult.quality) {
            windingResult = wind;
          }
          
          break;
        }
        
        chainLength += curveLength;
      }
    }
    
    // 曲線チェーン全体にwinding numberを割り当て
    for (let j = chain.length - 1; j >= 0; j--) {
      const segmentInfo = asSegmentInfo(chain[j].segment);
      if (segmentInfo) {
        segmentInfo._winding = windingResult;
      }
    }
  }

  /**
   * 指定した点でのwinding numberを計算
   * paper.jsのgetWinding関数を移植
   */
  private static getWinding(
    point: Point,
    curves: Curve[] | { hor: Curve[]; ver: Curve[] },
    dir: boolean = false,
    closed: boolean = false,
    dontFlip: boolean = false
  ): { winding: number; windingL: number; windingR: number; quality: number; onPath: boolean } {
    const min = Math.min;
    const max = Math.max;
    const abs = Math.abs;
    
    // 曲線リストを取得
    const curvesList = Array.isArray(curves)
      ? curves
      : curves[dir ? 'hor' : 'ver'];
    
    // 座標インデックスを設定
    const ia = dir ? 1 : 0; // 横座標インデックス
    const io = ia ^ 1;      // 縦座標インデックス
    const pv = [point.x, point.y];
    const pa = pv[ia];      // 点の横座標
    const po = pv[io];      // 点の縦座標
    
    // winding計算用のイプシロン
    const windingEpsilon = 1e-9;
    const qualityEpsilon = 1e-6;
    const paL = pa - windingEpsilon;
    const paR = pa + windingEpsilon;
    
    let windingL = 0;
    let windingR = 0;
    let pathWindingL = 0;
    let pathWindingR = 0;
    let onPath = false;
    let onAnyPath = false;
    let quality = 1;
    const roots: number[] = [];
    let vPrev: number[] | undefined;
    let vClose: number[] | undefined;
    
    // windingを追加する関数
    function addWinding(v: number[]): any {
      const o0 = v[io + 0];
      const o3 = v[io + 6];
      
      // 点が曲線の縦座標範囲外なら処理しない
      if (po < min(o0, o3) || po > max(o0, o3)) {
        return;
      }
      
      const a0 = v[ia + 0];
      const a1 = v[ia + 2];
      const a2 = v[ia + 4];
      const a3 = v[ia + 6];
      
      // 水平曲線の特殊処理
      if (o0 === o3) {
        if ((a0 < paR && a3 > paL) || (a3 < paR && a0 > paL)) {
          onPath = true;
        }
        return;
      }
      
      // 曲線上の時間パラメータを計算
      let t: number;
      if (po === o0) {
        t = 0;
      } else if (po === o3) {
        t = 1;
      } else if (paL > max(a0, a1, a2, a3) || paR < min(a0, a1, a2, a3)) {
        t = 1;
      } else {
        const count = Numerical.solveCubic(v[0], v[1], v[2], v[3], roots, { min: 0, max: 1 });
        t = count === 1 ? roots[0] : 1;
      }
      
      // 曲線上の点の横座標を計算
      let a: number;
      if (t === 0) {
        a = a0;
      } else if (t === 1) {
        a = a3;
      } else {
        const p = CurveCalculation.getPoint(v, t);
        a = p ? p[dir ? 'y' : 'x'] : 0;
      }
      
      // winding方向を決定
      const winding = o0 > o3 ? 1 : -1;
      const windingPrev = vPrev ? (vPrev[io] > vPrev[io + 6] ? 1 : -1) : 0;
      const a3Prev = vPrev ? vPrev[ia + 6] : 0;
      
      // 曲線の始点でない場合の処理
      if (po !== o0) {
        // 標準的なケース
        if (a < paL) {
          pathWindingL += winding;
        } else if (a > paR) {
          pathWindingR += winding;
        } else {
          onPath = true;
        }
        
        // 精度を下げる（点が曲線に非常に近い場合）
        if (a > pa - qualityEpsilon && a < pa + qualityEpsilon) {
          quality /= 2;
        }
      } else {
        // 曲線の始点での処理
        if (winding !== windingPrev) {
          // 前の曲線からwinding方向が変わった場合
          if (a0 < paL) {
            pathWindingL += winding;
          } else if (a0 > paR) {
            pathWindingR += winding;
          }
        } else if (a0 !== a3Prev) {
          // 水平曲線の特殊処理
          if (a3Prev < paR && a > paR) {
            pathWindingR += winding;
            onPath = true;
          } else if (a3Prev > paL && a < paL) {
            pathWindingL += winding;
            onPath = true;
          }
        }
        quality /= 4;
      }
      
      vPrev = v;
      
      // 接線が方向に平行な場合、方向を反転して再計算
      if (!dontFlip && a > paL && a < paR) {
        const tangent = CurveCalculation.getTangent(v, t);
        if (tangent && tangent[dir ? 'x' : 'y'] === 0) {
          return PathBoolean.getWinding(point, curves, !dir, closed, true);
        }
      }
    }
    
    // 曲線を処理する関数
    function handleCurve(v: number[]): any {
      // 縦座標を取得
      const o0 = v[io + 0];
      const o1 = v[io + 2];
      const o2 = v[io + 4];
      const o3 = v[io + 6];
      
      // 点の縦座標が曲線の範囲内にある場合のみ処理
      if (po <= max(o0, o1, o2, o3) && po >= min(o0, o1, o2, o3)) {
        // 横座標を取得
        const a0 = v[ia + 0];
        const a1 = v[ia + 2];
        const a2 = v[ia + 4];
        const a3 = v[ia + 6];
        
        // 単調曲線を取得
        const monoCurves = paL > max(a0, a1, a2, a3) || paR < min(a0, a1, a2, a3)
          ? [v]
          : CurveSubdivision.getMonoCurves(v);
        
        // 各単調曲線に対してwinding計算
        for (let i = 0, l = monoCurves.length; i < l; i++) {
          const res = addWinding(monoCurves[i]);
          if (res) return res;
        }
      }
    }
    
    // 各曲線に対して処理
    for (let i = 0, l = curvesList.length; i < l; i++) {
      const curve = curvesList[i];
      const path = curve._path;
      const v = curve.getValues();
      let res;
      
      // 新しいパスの開始時の処理
      if (!i || curvesList[i - 1]._path !== path) {
        vPrev = undefined;
        
        // パスが閉じていない場合、最初と最後のセグメントを接続
        if (!path._closed) {
          vClose = CurveSubdivision.getValues(
            path.getLastCurve()._segment2,
            curve._segment1,
            null,
            !closed
          );
          
          // この閉じる曲線が水平でない場合、前の曲線として使用
          if (vClose[io] !== vClose[io + 6]) {
            vPrev = vClose;
          }
        }
        
        // 前の曲線が見つからない場合、パスの最後から水平でない曲線を探す
        if (!vPrev) {
          vPrev = v;
          let prev = path.getLastCurve();
          while (prev && prev !== curve) {
            const v2 = prev.getValues();
            if (v2[io] !== v2[io + 6]) {
              vPrev = v2;
              break;
            }
            prev = prev.getPrevious();
          }
        }
      }
      
      // 曲線を処理
      if ((res = handleCurve(v))) {
        return res;
      }
      
      // パスの最後の曲線の処理
      if (i + 1 === l || curvesList[i + 1]._path !== path) {
        // 閉じる曲線がある場合は処理
        if (vClose && (res = handleCurve(vClose))) {
          return res;
        }
        
        // パス上にあり、windingが相殺された場合の処理
        if (onPath && !pathWindingL && !pathWindingR) {
          pathWindingL = pathWindingR = path.isClockwise(closed) !== dir ? 1 : -1;
        }
        
        // パスのwindingを合計に追加
        windingL += pathWindingL;
        windingR += pathWindingR;
        pathWindingL = pathWindingR = 0;
        
        if (onPath) {
          onAnyPath = true;
          onPath = false;
        }
        
        vClose = undefined;
      }
    }
    
    // 符号なしのwinding値を使用
    windingL = abs(windingL);
    windingR = abs(windingR);
    
    // 計算結果を返す
    return {
      winding: max(windingL, windingR),
      windingL: windingL,
      windingR: windingR,
      quality: quality,
      onPath: onAnyPath
    };
  }

  /**
   * 交点情報をリンクリストとして連結する
   * paper.jsのlinkIntersections関数を移植
   */
  private static linkIntersections(from: Intersection, to: Intersection): void {
    // 既存のチェーンに既にtoが含まれていないか確認
    let prev = from;
    while (prev) {
      if (prev === to) return;
      prev = prev.prev!;
    }

    // 既存のチェーンの末尾を探す
    while (from.next && from.next !== to) {
      from = from.next;
    }

    // チェーンの末尾に到達したら、toを連結
    if (!from.next) {
      // toのチェーンの先頭に移動
      let toStart = to;
      while (toStart.prev) {
        toStart = toStart.prev;
      }
      from.next = toStart;
      toStart.prev = from;
    }
  }

  /**
   * カーブのハンドルをクリア
   * paper.jsのclearCurveHandlesメソッドを移植
   */
  private static clearCurveHandles(curves: Curve[]): void {
    // 各カーブのセグメントのハンドルをクリア
    for (let i = curves.length - 1; i >= 0; i--) {
      const curve = curves[i];
      if (curve._segment1) curve._segment1.clearHandles();
      if (curve._segment2) curve._segment2.clearHandles();
    }
  }


  /**
   * 交点がない場合のパス処理
   */
  private static handleNoIntersections(
    path1: Path,
    path2: Path,
    operation: 'unite' | 'intersect' | 'subtract' | 'exclude' | 'divide'
  ): Path[] {
    // getInteriorPointメソッドが存在するか確認するヘルパー関数
    const getInteriorPoint = (path: PathItem): Point => {
      if ('getInteriorPoint' in path && typeof (path as any).getInteriorPoint === 'function') {
        return (path as any).getInteriorPoint();
      }
      // フォールバック: バウンディングボックスの中心を使用
      const bounds = path.getBounds();
      return new Point(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    };
    
    // 演算子に応じたフィルタ関数を定義
    const operators: Record<string, Record<string, boolean>> = {
      'unite':     { '1': true, '2': true },
      'intersect': { '2': true },
      'subtract':  { '1': true },
      'exclude':   { '1': true, '-1': true }
    };
    
    // 現在の演算に対応するフィルタ関数
    const operator = operators[operation];
    
    // paper.jsと同様に、operatorにoperationプロパティを追加
    operator[operation] = true;
    
    // path2の処理
    if (path1 === path2) {
      return [path1];
    }
    
    // reorientPathsを使用して結果を決定
    return reorientPaths(
      path2 ? [path1, path2] : [path1],
      (w: number) => !!operator[w]
    );
  }
  
  /**
   * 結果Path構築と重複統合
   * paper.jsのcreateResult関数を忠実に移植
   */
  static createResult(
    paths: Path[],
    simplify: boolean,
    path1: PathItem,
    path2?: PathItem,
    options?: { insert?: boolean }
  ): PathItem {
    // パスの配列が空の場合のフォールバック処理
    if (paths.length === 0) {
      console.log('DEBUG: createResult received empty paths array, creating empty path');
      
      // paper.jsの実装に合わせて、空のパスを作成
      const emptyPath = new Path();
      
      // path1の属性をコピー
      if (path1 && emptyPath.copyAttributes) {
        emptyPath.copyAttributes(path1, true);
      }
      
      // 挿入オプションが明示的にfalseでない場合、結果を挿入
      if (!(options && options.insert === false)) {
        if (path1 && emptyPath.insertAbove) {
          emptyPath.insertAbove(path1);
        }
      }
      
      return emptyPath;
    }
    
    // 結果のCompoundPathを作成
    const result = new CompoundPath();
    
    // パスを追加
    result.addChildren(paths);
    
    // パスを簡略化（reduce相当の処理）
    const simplified = result.reduce({ simplify });
    
    // 挿入オプションが明示的にfalseでない場合、結果を挿入
    if (!(options && options.insert === false)) {
      // path1とpath2が存在し、兄弟関係にある場合、
      // path1のインデックスがpath2より小さければpath2の上に、
      // そうでなければpath1の上に挿入
      if (path2 && path1 && path1.isSibling && path2.isSibling &&
          path1.isSibling(path2) &&
          path1.getIndex && path2.getIndex &&
          path1.getIndex() < path2.getIndex()) {
        if (simplified.insertAbove) {
          simplified.insertAbove(path2);
        }
      } else if (path1 && simplified.insertAbove) {
        simplified.insertAbove(path1);
      }
    }
    
    // path1の属性をコピー
    if (path1 && simplified.copyAttributes) {
      simplified.copyAttributes(path1, true);
    }
    
    return simplified;
  }

  /**
   * Boolean演算の実行
   * paper.jsのtraceBoolean関数を移植
   */
  private static traceBoolean(
    path1: PathItem,
    path2: PathItem,
    operation: 'unite' | 'intersect' | 'subtract' | 'exclude' | 'divide',
    options?: { insert?: boolean, trace?: boolean, stroke?: boolean }
  ): PathItem {
    // ストロークベースのBoolean演算の場合は別の処理を行う
    if (options && (options.trace === false || options.stroke) &&
        /^(subtract|intersect)$/.test(operation)) {
      // TODO: splitBooleanの実装
      // return splitBoolean(path1, path2, operation);
    }

    // パスを準備
    const _path1 = preparePath(path1, true) as Path;
    const _path2 = preparePath(path2, true) as Path;

    // 演算子に応じたフィルタ関数を定義
    const operators: Record<string, Record<string, boolean>> = {
      'unite':     { '1': true, '2': true },
      'intersect': { '2': true },
      'subtract':  { '1': true },
      'exclude':   { '1': true, '-1': true }
    };
    
    // 現在の演算に対応するフィルタ関数
    const operator = operators[operation];
    
    // paper.jsと同様に、operatorにoperationプロパティを追加
    operator[operation] = true;

    // 減算と排他的論理和の場合、パスの向きを調整
    if (_path2 && ((operator.subtract || operator.exclude)
        !== (_path2.isClockwise() !== _path1.isClockwise()))) {
      _path2.reverse();
    }

    // 交点計算
    function filterIntersection(inter: CurveLocation): boolean {
      return inter.hasOverlap() || inter.isCrossing();
    }

    // 交点を取得
    const intersections = _path2 ? this.getIntersections(_path1, _path2) : [];

    if (intersections.length === 0) {
      // 交点がない場合は、reorientPathsを使用して結果を決定
      return this.createResult(
        this.handleNoIntersections(_path1, _path2, operation),
        true, path1, path2 as PathItem, options
      );
    }

    // 交点でパスを分割
    const dividedPath1 = this.dividePathAtIntersections(_path1, intersections);
    const dividedPath2 = _path2 ? this.dividePathAtIntersections(_path2, intersections) : null;
    
    // 交点のwinding number計算
    if (dividedPath2) {
      // 曲線の衝突マップを作成
      const segments: Segment[] = [];
      segments.push(...dividedPath1._segments);
      segments.push(...dividedPath2._segments);
      
      const curves: Curve[] = [];
      for (const segment of segments) {
        const curve = segment.getCurve();
        if (curve) curves.push(curve);
      }
      
      const curvesValues = curves.map(curve => curve.getValues());
      const curveCollisions = CollisionDetection.findCurveBoundsCollisionsWithBothAxis(
        curvesValues, curvesValues, 0
      );
      
      const curveCollisionsMap: Record<string, Record<number, { hor: Curve[]; ver: Curve[] }>> = {};
      for (let i = 0; i < curves.length; i++) {
        const curve = curves[i];
        const id = curve._path._id;
        const map = curveCollisionsMap[id] = curveCollisionsMap[id] || {};
        map[curve.getIndex()] = {
          hor: (curveCollisions[i]?.hor || []).filter(idx => idx !== null).map(idx => curves[idx!]),
          ver: (curveCollisions[i]?.ver || []).filter(idx => idx !== null).map(idx => curves[idx!])
        };
      }
      
      // 交点からwinding numberを伝播
      for (const intersection of intersections) {
        if (intersection.segment) {
          this.propagateWinding(intersection.segment, dividedPath1, dividedPath2, curveCollisionsMap, operator);
        }
      }
      
      // 残りのセグメントにもwinding numberを伝播
      for (const segment of segments) {
        const segInfo = asSegmentInfo(segment);
        if (segInfo && !segInfo._winding) {
          this.propagateWinding(segment, dividedPath1, dividedPath2, curveCollisionsMap, operator);
        }
      }
    }

    // セグメントを収集
    const segments: Segment[] = [];
    segments.push(...dividedPath1._segments);
    if (dividedPath2) {
      segments.push(...dividedPath2._segments);
    }

    // マーチングアルゴリズムで結果パスを構築
    const paths = tracePaths(segments, operator);

    // 結果パスを結合
    return this.createResult(paths, true, path1, path2 as PathItem, options);
  }

  /**
   * パスの合成（unite）
   */
  static unite(path1: PathItem, path2: PathItem): PathItem {
    return this.traceBoolean(path1, path2, 'unite');
  }
  
  /**
   * パスの交差（intersect）
   */
  static intersect(path1: PathItem, path2: PathItem): PathItem {
    return this.traceBoolean(path1, path2, 'intersect');
  }
  
  /**
   * パスの差分（subtract）
   */
  static subtract(path1: PathItem, path2: PathItem): PathItem {
    return this.traceBoolean(path1, path2, 'subtract');
  }
  
  /**
   * パスの排他的論理和（exclude）
   */
  static exclude(path1: PathItem, path2: PathItem): PathItem {
    return this.traceBoolean(path1, path2, 'exclude');
  }
  
  /**
   * パスの分割（divide）
   */
  static divide(path1: PathItem, path2: PathItem): PathItem {
    return this.traceBoolean(path1, path2, 'divide');
  }
}