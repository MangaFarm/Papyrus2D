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
   * 交点のwinding numberを計算
   */
  private static calculateWindingNumbers(path1: Path, path2: Path, intersections: Intersection[]): void {
    for (const intersection of intersections) {
      const point = intersection.point;
      
      // path1上の点におけるpath2のwinding number
      const winding2 = this.getWindingNumber(path2, point);
      
      // 交点の種類（entry/exit）を決定
      // winding numberが奇数なら内部、偶数なら外部
      const isInside2 = (winding2 & 1) === 1;
      
      // 交点の種類を決定
      intersection.type = isInside2 ? 'exit' : 'entry';
      intersection.winding = winding2;
    }
  }

  /**
   * 指定した点でのwinding numberを計算
   */
  private static getWindingNumber(path: Path, point: Point): number {
    // 簡易実装：レイキャスティングによるwinding number計算
    const curves = path.getCurves();
    let winding = 0;
    
    for (const curve of curves) {
      // カーブの値を取得
      const v = [
        curve._segment1.point.x,
        curve._segment1.point.y,
        curve._segment1.point.x + curve._segment1.handleOut.x,
        curve._segment1.point.y + curve._segment1.handleOut.y,
        curve._segment2.point.x + curve._segment2.handleIn.x,
        curve._segment2.point.y + curve._segment2.handleIn.y,
        curve._segment2.point.x,
        curve._segment2.point.y
      ];
      
      // 点のy座標
      const y = point.y;
      
      // カーブのy座標の範囲をチェック
      const minY = Math.min(v[1], v[3], v[5], v[7]);
      const maxY = Math.max(v[1], v[3], v[5], v[7]);
      
      if (y < minY || y > maxY) continue;
      
      // カーブとレイの交点を計算
      const roots: number[] = [];
      Numerical.solveCubic(
        -v[1] + 3 * v[3] - 3 * v[5] + v[7],
        3 * v[1] - 6 * v[3] + 3 * v[5],
        -3 * v[1] + 3 * v[3],
        v[1] - y,
        roots,
        { min: 0, max: 1 }
      );
      
      for (const t of roots) {
        if (t < Numerical.CURVETIME_EPSILON || t > 1 - Numerical.CURVETIME_EPSILON) {
          continue;
        }
        
        // 交点のx座標を計算
        const mt = 1 - t;
        const x = mt * mt * mt * v[0] + 3 * mt * mt * t * v[2] + 3 * mt * t * t * v[4] + t * t * t * v[6];
        
        // 点のx座標より左側の交点のみカウント
        if (x < point.x) {
          // 交差方向を判定
          const dy = 3 * (mt * mt * (v[3] - v[1]) + 2 * mt * t * (v[5] - v[3]) + t * t * (v[7] - v[5]));
          winding += dy > 0 ? 1 : -1;
        }
      }
    }
    
    return Math.abs(winding);
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
   * マーチングアルゴリズムによるパス構築
   * paper.jsのtracePathsアルゴリズムを忠実に移植
   */
  private static tracePaths(
    segments: Segment[],
    operator: Record<string, boolean>
  ): Path[] {
    const paths: Path[] = [];
    let starts: Segment[] = [];

    // セグメントが有効かどうかを判定する関数
    // paper.jsのisValid関数と同等の機能
    function isValid(seg: Segment | null | undefined): boolean {
      const segInfo = asSegmentInfo(seg);
      if (!segInfo || segInfo._visited) return false;

      if (!operator) return true;

      const winding = segInfo._winding;
      if (!winding) return false;

      return !!(
        operator[winding.winding] &&
        !(
          operator.unite &&
          winding.winding === 2 &&
          winding.windingL &&
          winding.windingR
        )
      );
    }

    // セグメントが開始点かどうかを判定する関数
    function isStart(seg: Segment | null | undefined): boolean {
      if (!seg) return false;
      for (let i = 0, l = starts.length; i < l; i++) {
        if (seg === starts[i]) return true;
      }
      return false;
    }

    // パスを訪問済みにする関数
    // paper.jsのvisitPath関数と同等の機能
    function visitPath(path: Path): void {
      const pathSegments = path._segments;
      for (let i = 0, l = pathSegments.length; i < l; i++) {
        asSegmentInfo(pathSegments[i])!._visited = true;
      }
    }

    // 交差するセグメントを取得する関数
    // paper.jsのgetCrossingSegments関数と同等の機能
    function getCrossingSegments(segment: Segment, collectStarts: boolean): Segment[] {
      const segInfo = asSegmentInfo(segment);
      const inter = segInfo?._intersection;
      const start = inter || undefined; // nullの場合はundefinedに変換
      const crossings: Segment[] = [];
      
      if (collectStarts) {
        starts = [segment];
      }

      function collect(inter: Intersection | null, end?: Intersection): void {
        while (inter && inter !== end) {
          const other = inter.segment;
          const otherInfo = asSegmentInfo(other);
          const path = other && otherInfo?._path;
          
          if (path) {
            const next = other.getNext() || path.getFirstSegment();
            const nextInfo = asSegmentInfo(next);
            const nextInter = nextInfo?._intersection;
            
            if (
              other !== segment &&
              (isStart(other) ||
                isStart(next) ||
                (next &&
                  (isValid(other) &&
                    (isValid(next) || (nextInter && isValid(nextInter.segment))))))
            ) {
              crossings.push(other);
            }
            
            if (collectStarts) {
              starts.push(other);
            }
          }
          
          inter = inter.next!;
        }
      }

      if (inter) {
        collect(inter);
        // リンクリストの先頭に移動
        let interStart = inter;
        while (interStart && interStart.prev) {
          interStart = interStart.prev;
        }
        collect(interStart, start);
      }
      
      return crossings;
    }

    // セグメントをソート
    // paper.jsのソートロジックと同等の機能
    segments.sort((seg1, seg2) => {
      const seg1Info = asSegmentInfo(seg1);
      const seg2Info = asSegmentInfo(seg2);
      const inter1 = seg1Info?._intersection;
      const inter2 = seg2Info?._intersection;
      const over1 = !!(inter1 && inter1._overlap);
      const over2 = !!(inter2 && inter2._overlap);
      const path1 = seg1Info?._path;
      const path2 = seg2Info?._path;
      
      // 重なりとインターセクションの優先順位でソート
      if (over1 !== over2) {
        return over1 ? 1 : -1;
      }
      
      if (!inter1 !== !inter2) {
        return inter1 ? 1 : -1;
      }
      
      // パスIDとセグメントインデックスでソート
      if (path1 !== path2) {
        // paper.jsとの互換性のため、_idプロパティを使用
        // 型安全性のため、デフォルト値を使用
        const id1 = path1 && path1._id !== undefined ? path1._id : 0;
        const id2 = path2 && path2._id !== undefined ? path2._id : 0;
        return id1 - id2;
      }
      
      return seg1._index - seg2._index;
    });

    // 各セグメントからパスをトレース
    for (let i = 0, l = segments.length; i < l; i++) {
      const segStart = segments[i];
      let validStart = isValid(segStart);
      let path: Path | null = null;
      let finished = false;
      let closed = true;
      const branches: any[] = [];
      let branch: any;
      let visited: Segment[] = [];
      let handleIn: Point | null = null;

      // すべてのセグメントが重なりの場合の特別処理
      // paper.jsの重なり処理と同等の機能
      const segStartInfo = asSegmentInfo(segStart);
      const path1 = segStartInfo?._path;
      
      if (validStart && path1 && path1._overlapsOnly) {
        const segmentPath = segStartInfo._intersection?.segment ?
          asSegmentInfo(segStartInfo._intersection.segment)?._path : undefined;
        
        // paper.jsとの互換性のため、compareメソッドを使用
        if (path1 && segmentPath && path1.compare && path1.compare(segmentPath)) {
          if (path1.getArea()) {
            paths.push(path1.clone(false));
          }
          visitPath(path1);
          if (segmentPath) {
            visitPath(segmentPath);
          }
          validStart = false;
        }
      }

      // 有効なセグメントからパスをトレース
      let currentSeg = segStart;
      while (validStart && currentSeg) {
        const first = !path;
        const crossings = getCrossingSegments(currentSeg, first);
        const other = crossings.shift();
        const isFinished = !first && (isStart(currentSeg) || isStart(other));
        const cross = !isFinished && other;

        if (first) {
          path = new Path();
          branch = null;
        }

        if (isFinished) {
          if (currentSeg.isFirst() || currentSeg.isLast()) {
            const currentSegInfo = asSegmentInfo(currentSeg);
            closed = currentSegInfo?._path._closed || false;
          }
          asSegmentInfo(currentSeg)!._visited = true;
          finished = true;
          break;
        }

        if (cross && branch) {
          branches.push(branch);
          branch = null;
        }

        if (!branch) {
          if (cross) {
            crossings.push(currentSeg);
          }
          branch = {
            start: path!._segments.length,
            crossings: crossings,
            visited: visited = [],
            handleIn: handleIn
          };
        }

        let nextSeg = currentSeg;
        if (cross && other) {
          nextSeg = other;
        }

        if (!isValid(nextSeg)) {
          // 無効なセグメントに遭遇した場合、分岐点に戻る
          // paper.jsのバックトラック処理と同等の機能
          path!.removeSegments(branch.start);
          for (let j = 0, k = visited.length; j < k; j++) {
            asSegmentInfo(visited[j])!._visited = false;
          }
          visited.length = 0;

          // 他の交差を試す
          let foundValid = false;
          do {
            const branchSeg = branch && branch.crossings.shift() || null;
            const branchSegInfo = asSegmentInfo(branchSeg);
            if (!branchSeg || !branchSegInfo?._path) {
              nextSeg = currentSeg; // 現在のセグメントを維持
              branch = branches.pop();
              if (branch) {
                visited = branch.visited;
                handleIn = branch.handleIn;
              }
            } else if (isValid(branchSeg)) {
              nextSeg = branchSeg;
              foundValid = true;
            } else {
              nextSeg = currentSeg; // 現在のセグメントを維持
            }
          } while (branch && !foundValid);

          if (!branch) {
            break;
          }
        }

        // セグメントをパスに追加
        const next = nextSeg.getNext();
        path!.add(new Segment(nextSeg._point, handleIn, next && nextSeg._handleOut));
        asSegmentInfo(nextSeg)!._visited = true;
        visited.push(nextSeg);
        
        // 次のセグメントに移動
        const nextSegInfo = asSegmentInfo(nextSeg);
        const nextPath = nextSegInfo?._path;
        // paper.jsとの互換性のため、getFirstSegmentメソッドを使用
        currentSeg = next || (nextPath ? nextPath.getFirstSegment() : undefined) || currentSeg;
        handleIn = next && (next._handleIn as unknown as Point);
      }

      if (finished && path) {
        if (closed) {
          // open/closedパス混在時の端点ハンドル処理
          // paper.jsと同様に、最初のセグメントのhandleInを設定
          const firstSegment = path.getFirstSegment();
          if (firstSegment && handleIn) {
            firstSegment.setHandleIn(handleIn);
          }
          path.setClosed(closed);
        }

        // 面積が0でないパスのみ追加
        // paper.jsと同様の処理
        if (path.getArea() !== 0) {
          paths.push(path);
        }
      }
    }

    return paths;
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
      this.calculateWindingNumbers(dividedPath1, dividedPath2, intersections);
    }

    // セグメントを収集
    const segments: Segment[] = [];
    segments.push(...dividedPath1._segments);
    if (dividedPath2) {
      segments.push(...dividedPath2._segments);
    }

    // マーチングアルゴリズムで結果パスを構築
    const paths = this.tracePaths(segments, operator);

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