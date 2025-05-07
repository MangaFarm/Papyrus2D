/**
 * CurveIntersectionSpecial
 * 特殊ケース（直線など）の交点計算関数を提供するユーティリティ
 */

import { Curve } from './Curve';
import { CurveLocation } from './CurveLocation';
import { Numerical } from '../util/Numerical';
import { Point } from '../basic/Point';
import { Line } from '../basic/Line';
import { addLocation, addCurveIntersections } from './CurveIntersectionBase';
import { getOverlaps } from './CurveIntersectionMain';
import { propagateWinding } from './PathBooleanWinding';
import { getMeta } from './SegmentMeta';

export function addLineIntersection(
  v1: number[],
  v2: number[],
  c1: Curve,
  c2: Curve,
  locations: CurveLocation[],
  include: (loc: CurveLocation) => boolean
): void {
  var pt = Line.intersect(v1[0], v1[1], v1[6], v1[7], v2[0], v2[1], v2[6], v2[7], false, false);
  if (pt) {
    addLocation(locations, include, c1, Curve.getTimeOf(v1, pt), c2, Curve.getTimeOf(v2, pt), false);
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
  // Avoid checking curves if completely out of control bounds.
  var epsilon = /*#=*/ Numerical.EPSILON,
    min = Math.min,
    max = Math.max;

  if (
    max(v1[0], v1[2], v1[4], v1[6]) + epsilon > min(v2[0], v2[2], v2[4], v2[6]) &&
    min(v1[0], v1[2], v1[4], v1[6]) - epsilon < max(v2[0], v2[2], v2[4], v2[6]) &&
    max(v1[1], v1[3], v1[5], v1[7]) + epsilon > min(v2[1], v2[3], v2[5], v2[7]) &&
    min(v1[1], v1[3], v1[5], v1[7]) - epsilon < max(v2[1], v2[3], v2[5], v2[7])
  ) {
    // Now detect and handle overlaps:
    var overlaps = getOverlaps(v1, v2);
    if (overlaps) {
      for (var i = 0; i < 2; i++) {
        var overlap = overlaps[i];
        addLocation(locations, include, c1, overlap[0], c2, overlap[1], true);
      }
    } else {
      var straight1 = Curve.isStraight(v1),
        straight2 = Curve.isStraight(v2),
        straight = straight1 && straight2,
        flip = straight1 && !straight2,
        before = locations.length;
      // Determine the correct intersection method based on whether
      // one or curves are straight lines:
      (straight
        ? addLineIntersection
        : straight1 || straight2
          ? addCurveLineIntersections
          : addCurveIntersections)(
        flip ? v2 : v1,
        flip ? v1 : v2,
        flip ? c2 : c1,
        flip ? c1 : c2,
        locations,
        include,
        flip,
        // Define the defaults for these parameters of
        // addCurveIntersections():
        // recursion, calls, tMin, tMax, uMin, uMax
        0,
        0,
        0,
        1,
        0,
        1
      );
      // Handle the special case where the first curve's start- / end-
      // point overlaps with the second curve's start- / end-point,
      // but only if haven't found a line-line intersection already:
      // #805#issuecomment-148503018
      if (!straight || locations.length === before) {
        for (var i = 0; i < 4; i++) {
          var t1 = i >> 1, // 0, 0, 1, 1
            t2 = i & 1, // 0, 1, 0, 1
            i1 = t1 * 6,
            i2 = t2 * 6,
            p1 = new Point(v1[i1], v1[i1 + 1]),
            p2 = new Point(v2[i2], v2[i2 + 1]);
          if (p1.isClose(p2, epsilon)) {
            addLocation(locations, include, c1, t1, c2, t2, false);
          }
        }
      }
    }
  }
  return locations;
}
