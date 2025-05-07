/**
 * CurveIntersectionSpecial
 * 特殊ケース（直線など）の交点計算関数を提供するユーティリティ
 */

import { Curve } from './Curve';
import { CurveLocation } from './CurveLocation';
import { Numerical } from '../util/Numerical';
import { Point } from '../basic/Point';
import { Line } from '../basic/Line';
import { addLocation } from './CurveIntersectionBase';

export function getCurveLineIntersections(
  v: number[],
  px: number,
  py: number,
  vx: number,
  vy: number
): number[] {
  var isZero = Numerical.isZero;
  if (isZero(vx) && isZero(vy)) {
      // Handle special case of a line with no direction as a point,
      // and check if it is on the curve.
      var t = Curve.getTimeOf(v, new Point(px, py));
      return t === null ? [] : [t];
  }
  // Calculate angle to the x-axis (1, 0).
  var angle = Math.atan2(-vy, vx),
      sin = Math.sin(angle),
      cos = Math.cos(angle),
      // (rlx1, rly1) = (0, 0)
      // Calculate the curve values of the rotated curve.
      rv: number[] = [],
      roots = [];
  for (var i = 0; i < 8; i += 2) {
      var x = v[i] - px,
          y = v[i + 1] - py;
      rv.push(
          x * cos - y * sin,
          x * sin + y * cos);
  }
  // Solve it for y = 0. We need to include t = 0, 1 and let addLocation()
  // do the filtering, to catch important edge cases.
  Curve.solveCubic(rv, 1, 0, roots, 0, 1);
  return roots;
}


export function addLineIntersection(
  v1: number[],
  v2: number[],
  c1: Curve,
  c2: Curve,
  locations: CurveLocation[],
  include: (loc: CurveLocation) => boolean
): void {
  // paper.js本家同様、nullチェックせず!で扱う
  const pt = Line.intersect(
    v1[0], v1[1], v1[6], v1[7],
    v2[0], v2[1], v2[6], v2[7],
    false, false
  );
  if (pt) {
    addLocation(
      locations,
      include,
      c1,
      Curve.getTimeOf(v1, pt!),
      c2,
      Curve.getTimeOf(v2, pt!),
      false
    );
  }
}

/**
 * paper.jsのaddCurveLineIntersections実装
 * PATHITEM_INTERSECTIONS.mdに記載されている実装を使用
 */
export function addCurveLineIntersections(
  v1: number[],
  v2: number[],
  c1: Curve,
  c2: Curve,
  locations: CurveLocation[],
  include: (loc: CurveLocation) => boolean,
  flip: boolean
): CurveLocation[] {
  // addCurveLineIntersections() is called so that v1 is always the curve
  // and v2 the line. flip indicates whether the curves need to be flipped
  // in the call to addLocation().
  const x1 = v2[0];
  const y1 = v2[1];
  const x2 = v2[6];
  const y2 = v2[7];
  const roots: number[] = getCurveLineIntersections(v1, x1, y1, x2 - x1, y2 - y1);
  // NOTE: count could be -1 for infinite solutions, but that should only
  // happen with lines, in which case we should not be here.
  for (let i = 0, l = roots.length; i < l; i++) {
    // For each found solution on the rotated curve, get the point on
    // the real curve and with that the location on the line.
    const t1 = roots[i];
    const p1 = Curve.getPoint(v1, t1);
    const t2 = Curve.getTimeOf(v2, p1);
    if (t2 !== null) {
      // Only use the time values if there was no recursion, and let
      // addLocation() figure out the actual time values otherwise.
      addLocation(
        locations,
        include,
        flip ? c2 : c1,
        flip ? t2 : t1,
        flip ? c1 : c2,
        flip ? t1 : t2
      );
    }
  }
  return locations;
}

