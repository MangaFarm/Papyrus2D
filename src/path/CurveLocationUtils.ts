/**
 * CurveLocationUtils: 曲線上の点の位置情報や交点計算に関連する機能
 * Curve.tsから分離した静的位置計算関数群
 */

import { Point } from '../basic/Point';
import { Curve } from './Curve';
import { CurveLocation } from './CurveLocation';
import { Numerical } from '../util/Numerical';
import { CurveCalculation } from './CurveCalculation';
import { CurveGeometry } from './CurveGeometry';

export class CurveLocationUtils {
  /**
   * 曲線上の点のtパラメータを取得
   * paper.jsのgetTimeOf実装を移植
   */
  static getTimeOf(v: number[], point: Point): number | null {
    // paper.jsの完全実装に合わせる
    // まず端点との距離をチェック
    const p0 = new Point(v[0], v[1]);
    const p3 = new Point(v[6], v[7]);
    const epsilon = Numerical.EPSILON;
    const geomEpsilon = Numerical.GEOMETRIC_EPSILON;
    
    // 端点が十分近い場合は早期リターン
    if (point.isClose(p0, epsilon)) return 0;
    if (point.isClose(p3, epsilon)) return 1;
    
    // x座標とy座標それぞれについて、曲線上の点と与えられた点の距離が
    // 最小になる t を求める
    const coords = [point.x, point.y];
    const roots: number[] = [];
    
    for (let c = 0; c < 2; c++) {
      // 三次方程式を解く
      const count = Numerical.solveCubic(
        3 * (-v[c] + 3 * v[c + 2] - 3 * v[c + 4] + v[c + 6]),
        6 * (v[c] - 2 * v[c + 2] + v[c + 4]),
        3 * (-v[c] + v[c + 2]),
        v[c] - coords[c],
        roots, { min: 0, max: 1 }
      );
      
      // 各解について、曲線上の点と与えられた点の距離をチェック
      for (let i = 0; i < count; i++) {
        const t = roots[i];
        const p = CurveCalculation.getPoint(v, t);
        if (point.isClose(p, geomEpsilon)) {
          return t;
        }
      }
    }
    
    // 端点が十分近い場合は幾何学的イプシロンでも確認
    if (point.isClose(p0, geomEpsilon)) return 0;
    if (point.isClose(p3, geomEpsilon)) return 1;
    
    return null;
  }

  /**
   * 曲線上の最も近い点のtパラメータを取得
   * paper.jsのgetNearestTime実装を移植
   */
  static getNearestTime(v: number[], point: Point): number {
    if (CurveGeometry.isStraight(v)) {
      const x0 = v[0], y0 = v[1];
      const x3 = v[6], y3 = v[7];
      const vx = x3 - x0, vy = y3 - y0;
      const det = vx * vx + vy * vy;
      
      // ゼロ除算を避ける
      if (det === 0) return 0;
      
      // 点を線上に投影し、線形パラメータuを計算: u = (point - p1).dot(v) / v.dot(v)
      const u = ((point.x - x0) * vx + (point.y - y0) * vy) / det;
      
      if (u < Numerical.EPSILON) return 0;
      if (u > (1 - Numerical.EPSILON)) return 1;
      
      const timeOf = CurveLocationUtils.getTimeOf(v, new Point(x0 + u * vx, y0 + u * vy));
      return timeOf !== null ? timeOf : 0;
    }
    
    const count = 100;
    let minDist = Infinity;
    let minT = 0;
    
    function refine(t: number): boolean {
      if (t >= 0 && t <= 1) {
        const p = CurveCalculation.getPoint(v, t);
        const dist = point.getDistance(p, true);
        if (dist < minDist) {
          minDist = dist;
          minT = t;
          return true;
        }
      }
      return false;
    }
    
    for (let i = 0; i <= count; i++) {
      refine(i / count);
    }
    
    // 解を反復的に精製して所望の精度に達するまで
    let step = 1 / (count * 2);
    while (step > Numerical.CURVETIME_EPSILON) {
      if (!refine(minT - step) && !refine(minT + step)) {
        step /= 2;
      }
    }
    
    return minT;
  }

  /**
   * 三次方程式を解く
   * paper.jsのsolveCubic実装を移植
   */
  static solveCubic(a: number, b: number, c: number, d: number, roots: number[], min?: number, max?: number): number {
    // Numerical.solveCubicを使用
    return Numerical.solveCubic(a, b, c, d, roots, min !== undefined && max !== undefined ? { min, max } : undefined);
  }
}