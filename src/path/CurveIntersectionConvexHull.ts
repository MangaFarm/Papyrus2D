/**
 * CurveIntersectionConvexHull
 * Utility providing convex hull and recursive intersection calculation functions
 */

import { Curve, CurveLocation } from './Curve';
import { Numerical } from '../util/Numerical';
import { Point } from '../basic/Point';
import { Line } from '../basic/Line';
import { addLocation } from './CurveIntersectionBase';

/**
 * Recursively computes the intersections between two curves
 */
export function addCurveIntersections(
  v1: number[], v2: number[],
  c1: Curve, c2: Curve,
  locations: CurveLocation[],
  include?: (loc: CurveLocation) => boolean,
  flip?: boolean,
  recursion: number = 0,
  calls: number = 0,
  tMin: number = 0, tMax: number = 1,
  uMin: number = 0, uMax: number = 1
): number {
  // Avoid deeper recursion, by counting the total amount of recursions,
  // as well as the total amount of calls, to avoid massive call-trees
  if (++calls >= 4096 || ++recursion >= 40)
    return calls;
  
  // Use an epsilon smaller than CURVETIME_EPSILON to compare curve-time
  // parameters in fat-line clipping code.
  const fatLineEpsilon = 1e-9;
  
  // Let P be the first curve and Q be the second
  const q0x = v2[0], q0y = v2[1], q3x = v2[6], q3y = v2[7];
  
  // Calculate the fat-line L for Q is the baseline l and two
  // offsets which completely encloses the curve P.
  // paper.jsと同様にLine.getSignedDistanceを使用
  const getSignedDistance = Line.getSignedDistance;
  
  const d1 = getSignedDistance(q0x, q0y, q3x, q3y, v2[2], v2[3], false);
  const d2 = getSignedDistance(q0x, q0y, q3x, q3y, v2[4], v2[5], false);
  const factor = d1 * d2 > 0 ? 3 / 4 : 4 / 9;
  const dMin = factor * Math.min(0, d1, d2);
  const dMax = factor * Math.max(0, d1, d2);
  
  // Calculate non-parametric bezier curve D(ti, di(t)):
  // - di(t) is the distance of P from baseline l of the fat-line
  // - ti is equally spaced in [0, 1]
  const dp0 = getSignedDistance(q0x, q0y, q3x, q3y, v1[0], v1[1], false);
  const dp1 = getSignedDistance(q0x, q0y, q3x, q3y, v1[2], v1[3], false);
  const dp2 = getSignedDistance(q0x, q0y, q3x, q3y, v1[4], v1[5], false);
  const dp3 = getSignedDistance(q0x, q0y, q3x, q3y, v1[6], v1[7], false);
  
  // Get the top and bottom parts of the convex-hull
  const hull = getConvexHull(dp0, dp1, dp2, dp3);
  const top = hull[0];
  const bottom = hull[1];
  let tMinClip: number | null = null;
  let tMaxClip: number | null = null;
  
  // Stop iteration if all points and control points are collinear
  if (d1 === 0 && d2 === 0
          && dp0 === 0 && dp1 === 0 && dp2 === 0 && dp3 === 0
      // Clip convex-hull with dMin and dMax, taking into account that
      // there will be no intersections if one of the results is null
      || (tMinClip = clipConvexHull(top, bottom, dMin, dMax)) == null
      || (tMaxClip = clipConvexHull(top.reverse(), bottom.reverse(),
          dMin, dMax)) == null)
      return calls;
  
  // tMin and tMax are within the range (0, 1). Project it back to the
  // original parameter range for v2
  const tMinNew = tMin + (tMax - tMin) * tMinClip;
  const tMaxNew = tMin + (tMax - tMin) * tMaxClip;
  
  if (Math.max(uMax - uMin, tMaxNew - tMinNew) < fatLineEpsilon) {
    // We have isolated the intersection with sufficient precision
    const t = (tMinNew + tMaxNew) / 2;
    const u = (uMin + uMax) / 2;
    
    addLocation(locations, include,
      flip ? c2 : c1, flip ? u : t,
      flip ? c1 : c2, flip ? t : u);
  } else {
    // Apply the result of the clipping to curve 1:
    const v1Clipped = Curve.getPart(v1, tMinClip, tMaxClip);
    const uDiff = uMax - uMin;
    
    // Subdivide the curve which has converged the least.
    if (tMaxClip - tMinClip > 0.8) {
      // Subdivide the curve which has converged the least.
      if (tMaxNew - tMinNew > uDiff) {
        // Subdivide curve 1
        const parts = Curve.subdivide(v1Clipped, 0.5);
        const t = (tMinNew + tMaxNew) / 2;
        calls = addCurveIntersections(
          v2, parts[0], c2, c1, locations, include, !flip,
          recursion, calls, uMin, uMax, tMinNew, t);
        calls = addCurveIntersections(
          v2, parts[1], c2, c1, locations, include, !flip,
          recursion, calls, uMin, uMax, t, tMaxNew);
      } else {
        // Subdivide curve 2
        const parts = Curve.subdivide(v2, 0.5);
        const u = (uMin + uMax) / 2;
        calls = addCurveIntersections(
          parts[0], v1Clipped, c2, c1, locations, include, !flip,
          recursion, calls, uMin, u, tMinNew, tMaxNew);
        calls = addCurveIntersections(
          parts[1], v1Clipped, c2, c1, locations, include, !flip,
          recursion, calls, u, uMax, tMinNew, tMaxNew);
      }
    } else { // Iterate
      // For some unclear reason we need to check against uDiff === 0
      // here, to prevent a regression from happening, see #1638.
      if (uDiff === 0 || uDiff >= fatLineEpsilon) {
        calls = addCurveIntersections(
          v2, v1Clipped, c2, c1, locations, include, !flip,
          recursion, calls, uMin, uMax, tMinNew, tMaxNew);
      } else {
        // The interval on the other curve is already tight enough,
        // therefore we keep iterating on the same curve.
        calls = addCurveIntersections(
          v1Clipped, v2, c1, c2, locations, include, flip,
          recursion, calls, tMinNew, tMaxNew, uMin, uMax);
      }
    }
  }
  
  return calls;
}

/**
 * Calculate the convex hull for the non-parametric bezier curve
 */
export function getConvexHull(dq0: number, dq1: number, dq2: number, dq3: number): [number[][], number[][]] {
  const p0 = [0, dq0];
  const p1 = [1/3, dq1];
  const p2 = [2/3, dq2];
  const p3 = [1, dq3];
  
  // Find vertical signed distance of p1 and p2 from line [p0, p3]
  const dist1 = dq1 - (2 * dq0 + dq3) / 3;
  const dist2 = dq2 - (dq0 + 2 * dq3) / 3;
  
  let hull: [number[][], number[][]];
  
  // Check if p1 and p2 are on the opposite side of the line [p0, p3]
  if (dist1 * dist2 < 0) {
    // p1 and p2 lie on different sides of [p0, p3]. The hull is a
    // quadrilateral and line [p0, p3] is NOT part of the hull so we are
    // pretty much done here. The top part includes p1, we will reverse
    // it later if that is not the case.
    hull = [[p0, p1, p3], [p0, p2, p3]];
  } else {
    // p1 and p2 lie on the same sides of [p0, p3]. The hull can be a
    // triangle or a quadrilateral and line [p0, p3] is part of the
    // hull. Check if the hull is a triangle or a quadrilateral. We have
    // a triangle if the vertical distance of one of the middle points
    // (p1, p2) is equal or less than half the vertical distance of the
    // other middle point.
    const distRatio = dist1 / dist2;
    hull = [
      // p2 is inside, the hull is a triangle.
      distRatio >= 2 ? [p0, p1, p3]
      // p1 is inside, the hull is a triangle.
      : distRatio <= 0.5 ? [p0, p2, p3]
      // Hull is a quadrilateral, we need all lines in correct order.
      : [p0, p1, p2, p3],
      // Line [p0, p3] is part of the hull.
      [p0, p3]
    ];
  }
  
  // Flip hull if dist1 is negative or if it is zero and dist2 is negative
  return (dist1 || dist2) < 0 ? hull.reverse() as [number[][], number[][]] : hull;
}

/**
 * Clips the convex-hull and returns [tMin, tMax] for the curve contained
 */
export function clipConvexHull(hullTop: number[][], hullBottom: number[][], dMin: number, dMax: number): number | null {
  if (hullTop[0][1] < dMin) {
    // Left of hull is below dMin, walk through the hull until it
    // enters the region between dMin and dMax
    return clipConvexHullPart(hullTop, true, dMin);
  } else if (hullBottom[0][1] > dMax) {
    // Left of hull is above dMax, walk through the hull until it
    // enters the region between dMin and dMax
    return clipConvexHullPart(hullBottom, false, dMax);
  } else {
    // Left of hull is between dMin and dMax, no clipping possible
    return hullTop[0][0];
  }
}

/**
 * Clips a part of the convex hull against the given threshold
 */
export function clipConvexHullPart(
  part: number[][],
  top: boolean,
  threshold: number
): number | null {
  let px = part[0][0];
  let py = part[0][1];
  
  for (let i = 1, l = part.length; i < l; i++) {
    const qx = part[i][0];
    const qy = part[i][1];
    
    if (top ? qy >= threshold : qy <= threshold) {
      return qy === threshold ? qx
              : px + (threshold - py) * (qx - px) / (qy - py);
    }
    
    px = qx;
    py = qy;
  }
  
  // All points of hull are above / below the threshold
  return null;
}