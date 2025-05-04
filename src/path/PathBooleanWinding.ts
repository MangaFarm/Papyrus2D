/**
 * PathBooleanWinding: Boolean演算のためのwinding number計算
 * paper.jsのPathItem.Boolean.jsを参考に実装
 */

import { Path } from './Path';
import { Segment } from './Segment';
import { Point } from '../basic/Point';
import { Curve } from './Curve';
import { Numerical } from '../util/Numerical';
import { CurveCalculation } from './CurveCalculation';
import { CurveSubdivision } from './CurveSubdivision';
import { Intersection } from './PathBooleanIntersections';

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
export function asSegmentInfo(segment: Segment | null | undefined): Segment & SegmentInfo | null | undefined {
  return segment as (Segment & SegmentInfo) | null | undefined;
}

/**
 * winding numberを伝播する
 * paper.jsのpropagateWinding関数を移植
 */
export function propagateWinding(
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
        // paper.jsと同じ方法で曲線上の点を計算
        const t = Numerical.clamp(curve.getTimeAt(length), tMin, tMax);
        const pt = curve.getPointAtTime(t);
        
        // 接線の方向に基づいて、水平または垂直方向を決定
        const tangent = curve.getTangentAtTime(t);
        const dir = Math.abs(tangent.y) < Math.SQRT1_2;
        
        // 減算演算の場合の特殊処理
        let wind: { winding: number; windingL: number; windingR: number; quality: number; onPath: boolean } | null = null;
        if (operator.subtract && path2) {
          const otherPath = operand === path1 ? path2 : path1;
          // getWindingを使用して計算
          // paper.jsと同じ挙動になるようにgetWindingを使用
          const pathWinding = getWinding(pt, otherPath.getCurves(), dir, true);
          
          // 曲線を省略すべきかチェック
          if ((operand === path1 && pathWinding.winding) ||
              (operand === path2 && !pathWinding.winding)) {
            if (pathWinding.quality < 1) {
              continue;
            } else {
              wind = { winding: 0, quality: 1, windingL: 0, windingR: 0, onPath: false };
            }
          }
        }
        
        // winding numberを計算
        wind = wind || getWinding(
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
export function getWinding(
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
      // Papyrus2DのNumerical.solveCubicの引数に合わせて調整
      // 三次方程式の係数を計算
      const a = v[0];
      const b = v[1];
      const c = v[2];
      const d = v[3] - po;
      const count = Numerical.solveCubic(a, b, c, d, roots, { min: 0, max: 1 });
      t = count > 0 ? roots[0] : 1;
    }
    
    // 曲線上の点の横座標を計算
    let a: number;
    if (t === 0) {
      a = a0;
    } else if (t === 1) {
      a = a3;
    } else {
      // CurveCalculationを使用して点を取得
      const p = CurveCalculation.getPoint(v, t)!;
      a = p[dir ? 'y' : 'x'];
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
      // CurveCalculationを使用して接線を取得
      const tangent = CurveCalculation.getTangent(v, t)!;
      if (tangent[dir ? 'x' : 'y'] === 0) {
        return getWinding(point, curves, !dir, closed, true);
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
      // CurveSubdivisionを使用して単調曲線を取得
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
        // CurveSubdivisionを使用して閉じる曲線を計算
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

// CompoundPathのimport
import { CompoundPath } from './CompoundPath';