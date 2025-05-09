/**
 * CurveIntersectionMain
 * 曲線交点計算のメイン関数を提供するユーティリティ
 */
import { Curve } from './Curve';
import { CurveLocation } from './CurveLocation';
import { Numerical } from '../util/Numerical';
import { Point } from '../basic/Point';
import { Line } from '../basic/Line';
import { Matrix } from '../basic/Matrix';
import { CollisionDetection } from '../util/CollisionDetection';
import { CurveSubdivision } from './CurveSubdivision';
import { addLocation, getSelfIntersection } from './CurveIntersectionBase';
import { addLineIntersection, addCurveLineIntersections } from './CurveIntersectionSpecial';
import { addCurveIntersections } from './CurveIntersectionConvexHull';

/**
 * 曲線同士の交点計算
 * paper.jsのgetCurveIntersections実装を移植
 */
export function getCurveIntersections(
  v1: number[],
  v2: number[],
  c1: Curve,
  c2: Curve,
  locations: CurveLocation[],
  include: (loc: CurveLocation) => boolean
): CurveLocation[] {
  // 境界ボックスが完全に外れている場合はチェックしない
  const epsilon = Numerical.GEOMETRIC_EPSILON;
  const min = Math.min;
  const max = Math.max;

  // Paper.jsと同様の境界ボックスチェック - 正確に同じ条件判定を使用
  const aabbCheck =
    max(v1[0], v1[2], v1[4], v1[6]) + epsilon > min(v2[0], v2[2], v2[4], v2[6]) &&
    min(v1[0], v1[2], v1[4], v1[6]) - epsilon < max(v2[0], v2[2], v2[4], v2[6]) &&
    max(v1[1], v1[3], v1[5], v1[7]) + epsilon > min(v2[1], v2[3], v2[5], v2[7]) &&
    min(v1[1], v1[3], v1[5], v1[7]) - epsilon < max(v2[1], v2[3], v2[5], v2[7]);
  if (!aabbCheck) {
  }
  if (aabbCheck) {
    // オーバーラップの検出と処理
    const overlaps = getOverlaps(v1, v2);
    if (overlaps) {
      for (let i = 0; i < overlaps.length; i++) {
        const overlap = overlaps[i];
        addLocation(locations, include, c1, overlap[0], c2, overlap[1], true);
      }
    } else {
      const straight1 = Curve.isStraight(v1);
      const straight2 = Curve.isStraight(v2);
      const straight = straight1 && straight2;
      const flip = straight1 && !straight2;
      const before = locations.length;

      // 直線か曲線かに基づいて適切な交点計算メソッドを決定
      if (straight) {
        addLineIntersection(
          flip ? v2 : v1,
          flip ? v1 : v2,
          flip ? c2 : c1,
          flip ? c1 : c2,
          locations,
          include
        );
      } else if (straight1 || straight2) {
        addCurveLineIntersections(
          flip ? v2 : v1,
          flip ? v1 : v2,
          flip ? c2 : c1,
          flip ? c1 : c2,
          locations,
          include,
          flip
        );
      } else {
        addCurveIntersections(
          flip ? v2 : v1,
          flip ? v1 : v2,
          flip ? c2 : c1,
          flip ? c1 : c2,
          locations,
          include,
          flip,
          0,
          0,
          0,
          1,
          0,
          1
        );
      }

      // 端点が重なる特殊ケースの処理
      if (!straight || locations.length === before) {
        for (let i = 0; i < 4; i++) {
          const t1 = i >> 1,
            t2 = i & 1;
          const i1 = t1 * 6,
            i2 = t2 * 6;
          const p1 = new Point(v1[i1], v1[i1 + 1]);
          const p2 = new Point(v2[i2], v2[i2 + 1]);
          if (p1.isClose(p2, epsilon)) {
            addLocation(locations, include, c1, t1, c2, t2, false);
          }
        }
      }
    }
  }

  return locations;
}

/**
 * paper.jsのgetOverlaps実装
 * 直線同士が共線かつ区間が重なっていればoverlapを返す
 */
/**
 * Code to detect overlaps of intersecting based on work by
 * @iconexperience in #648
 */
export function getOverlaps(v1: number[], v2: number[]): [number, number][] | null {
  // Linear curves can only overlap if they are collinear. Instead of
  // using the #isCollinear() check, we pick the longer of the two curves
  // treated as lines, and see how far the starting and end points of the
  // other line are from this line (assumed as an infinite line). But even
  // if the curves are not straight, they might just have tiny handles
  // within geometric epsilon distance, so we have to check for that too.

  function getSquaredLineLength(v: number[]) {
    var x = v[6] - v[0],
      y = v[7] - v[1];
    return x * x + y * y;
  }

  const abs = Math.abs;
  const getDistance = Line.getDistance;
  const timeEpsilon = Numerical.CURVETIME_EPSILON;
  const geomEpsilon = Numerical.GEOMETRIC_EPSILON;
  let straight1 = Curve.isStraight(v1);
  let straight2 = Curve.isStraight(v2);
  let straightBoth = straight1 && straight2;
  let flip = getSquaredLineLength(v1) < getSquaredLineLength(v2);
  let l1 = flip ? v2 : v1;
  let l2 = flip ? v1 : v2;
  // Get l1 start and end point values for faster referencing.
  let px = l1[0],
    py = l1[1],
    vx = l1[6] - px,
    vy = l1[7] - py;
  // See if the starting and end point of curve two are very close to the
  // picked line. Note that the curve for the picked line might not
  // actually be a line, so we have to perform more checks after.
  if (
    getDistance(px, py, vx, vy, l2[0], l2[1], true) < geomEpsilon &&
    getDistance(px, py, vx, vy, l2[6], l2[7], true) < geomEpsilon
  ) {
    // If not both curves are straight, check against both of their
    // handles, and treat them as straight if they are very close.
    if (
      !straightBoth &&
      getDistance(px, py, vx, vy, l1[2], l1[3], true) < geomEpsilon &&
      getDistance(px, py, vx, vy, l1[4], l1[5], true) < geomEpsilon &&
      getDistance(px, py, vx, vy, l2[2], l2[3], true) < geomEpsilon &&
      getDistance(px, py, vx, vy, l2[4], l2[5], true) < geomEpsilon
    ) {
      straight1 = straight2 = straightBoth = true;
    }
  } else if (straightBoth) {
    // If both curves are straight and not very close to each other,
    // there can't be a solution.
    return null;
  }
  if (straight1 !== straight2) {
    // If one curve is straight, the other curve must be straight too,
    // otherwise they cannot overlap.
    return null;
  }

  const v = [v1, v2];
  let pairs: [number, number][] | null = [];
  // Iterate through all end points:
  // First p1 of curve 1 & 2, then p2 of curve 1 & 2.
  for (let i = 0; i < 4 && (pairs as [number, number][]).length < 2; i++) {
    let i1 = i & 1, // 0, 1, 0, 1
      i2 = i1 ^ 1, // 1, 0, 1, 0
      t1 = i >> 1, // 0, 0, 1, 1
      t2 = Curve.getTimeOf(v[i1], new Point(v[i2][t1 ? 6 : 0], v[i2][t1 ? 7 : 1]));
    if (t2 != null) {
      // If point is on curve
      let pair: [number, number] = i1 ? [t1, t2] : [t2, t1];
      // Filter out tiny overlaps.
      if (
        !(pairs as [number, number][]).length ||
        (abs(pair[0] - (pairs as [number, number][])[0][0]) > timeEpsilon &&
          abs(pair[1] - (pairs as [number, number][])[0][1]) > timeEpsilon)
      ) {
        (pairs as [number, number][]).push(pair);
      }
    }
    // We checked 3 points but found no match, curves can't overlap.
    if (i > 2 && !(pairs as [number, number][]).length) break;
  }
  // 端点一致が1組でもあればoverlapとして返す（paper.js互換）
  if ((pairs as [number, number][]).length >= 1) {
    return pairs as [number, number][];
  } else if (!straightBoth) {
    // Straight pairs don't need further checks. If we found 2 pairs,
    // the end points on v1 & v2 should be the same.
    // Curve.getPart → CurveSubdivision.getPart で代用
    let o1 = CurveSubdivision.getPart(
      v1,
      (pairs as [number, number][])[0][0],
      (pairs as [number, number][])[1][0]
    );
    let o2 = CurveSubdivision.getPart(
      v2,
      (pairs as [number, number][])[0][1],
      (pairs as [number, number][])[1][1]
    );
    if (
      abs(o2[2] - o1[2]) > geomEpsilon ||
      abs(o2[3] - o1[3]) > geomEpsilon ||
      abs(o2[4] - o1[4]) > geomEpsilon ||
      abs(o2[5] - o1[5]) > geomEpsilon
    )
      return null;
  }
  return null;
}

/**
 * 2つの曲線の交点を計算（カーブ配列同士）
 * paper.jsのgetIntersections実装
 */
export function getIntersections(
  curves1: Curve[],
  curves2: Curve[] | null,
  include: (loc: CurveLocation) => boolean,
  matrix1?: Matrix | null,
  matrix2?: Matrix | null,
  _returnFirst?: boolean
): CurveLocation[] {
console.log('🔥Curve.getIntersections');
  var epsilon = /*#=*/ Numerical.GEOMETRIC_EPSILON,
    self = !curves2;
  if (self) curves2 = curves1;
  var length1 = curves1.length,
    length2 = curves2!.length,
    values1 = new Array(length1),
    values2 = self ? values1 : new Array(length2),
    locations = [];

  for (var i = 0; i < length1; i++) {
    values1[i] = curves1[i].getValues(matrix1);
  }
  if (!self) {
    for (var i = 0; i < length2; i++) {
      values2[i] = curves2![i].getValues(matrix2);
    }
  }
  var boundsCollisions = CollisionDetection.findCurveBoundsCollisions(values1, values2, epsilon, false);
console.log('🔥boundsCollisions', boundsCollisions);
  for (var index1 = 0; index1 < length1; index1++) {
    var curve1 = curves1[index1],
      v1 = values1[index1];
    if (self) {
      // First check for self-intersections within the same curve.
      getSelfIntersection(v1, curve1, locations, include);
    }
    // Check for intersections with potentially intersecting curves.
    var collisions1 = boundsCollisions[index1];
    if (collisions1) {
      for (var j = 0; j < collisions1.length; j++) {
        // There might be already one location from the above
        // self-intersection check:
        if (_returnFirst && locations.length) return locations;
        var index2 = collisions1[j];
        if (!self || index2 > index1) {
          var curve2 = curves2![index2],
            v2 = values2[index2];
          getCurveIntersections(v1, v2, curve1, curve2, locations, include);
        }
      }
    }
  }
  return locations;
}
