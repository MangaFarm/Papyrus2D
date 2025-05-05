/**
 * CurveIntersectionSpecial
 * 特殊ケース（直線など）の交点計算関数を提供するユーティリティ
 */

import { Curve, CurveLocation } from './Curve';
import { Numerical } from '../util/Numerical';
import { Point } from '../basic/Point';
import { Line } from '../basic/Line';
import { addLocation } from './CurveIntersectionBase';
import { getOverlaps } from './CurveIntersectionMain';

/**
 * paper.jsのaddLineIntersection実装
 * PATHITEM_INTERSECTIONS.mdに記載されている実装を使用
 */
export function addLineIntersection(
  v1: number[], v2: number[],
  c1: Curve, c2: Curve,
  locations: CurveLocation[],
  include?: (loc: CurveLocation) => boolean,
  flip?: boolean
): CurveLocation[] {
  // オーバーラップ（重なり）を検出
  const overlaps = getOverlaps(v1, v2);
  if (overlaps) {
    console.log('DEBUG: overlaps', overlaps);
    for (const [t1, t2] of overlaps) {
      addLocation(locations, include, c1, t1, c2, t2, true);
    }
    return locations;
  }
  // paper.jsのLine.intersect関数を使用
  const pt = Line.intersect(
    v1[0], v1[1], v1[6], v1[7],
    v2[0], v2[1], v2[6], v2[7],
    true // asVector - Papyrus2DのAPIでは必須
  );
  console.log('DEBUG: addLineIntersection', v1[0], v1[1], v1[6], v1[7], v2[0], v2[1], v2[6], v2[7], 'pt:', pt);
  
  if (pt) {
    addLocation(locations, include,
      flip ? c2 : c1, flip ? Curve.getTimeOf(v2, pt) : Curve.getTimeOf(v1, pt),
      flip ? c1 : c2, flip ? Curve.getTimeOf(v1, pt) : Curve.getTimeOf(v2, pt));
  }
  
  return locations;
}

/**
 * paper.jsのaddCurveLineIntersections実装
 * PATHITEM_INTERSECTIONS.mdに記載されている実装を使用
 */
export function addCurveLineIntersections(
  v1: number[], v2: number[],
  c1: Curve, c2: Curve,
  locations: CurveLocation[],
  include?: (loc: CurveLocation) => boolean,
  flip?: boolean
): CurveLocation[] {
  // addCurveLineIntersectionsは、v1が常に曲線でv2が直線になるように呼び出される
  // flipは、addLocationへの呼び出しで曲線を反転する必要があるかどうかを示す
  const x1 = v2[0], y1 = v2[1];
  const x2 = v2[6], y2 = v2[7];
  const dx = x2 - x1;
  const dy = y2 - y1;
  
  // getCurveLineIntersectionsの実装
  // paper.jsと同じアルゴリズムを使用
  const getCurveLineIntersections = (v: number[], px: number, py: number, vx: number, vy: number): number[] => {
    const isZero = Numerical.isZero;
    if (isZero(vx) && isZero(vy)) {
      // 方向のない直線（点）の場合
      const t = Curve.getTimeOf(v, new Point(px, py));
      return t === null ? [] : [t];
    }
    
    // x軸に対する角度を計算
    const angle = Math.atan2(-vy, vx);
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    
    // 回転した曲線の値を計算
    const rv: number[] = [];
    const roots: number[] = [];
    
    for (let i = 0; i < 8; i += 2) {
      const x = v[i] - px;
      const y = v[i + 1] - py;
      rv.push(
        x * cos - y * sin,
        x * sin + y * cos
      );
    }
    
    // y = 0 について解く
    // Papyrus2DのNumerical.solveCubicは異なるシグネチャを持つ
    Numerical.solveCubic(
      rv[1] - 3 * rv[3] + 3 * rv[5] - rv[7],
      3 * (rv[3] - 2 * rv[5] + rv[7]),
      3 * (rv[5] - rv[7]),
      rv[7],
      roots,
      { min: 0, max: 1 }
    );
    
    return roots;
  };
  
  // 曲線と直線の交点を計算
  const roots = getCurveLineIntersections(v1, x1, y1, x2 - x1, y2 - y1);
  
  // 各解について、実際の曲線上の点と、それに対応する直線上の位置を取得
  for (let i = 0; i < roots.length; i++) {
    const t1 = roots[i];
    const p1 = Curve.getPoint(v1, t1);
    const t2 = Curve.getTimeOf(v2, p1);
    
    if (t2 !== null) {
      // paper.jsと同様に、addLocationを呼び出す
      addLocation(locations, include,
        flip ? c2 : c1, flip ? t2 : t1,
        flip ? c1 : c2, flip ? t1 : t2);
    }
  }
  
  return locations;
}