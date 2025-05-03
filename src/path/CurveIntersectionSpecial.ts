/**
 * CurveIntersectionSpecial
 * 特殊ケース（直線など）の交点計算関数を提供するユーティリティ
 */

import { Curve, CurveLocation } from './Curve';
import { Numerical } from '../util/Numerical';
import { Point } from '../basic/Point';
import { addLocation } from './CurveIntersectionBase';

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
  // paper.jsのLine.intersect関数と同等の実装
  const pt = (() => {
    const p1x = v1[0], p1y = v1[1];
    const v1x = v1[6] - p1x, v1y = v1[7] - p1y;
    const p2x = v2[0], p2y = v2[1];
    const v2x = v2[6] - p2x, v2y = v2[7] - p2y;
    
    const cross = v1x * v2y - v1y * v2x;
    
    // Avoid divisions by 0, and errors when getting too close to 0
    if (!Numerical.isMachineZero(cross)) {
      const dx = p1x - p2x,
            dy = p1y - p2y,
            u1 = (v2x * dy - v2y * dx) / cross,
            u2 = (v1x * dy - v1y * dx) / cross,
            // Check the ranges of the u parameters with EPSILON tolerance
            epsilon = Numerical.EPSILON,
            uMin = -epsilon,
            uMax = 1 + epsilon;
            
      if (uMin < u1 && u1 < uMax && uMin < u2 && u2 < uMax) {
        // Address the tolerance at the bounds by clipping
        const u = u1 <= 0 ? 0 : u1 >= 1 ? 1 : u1;
        return new Point(
          p1x + u * v1x,
          p1y + u * v1y
        );
      }
    }
    return null;
  })();
  
  if (pt) {
    // paper.jsでは、ここで直接パラメータを計算して、
    // 線分が直線の場合は、単純なベクトル計算で
    // パラメータ値を計算します（paper.jsのgetTimeOfと同等）
    let t1: number | null = null;
    let t2: number | null = null;
    
    // 直線の場合の特別な処理（paper.jsのアプローチに基づく）
    if (Curve.isStraight(v1)) {
      // 直線の長さとベクトル
      const p1 = new Point(v1[0], v1[1]);
      const p2 = new Point(v1[6], v1[7]);
      const line = p2.subtract(p1);
      const lengthSquared = line.x * line.x + line.y * line.y;
      
      if (lengthSquared > Numerical.EPSILON) {
        // 線分上のパラメータ値を計算
        const vec = pt.subtract(p1);
        t1 = (vec.x * line.x + vec.y * line.y) / lengthSquared;
        
        // パラメータ値が[0,1]の範囲に収まるか確認
        if (t1 < 0 - Numerical.GEOMETRIC_EPSILON || t1 > 1 + Numerical.GEOMETRIC_EPSILON) {
          t1 = null;
        } else if (t1 < 0) {
          t1 = 0;
        } else if (t1 > 1) {
          t1 = 1;
        }
      }
    } else {
      // 曲線の場合は通常のgetTimeOfを使用
      t1 = Curve.getTimeOf(v1, pt);
    }
    
    // v2にも同様の処理を適用
    if (Curve.isStraight(v2)) {
      const p1 = new Point(v2[0], v2[1]);
      const p2 = new Point(v2[6], v2[7]);
      const line = p2.subtract(p1);
      const lengthSquared = line.x * line.x + line.y * line.y;
      
      if (lengthSquared > Numerical.EPSILON) {
        const vec = pt.subtract(p1);
        t2 = (vec.x * line.x + vec.y * line.y) / lengthSquared;
        
        if (t2 < 0 - Numerical.GEOMETRIC_EPSILON || t2 > 1 + Numerical.GEOMETRIC_EPSILON) {
          t2 = null;
        } else if (t2 < 0) {
          t2 = 0;
        } else if (t2 > 1) {
          t2 = 1;
        }
      }
    } else {
      t2 = Curve.getTimeOf(v2, pt);
    }

    // paper.jsと同じように、t1とt2がどちらもnullでなければ交点を追加
    addLocation(locations, include,
      flip ? c2 : c1, flip ? t2 : t1,
      flip ? c1 : c2, flip ? t1 : t2);
    
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
  const getCurveLineIntersections = (v: number[], px: number, py: number, dx: number, dy: number): number[] => {
    // 曲線と直線の交点を求める
    const roots: number[] = [];
    
    // 直線が垂直または水平の場合の特別処理
    if (Math.abs(dx) < Numerical.EPSILON) {
      // 垂直線 x = px
      const txs: number[] = [];
      Numerical.solveCubic(
        v[0] - 3 * v[2] + 3 * v[4] - v[6],
        3 * (v[2] - 2 * v[4] + v[6]),
        3 * (v[4] - v[6]),
        v[6] - px,
        txs, { min: 0, max: 1 }
      );
      
      // 有効な解のみを追加
      for (const t of txs) {
        if (t >= 0 && t <= 1) {
          // 交点が線分上にあるかチェック
          const y = Curve.evaluate(v, t).y;
          if (Math.min(py, py + dy) - Numerical.EPSILON <= y &&
              y <= Math.max(py, py + dy) + Numerical.EPSILON) {
            roots.push(t);
          }
        }
      }
    } else if (Math.abs(dy) < Numerical.EPSILON) {
      // 水平線 y = py
      const tys: number[] = [];
      Numerical.solveCubic(
        v[1] - 3 * v[3] + 3 * v[5] - v[7],
        3 * (v[3] - 2 * v[5] + v[7]),
        3 * (v[5] - v[7]),
        v[7] - py,
        tys, { min: 0, max: 1 }
      );
      
      // 有効な解のみを追加
      for (const t of tys) {
        if (t >= 0 && t <= 1) {
          // 交点が線分上にあるかチェック
          const x = Curve.evaluate(v, t).x;
          if (Math.min(px, px + dx) - Numerical.EPSILON <= x &&
              x <= Math.max(px, px + dx) + Numerical.EPSILON) {
            roots.push(t);
          }
        }
      }
    } else {
      // 一般的な直線
      // 曲線上の点と直線の距離関数の係数を計算
      const tempRoots: number[] = [];
      Numerical.solveCubic(
        dy * (v[0] - 3 * v[2] + 3 * v[4] - v[6]) - dx * (v[1] - 3 * v[3] + 3 * v[5] - v[7]),
        3 * (dy * (v[2] - 2 * v[4] + v[6]) - dx * (v[3] - 2 * v[5] + v[7])),
        3 * (dy * (v[4] - v[6]) - dx * (v[5] - v[7])),
        dy * (v[6] - px) - dx * (v[7] - py),
        tempRoots, { min: 0, max: 1 }
      );
      
      // 有効な解のみを追加
      for (const t of tempRoots) {
        if (t >= 0 && t <= 1) {
          // 交点が線分上にあるかチェック
          const p = Curve.evaluate(v, t);
          const s = dx !== 0 ?
            (p.x - px) / dx :
            (p.y - py) / dy;
          
          if (s >= -Numerical.EPSILON && s <= 1 + Numerical.EPSILON) {
            roots.push(t);
          }
        }
      }
    }
    
    return roots;
  };
  
  // 曲線と直線の交点を計算
  const roots = getCurveLineIntersections(v1, x1, y1, x2 - x1, y2 - y1);
  
  // 各解について、実際の曲線上の点と、それに対応する直線上の位置を取得
  for (let i = 0; i < roots.length; i++) {
    const t1 = roots[i];
    const p1 = Curve.evaluate(v1, t1);
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