/**
 * PathBooleanWinding: Boolean演算のためのwinding number計算
 * paper.jsのPathItem.Boolean.jsを参考に実装
 */

import { Path } from './Path';
import { Segment } from './Segment';
import { Point } from '../basic/Point';
import { Curve } from './Curve';
import { Numerical } from '../util/Numerical';
import { CurveSubdivision } from './CurveSubdivision';
import { Intersection } from './PathBooleanIntersections';
import { getMeta, WindingInfo } from './SegmentMeta';

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
  // Here we try to determine the most likely winding number contribution
  // for the curve-chain starting with this segment. Once we have enough
  // confidence in the winding contribution, we can propagate it until the
  // next intersection or end of a curve chain.
  const chain: { segment: Segment; curve: Curve | null; length: number }[] = [];
  let start = segment;
  let totalLength = 0;

  // paper.jsと同じ: segmentがstartに戻るか、交点に到達するまでchainを構築
  let seg: Segment | null = segment;
  do {
    const curve = seg.getCurve();
    if (curve) {
      const length = curve.getLength();
      chain.push({ segment: seg, curve, length });
      totalLength += length;
    } else {
      // curveがない場合もchainにsegmentのみ追加（length=0, curve=null）
      chain.push({ segment: seg, curve: null, length: 0 });
    }
    seg = seg ? seg.getNext() : null;
  } while (seg && !((seg as any)._intersection) && seg !== segment);

  
  // Determine winding at three points in the chain. If a winding with
  // sufficient quality is found, use it. Otherwise use the winding with
  // the best quality.
  const offsets = [0.5, 0.25, 0.75];
  let windingResult: { winding: number; quality: number; windingL: number; windingR: number; onPath: boolean } = { winding: 0, quality: -1, windingL: 0, windingR: 0, onPath: false };
  // Don't go too close to segments, to avoid special winding cases:
  const tMin = 1e-3;
  const tMax = 1 - tMin;
  
  for (let i = 0; i < offsets.length && windingResult.quality < 0.5; i++) {
    const length = totalLength * offsets[i];
    let chainLength = 0;
    
    for (let j = 0, l = chain.length; j < l; j++) {
      const entry = chain[j];
      const curveLength = entry.length;
      
      if (length <= chainLength + curveLength) {
        const curve = entry.curve;
        if (!curve) {
          // curveがない場合はwinding=0, quality=1をセットしてbreak
          windingResult = { winding: 0, quality: 1, windingL: 0, windingR: 0, onPath: false };
          break;
        }
        const path = curve._path;
        const parent = path._parent;
        const operand = parent instanceof CompoundPath ? parent : path;
        // paper.jsの実装に合わせる
        // この文脈では、getTimeAtがnullを返すことはないと想定
        const t = Numerical.clamp(curve.getTimeAt(length - chainLength)!, tMin, tMax);
        const pt = curve.getPointAtTime(t);

        // Determine the direction in which to check the winding
        // from the point (horizontal or vertical), based on the
        // curve's direction at that point. If tangent is less
        // than 45°, cast the ray vertically, else horizontally.
        const dir = Math.abs(curve.getTangentAtTime(t).y) < Math.SQRT1_2;

        // While subtracting, we need to omit this curve if it is
        // contributing to the second operand and is outside the
        // first operand.
        let wind: { winding: number; windingL: number; windingR: number; quality: number; onPath: boolean } | null = null;
        if (operator.subtract && path2) {
          // Calculate path winding at point depending on operand.
          const otherPath = operand === path1 ? path2 : path1;
          const pathWinding = otherPath._getWinding(pt, dir, true);

          // Check if curve should be omitted.
          if (operand === path1 && pathWinding.winding ||
              operand === path2 && !pathWinding.winding) {
            // Check if quality is not good enough...
            if (pathWinding.quality < 1) {
              // ...and if so, skip this point...
              continue;
            } else {
              // ...otherwise, omit this curve.
              wind = { winding: 0, quality: 1, windingL: 0, windingR: 0, onPath: false };
            }
          }
        }

        const ccmap = curveCollisionsMap[path._id!];
        const curvesArg = (ccmap && ccmap[curve.getIndex()]) || path.getCurves();
        wind = wind || getWinding(
          pt,
          curvesArg,
          dir,
          true
        );

        if (wind.quality > windingResult.quality)
          windingResult = wind;

        break;
      }
      
      chainLength += curveLength;
    }
  }
  
  // Now assign the winding to the entire curve chain.
  // 端点overlapなセグメントにもwindingをセット
  // paper.jsと同じ: chain内の全セグメントにwindingをセット
  for (let j = chain.length - 1; j >= 0; j--) {
    const meta = getMeta(chain[j].segment);
    if (meta) {
      meta.winding = windingResult;
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
  // paper.jsと同じ解釈: dir=trueはy方向、dir=falseはx方向
  const ia = dir ? 1 : 0; // the abscissa index
  const io = ia ^ 1;      // the ordinate index
  const pv = [point.x, point.y];
  const pa = pv[ia];      // the point's abscissa
  const po = pv[io];      // the point's ordinate
  
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
      if (a0 < paR && a3 > paL || a3 < paR && a0 > paL) {
        onPath = true;
      }
      // If curve does not change in ordinate direction, windings will
      // be added by adjacent curves.
      // Bail out without updating vPrev at the end of the call.
      return;
    }
    
    // 曲線上の時間パラメータを計算
    let t: number;
    if (po === o0) {
      t = 0;
    } else if (po === o3) {
      t = 1;
    } else {
      // If the abscissa is outside the curve, we can use any
      // value except 0 (requires special handling). Use 1, as it
      // does not require additional calculations for the point.
      t = paL > max(a0, a1, a2, a3) || paR < min(a0, a1, a2, a3)
        ? 1
        : Curve.solveCubic(v, io, po, roots, 0, 1) > 0 ? roots[0] : 1;
    }
    
    // 曲線上の点の横座標を計算
    const a = t === 0 ? a0
            : t === 1 ? a3
            : Curve.getPoint(v, t)[dir ? 'y' : 'x'];
    
    // winding方向を決定
    const winding = o0 > o3 ? 1 : -1;
    const windingPrev = vPrev ? (vPrev[io] > vPrev[io + 6] ? 1 : -1) : 0;
    const a3Prev = vPrev ? vPrev[ia + 6] : 0;
    
    // 曲線の始点でない場合の処理
    if (po !== o0) {
      // Standard case, curve is not crossed at its starting point.
      if (a < paL) {
        pathWindingL += winding;
      } else if (a > paR) {
        pathWindingR += winding;
      } else {
        onPath = true;
      }
      
      // Determine the quality of the winding calculation. Reduce the
      // quality with every crossing of the ray very close to the
      // path. This means that if the point is on or near multiple
      // curves, the quality becomes less than 0.5.
      if (a > pa - qualityEpsilon && a < pa + qualityEpsilon) {
        quality /= 2;
      }
    } else {
      // 曲線の始点での処理
      // Curve is crossed at starting point.
      if (winding !== windingPrev) {
        // Winding changes from previous curve, cancel its winding.
        if (a0 < paL) {
          pathWindingL += winding;
        } else if (a0 > paR) {
          pathWindingR += winding;
        }
      } else if (a0 != a3Prev) {
        // Handle a horizontal curve between the current and
        // previous non-horizontal curve.
        if (a3Prev < paR && a > paR) {
          // Right winding was not added before, so add it now.
          pathWindingR += winding;
          onPath = true;
        } else if (a3Prev > paL && a < paL) {
          // Left winding was not added before, so add it now.
          pathWindingL += winding;
          onPath = true;
        }
      }
      quality /= 4;
    }
    
    vPrev = v;
    
    // 接線が方向に平行な場合、方向を反転して再計算
    return !dontFlip && a > paL && a < paR
            && Curve.getTangent(v, t)[dir ? 'x' : 'y'] === 0
            && getWinding(point, curves, !dir, closed, true);
  }
  
  // 曲線を処理する関数
  function handleCurve(v: number[]): any {
    // Get the ordinates:
    const o0 = v[io + 0];
    const o1 = v[io + 2];
    const o2 = v[io + 4];
    const o3 = v[io + 6];
    
    // Only handle curves that can cross the point's ordinate.
    if (po <= max(o0, o1, o2, o3) && po >= min(o0, o1, o2, o3)) {
      // Get the abscissas:
      const a0 = v[ia + 0];
      const a1 = v[ia + 2];
      const a2 = v[ia + 4];
      const a3 = v[ia + 6];
      
      // Get monotone curves. If the curve is outside the point's
      // abscissa, it can be treated as a monotone curve:
      const monoCurves = paL > max(a0, a1, a2, a3) || paR < min(a0, a1, a2, a3)
        ? [v]
        : Curve.getMonoCurves(v, dir);
      
      let res;
      for (let i = 0, l = monoCurves.length; i < l; i++) {
        // Calling addWinding() may lead to direction flipping, in
        // which case we already have the result and can return it.
        if (res = addWinding(monoCurves[i]))
          return res;
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
      // We're on a new (sub-)path, so we need to determine values of
      // the last non-horizontal curve on this path.
      vPrev = undefined;
      
      // If the path is not closed, connect the first and last segment
      // based on the value of `closed`:
      // - `false`: Connect with a straight curve, just like how
      //   filling open paths works.
      // - `true`: Connect with a curve that takes the segment handles
      //   into account, just like how closed paths behave.
      if (!path._closed) {
        vClose = CurveSubdivision.getValues(
          path.getLastCurve()._segment2,
          curve._segment1,
          null,
          !closed
        );
        
        // This closing curve is a potential candidate for the last
        // non-horizontal curve.
        if (vClose[io] !== vClose[io + 6]) {
          vPrev = vClose;
        }
      }
      
      if (!vPrev) {
        // Walk backwards through list of the path's curves until we
        // find one that is not horizontal.
        // Fall-back to the first curve's values if none is found:
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
    
    // Calling handleCurve() may lead to direction flipping, in which
    // case we already have the result and can return it.
    if (res = handleCurve(v))
      return res;
    
    // パスの最後の曲線の処理
    if (i + 1 === l || curvesList[i + 1]._path !== path) {
      // We're at the last curve of the current (sub-)path. If a
      // closing curve was calculated at the beginning of it, handle
      // it now to treat the path as closed:
      if (vClose && (res = handleCurve(vClose)))
        return res;
      
      // パス上にあり、windingが相殺された場合の処理
      if (onPath && !pathWindingL && !pathWindingR) {
        // paper.jsでは path.isClockwise(closed) ^ dir ? 1 : -1 としているが
        // TypeScriptではビット演算子^の右側は数値型である必要があるため、
        // 条件式を書き換える
        // 元の実装に戻す
        pathWindingL = pathWindingR = (path.isClockwise(closed) !== dir) ? 1 : -1;
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
 * 交点のwinding numberの寄与を計算
 * paper.jsのgetWindingContribution関数を移植
 *
 * @param segment - winding寄与を計算するセグメント
 * @param path1 - ブール演算の最初のパス
 * @param path2 - ブール演算の2番目のパス（存在する場合）
 * @param operator - ブール演算子
 * @returns winding寄与
 */
export function getWindingContribution(
  segment: Segment,
  path1: Path,
  path2: Path | null,
  operator: Record<string, boolean>
): number {
  const meta = getMeta(segment);
  if (!meta || !meta.winding) {
    return 0;
  }
  
  const winding = meta.winding;
  return operator.subtract && path2
    ? path1.isClockwise() !== path2.isClockwise()
      ? winding.winding
      : winding.windingL! - winding.windingR!
    : winding.winding;
}

// CompoundPathのimport
import { CompoundPath } from './CompoundPath';