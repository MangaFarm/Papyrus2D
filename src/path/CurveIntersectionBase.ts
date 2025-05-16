/**
 * CurveIntersectionBase
 * 曲線交点計算の基本関数を提供するユーティリティ
 */

import { Curve } from './Curve';
import { Line } from '../basic/Line';
import { CurveLocation } from './CurveLocation';
import { Numerical } from '../util/Numerical';
import { CurveGeometry } from './CurveGeometry';
import { getConvexHull, clipConvexHull } from './CurveIntersectionConvexHull';
import { counter } from './CurveIntersectionMain';

/**
 * 自己交差チェック
 * paper.jsのgetSelfIntersection実装を移植
 */
export function getSelfIntersection(
  v1: number[],
  c1: Curve,
  locations: CurveLocation[],
  include: (loc: CurveLocation) => boolean
): CurveLocation[] {
  // paper.jsと同様の実装に修正
  const info = CurveGeometry.classify(v1);
  
  // ループ型の曲線の場合のみ交点を検出（paper.jsと同様）
  if (info.type === 'loop') {
    // 自己交差の場合はoverlapをfalseに設定
    addLocation(locations, include, c1, info.roots![0], c1, info.roots![1], false);
  }

  return locations;
}

/**
 * 交点情報を追加
 * paper.jsのaddLocation実装を移植
 */
export function addLocation(
  locations: CurveLocation[],
  include: ((loc: CurveLocation) => boolean),
  c1: Curve,
  t1: number | null,
  c2: Curve,
  t2: number | null,
  overlap: boolean
): void {
  // paper.jsのaddLocationを忠実にTypeScript化
  // excludeStart/Endの判定
  const excludeStart = !overlap && c1.getPrevious() === c2;
  const excludeEnd = !overlap && c1 !== c2 && c1.getNext() === c2;
  const tMin = Numerical.CURVETIME_EPSILON;
  const tMax = 1 - tMin;

  // t1, t2が有効範囲かつ端点除外条件を満たす場合のみ追加
  if (
    t1 !== null &&
    t1 >= (excludeStart ? tMin : 0) &&
    t1 <= (excludeEnd ? tMax : 1) &&
    t2 !== null &&
    t2 >= (excludeEnd ? tMin : 0) &&
    t2 <= (excludeStart ? tMax : 1)
  ) {
    // CurveLocationを2つ生成し、相互参照
    const loc1 = new CurveLocation(c1, t1, null, overlap, null);
    const loc2 = new CurveLocation(c2, t2, null, overlap, null);
    loc1._intersection = loc2;
    loc2._intersection = loc1;
    // includeコールバックがなければ、または条件を満たせばloc1のみ追加
    if (!include || include(loc1)) {
      CurveLocation.insert(locations, loc1, true);
    }
  }
}

export function addCurveIntersections(
  v1: number[],
  v2: number[],
  c1: Curve,
  c2: Curve,
  locations: CurveLocation[],
  include: ((loc: CurveLocation) => boolean),
  flip: boolean,
  recursion: number,
  calls: number,
  tMin: number,
  tMax: number,
  uMin: number,
  uMax: number
): number {
  // Avoid deeper recursion, by counting the total amount of recursions,
  // as well as the total amount of calls, to avoid massive call-trees as
  // suggested by @iconexperience in #904#issuecomment-225283430.
  // See also: #565 #899 #1074
  if (++calls >= 4096 || ++recursion >= 40) return calls;
  // Use an epsilon smaller than CURVETIME_EPSILON to compare curve-time
  // parameters in fat-line clipping code.
  var fatLineEpsilon = 1e-9,
    // Let P be the first curve and Q be the second
    q0x = v2[0],
    q0y = v2[1],
    q3x = v2[6],
    q3y = v2[7],
    getSignedDistance = Line.getSignedDistance,
    // Calculate the fat-line L for Q is the baseline l and two
    // offsets which completely encloses the curve P.
    d1 = getSignedDistance(q0x, q0y, q3x, q3y, v2[2], v2[3], false),
    d2 = getSignedDistance(q0x, q0y, q3x, q3y, v2[4], v2[5], false),
    factor = d1 * d2 > 0 ? 3 / 4 : 4 / 9,
    dMin = factor * Math.min(0, d1, d2),
    dMax = factor * Math.max(0, d1, d2),
    // Calculate non-parametric bezier curve D(ti, di(t)):
    // - di(t) is the distance of P from baseline l of the fat-line
    // - ti is equally spaced in [0, 1]
    dp0 = getSignedDistance(q0x, q0y, q3x, q3y, v1[0], v1[1], false),
    dp1 = getSignedDistance(q0x, q0y, q3x, q3y, v1[2], v1[3], false),
    dp2 = getSignedDistance(q0x, q0y, q3x, q3y, v1[4], v1[5], false),
    dp3 = getSignedDistance(q0x, q0y, q3x, q3y, v1[6], v1[7], false),
    // Get the top and bottom parts of the convex-hull
    hull = getConvexHull(dp0, dp1, dp2, dp3),
    top = hull[0],
    bottom = hull[1],
    tMinClip,
    tMaxClip;
  // Stop iteration if all points and control points are collinear.
  if (
    (d1 === 0 && d2 === 0 && dp0 === 0 && dp1 === 0 && dp2 === 0 && dp3 === 0) ||
    // Clip convex-hull with dMin and dMax, taking into account that
    // there will be no intersections if one of the results is null.
    (tMinClip = clipConvexHull(top, bottom, dMin, dMax)) == null ||
    (tMaxClip = clipConvexHull(top.reverse(), bottom.reverse(), dMin, dMax)) == null
  )
    return calls;
  // tMin and tMax are within the range (0, 1). Project it back to the
  // original parameter range for v2.
  var tMinNew = tMin + (tMax - tMin) * tMinClip,
    tMaxNew = tMin + (tMax - tMin) * tMaxClip;
  if (Math.max(uMax - uMin, tMaxNew - tMinNew) < fatLineEpsilon) {
    // We have isolated the intersection with sufficient precision
    var t = (tMinNew + tMaxNew) / 2,
      u = (uMin + uMax) / 2;
    addLocation(locations, include, flip ? c2 : c1, flip ? u : t, flip ? c1 : c2, flip ? t : u, false);
  } else {
    // Apply the result of the clipping to curve 1:
    v1 = Curve.getPart(v1, tMinClip, tMaxClip);
    var uDiff = uMax - uMin;
    if (tMaxClip - tMinClip > 0.8) {
      // Subdivide the curve which has converged the least.
      if (tMaxNew - tMinNew > uDiff) {
        var parts = Curve.subdivide(v1, 0.5),
          t = (tMinNew + tMaxNew) / 2;
        calls = addCurveIntersections(
          v2,
          parts[0],
          c2,
          c1,
          locations,
          include,
          !flip,
          recursion,
          calls,
          uMin,
          uMax,
          tMinNew,
          t
        );
        calls = addCurveIntersections(
          v2,
          parts[1],
          c2,
          c1,
          locations,
          include,
          !flip,
          recursion,
          calls,
          uMin,
          uMax,
          t,
          tMaxNew
        );
      } else {
        var parts = Curve.subdivide(v2, 0.5),
          u = (uMin + uMax) / 2;
        calls = addCurveIntersections(
          parts[0],
          v1,
          c2,
          c1,
          locations,
          include,
          !flip,
          recursion,
          calls,
          uMin,
          u,
          tMinNew,
          tMaxNew
        );
        calls = addCurveIntersections(
          parts[1],
          v1,
          c2,
          c1,
          locations,
          include,
          !flip,
          recursion,
          calls,
          u,
          uMax,
          tMinNew,
          tMaxNew
        );
      }
    } else {
      // Iterate
      // For some unclear reason we need to check against uDiff === 0
      // here, to prevent a regression from happening, see #1638.
      // Maybe @iconexperience could shed some light on this.
      if (uDiff === 0 || uDiff >= fatLineEpsilon) {
        calls = addCurveIntersections(
          v2,
          v1,
          c2,
          c1,
          locations,
          include,
          !flip,
          recursion,
          calls,
          uMin,
          uMax,
          tMinNew,
          tMaxNew
        );
      } else {
        // The interval on the other curve is already tight enough,
        // therefore we keep iterating on the same curve.
        calls = addCurveIntersections(
          v1,
          v2,
          c1,
          c2,
          locations,
          include,
          flip,
          recursion,
          calls,
          tMinNew,
          tMaxNew,
          uMin,
          uMax
        );
      }
    }
  }
  return calls;
}
