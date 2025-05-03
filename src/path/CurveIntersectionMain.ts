/**
 * CurveIntersectionMain
 * 曲線交点計算のメイン関数を提供するユーティリティ
 */

import { Curve, CurveLocation } from './Curve';
import { Numerical } from '../util/Numerical';
import { Point } from '../basic/Point';
import { addLocation } from './CurveIntersectionBase';
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
  include?: (loc: CurveLocation) => boolean
): CurveLocation[] {
  // 境界ボックスが完全に外れている場合はチェックしない
  const epsilon = Numerical.GEOMETRIC_EPSILON;
  const min = Math.min;
  const max = Math.max;

  // Paper.jsと同様の境界ボックスチェック - 正確に同じ条件判定を使用
  if (max(v1[0], v1[2], v1[4], v1[6]) + epsilon >
      min(v2[0], v2[2], v2[4], v2[6]) &&
      min(v1[0], v1[2], v1[4], v1[6]) - epsilon <
      max(v2[0], v2[2], v2[4], v2[6]) &&
      max(v1[1], v1[3], v1[5], v1[7]) + epsilon >
      min(v2[1], v2[3], v2[5], v2[7]) &&
      min(v1[1], v1[3], v1[5], v1[7]) - epsilon <
      max(v2[1], v2[3], v2[5], v2[7])) {
    
    // オーバーラップの検出と処理
    const overlaps = getOverlaps(v1, v2);
    if (overlaps) {
      for (let i = 0; i < overlaps.length; i++) {
        const overlap = overlaps[i];
        addLocation(locations, include,
                c1, overlap[0],
                c2, overlap[1], true);
      }
    } else {
      const straight1 = Curve.isStraight(v1);
      const straight2 = Curve.isStraight(v2);
      const straight = straight1 && straight2;
      const flip = straight1 && !straight2;
      const before = locations.length;
      
      // 直線か曲線かに基づいて適切な交点計算メソッドを決定
      if (straight) {
        // 両方直線の場合
        addLineIntersection(
          flip ? v2 : v1, flip ? v1 : v2,
          flip ? c2 : c1, flip ? c1 : c2,
          locations, include, flip);
      } else if (straight1 || straight2) {
        // 片方が直線の場合
        addCurveLineIntersections(
          flip ? v2 : v1, flip ? v1 : v2,
          flip ? c2 : c1, flip ? c1 : c2,
          locations, include, flip);
      } else {
        // 両方曲線の場合
        addCurveIntersections(
          v1, v2, c1, c2, locations, include, false, 0, 0, 0, 1, 0, 1);
      }
      
      // Paper.jsと同様に、端点が重なる特殊ケースの処理を追加
      // 直線同士の交点が見つからなかった場合や、曲線の場合は端点のチェックを行う
      if (!straight || locations.length === before) {
        // 各曲線の端点をチェック
        // paper.jsと同様に、c1.getPoint1()などを使用
        const c1p1 = c1.getPoint1();
        const c1p2 = c1.getPoint2();
        const c2p1 = c2.getPoint1();
        const c2p2 = c2.getPoint2();
        
        // paper.jsと同様に、isClose()メソッドを使用して端点が近接しているかをチェック
        if (c1p1.isClose(c2p1, epsilon)) {
          addLocation(locations, include, c1, 0, c2, 0, true);
        }
        if (c1p1.isClose(c2p2, epsilon)) {
          addLocation(locations, include, c1, 0, c2, 1, true);
        }
        if (c1p2.isClose(c2p1, epsilon)) {
          addLocation(locations, include, c1, 1, c2, 0, true);
        }
        if (c1p2.isClose(c2p2, epsilon)) {
          addLocation(locations, include, c1, 1, c2, 1, true);
        }
      }
    }
  }
  
  return locations;
}

/**
 * paper.jsのgetOverlaps実装
 * PATHITEM_INTERSECTIONS.mdに記載されている実装を使用
 */
export function getOverlaps(v1: number[], v2: number[]): [number, number][] | null {
  // 線形曲線は、共線の場合にのみ重複可能
  function getSquaredLineLength(v: number[]): number {
    const x = v[6] - v[0];
    const y = v[7] - v[1];
    return x * x + y * y;
  }

  const abs = Math.abs;
  // paper.jsと完全に同じgetSignedDistance実装
  const getSignedDistance = (px: number, py: number, vx: number, vy: number, x: number, y: number): number => {
    // paper.jsの実装に合わせて修正
    // 参照: paper.js/src/basic/Line.js の getSignedDistance 関数
    return vx === 0 ? (vy > 0 ? x - px : px - x)
      : vy === 0 ? (vx < 0 ? y - py : py - y)
      : ((x - px) * vy - (y - py) * vx) / (
          vy > vx
            ? vy * Math.sqrt(1 + (vx * vx) / (vy * vy))
            : vx * Math.sqrt(1 + (vy * vy) / (vx * vx))
        );
  };
  
  const timeEpsilon = Numerical.CURVETIME_EPSILON;
  const geomEpsilon = Numerical.GEOMETRIC_EPSILON;
  let straight1 = Curve.isStraight(v1);
  let straight2 = Curve.isStraight(v2);
  let straightBoth = straight1 && straight2;
  
  // Paper.jsと同様に、常に短い方の曲線をl1とする
  const flip = getSquaredLineLength(v1) < getSquaredLineLength(v2);
  const l1 = flip ? v2 : v1;
  const l2 = flip ? v1 : v2;
  
  // l1の始点と終点の値を取得
  const px = l1[0], py = l1[1];
  const vx = l1[6] - px, vy = l1[7] - py;
  
  // 曲線2の始点と終点がl1に十分近いかチェック
  // paper.jsと同じgetSignedDistanceを使用
  if (Math.abs(getSignedDistance(px, py, vx, vy, l2[0], l2[1])) < geomEpsilon &&
      Math.abs(getSignedDistance(px, py, vx, vy, l2[6], l2[7])) < geomEpsilon) {
    // 両方の曲線が直線でない場合、ハンドルもチェック
    if (!straightBoth &&
        Math.abs(getSignedDistance(px, py, vx, vy, l1[2], l1[3])) < geomEpsilon &&
        Math.abs(getSignedDistance(px, py, vx, vy, l1[4], l1[5])) < geomEpsilon &&
        Math.abs(getSignedDistance(px, py, vx, vy, l2[2], l2[3])) < geomEpsilon &&
        Math.abs(getSignedDistance(px, py, vx, vy, l2[4], l2[5])) < geomEpsilon) {
      straight1 = straight2 = straightBoth = true;
    }
  } else if (straightBoth) {
    // 両方の曲線が直線で、互いに十分近くない場合、解はない
    return null;
  }
  
  if ((straight1 && !straight2) || (!straight1 && straight2)) {
    // 一方の曲線が直線の場合、もう一方も直線でなければオーバーラップできない
    return null;
  }

  const v = [v1, v2];
  let pairs: [number, number][] = [];
  
  // すべての端点を反復処理
  for (let i = 0; i < 4 && pairs.length < 2; i++) {
    const i1 = i & 1;  // 0, 1, 0, 1
    const i2 = i1 ^ 1; // 1, 0, 1, 0
    const t1 = i >> 1; // 0, 0, 1, 1
    const p = new Point(
      v[i2][t1 ? 6 : 0],
      v[i2][t1 ? 7 : 1]
    );
    const t2 = Curve.getTimeOf(v[i1], p);
    
    if (t2 != null) {  // 点が曲線上にある場合
      const pair: [number, number] = i1 ? [t1, t2] : [t2, t1];
      // 小さなオーバーラップをフィルタリング
      if (!pairs.length ||
          abs(pair[0] - pairs[0][0]) > timeEpsilon &&
          abs(pair[1] - pairs[0][1]) > timeEpsilon) {
        pairs.push(pair);
      }
    }
    // Paper.jsと同様に、3点をチェックしたが一致が見つからない場合は早期終了
    if (i > 2 && pairs.length === 0)
      break;
  }
  
  // Paper.jsと同様に、ペアの数をチェック
  if (pairs.length !== 2) {
    return null;
  } else if (!straightBoth) {
    // 直線ペアはさらなるチェックが不要
    // 2つのペアが見つかった場合、v1とv2の端点は同じはず
    const o1 = Curve.getPart(v1, pairs[0][0], pairs[1][0]);
    const o2 = Curve.getPart(v2, pairs[0][1], pairs[1][1]);
    // オーバーラップする曲線のハンドルも同じかチェック
    if (abs(o2[2] - o1[2]) > geomEpsilon ||
        abs(o2[3] - o1[3]) > geomEpsilon ||
        abs(o2[4] - o1[4]) > geomEpsilon ||
        abs(o2[5] - o1[5]) > geomEpsilon) {
      return null;
    }
  }
  
  return pairs;
}