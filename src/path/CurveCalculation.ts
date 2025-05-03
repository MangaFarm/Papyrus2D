/**
 * CurveCalculation: 曲線上の点や接線、法線などの計算機能
 * Curve.tsから分離した静的計算関数群
 */

import { Point } from '../basic/Point';
import { Numerical } from '../util/Numerical';

export class CurveCalculation {
  /**
   * 三次ベジェ曲線のt位置の点を返す
   * v: [x1, y1, h1x, h1y, h2x, h2y, x2, y2]
   */
  static evaluate(v: number[], t: number, type: number = 0, normalized: boolean = false): Point | null {
    // Do not produce results if parameter is out of range or invalid.
    if (t == null || t < 0 || t > 1)
      return null;
    
    const x0 = v[0], y0 = v[1],
          x1 = v[2], y1 = v[3],
          x2 = v[4], y2 = v[5],
          x3 = v[6], y3 = v[7],
          isZero = Numerical.isZero;
    
    // If the curve handles are almost zero, reset the control points to the anchors.
    let cx1 = x1, cy1 = y1, cx2 = x2, cy2 = y2;
    if (isZero(cx1 - x0) && isZero(cy1 - y0)) {
      cx1 = x0;
      cy1 = y0;
    }
    if (isZero(cx2 - x3) && isZero(cy2 - y3)) {
      cx2 = x3;
      cy2 = y3;
    }
    
    if (type === 0) {
      // type === 0: getPoint()
      // Calculate the curve point at parameter value t
      // Use special handling at t === 0 / 1, to avoid imprecisions.
      if (t === 0) return new Point(x0, y0);
      if (t === 1) return new Point(x3, y3);
      
      const mt = 1 - t;
      const mt2 = mt * mt;
      const t2 = t * t;
      const a = mt2 * mt;
      const b = 3 * mt2 * t;
      const c = 3 * mt * t2;
      const d = t * t2;
      const x = a * x0 + b * cx1 + c * cx2 + d * x3;
      const y = a * y0 + b * cy1 + c * cy2 + d * y3;
      return new Point(x, y);
    } else {
      // type === 1: getTangent()
      // type === 2: getNormal()
      // type === 3: getCurvature()
      const tMin = Numerical.CURVETIME_EPSILON,
            tMax = 1 - tMin;
      let x, y;
      
      // Prevent tangents and normals of length 0:
      // paper.jsと同じ境界条件処理を行う
      if (t < tMin) {
        // 3 * (x1 - x0), 3 * (y1 - y0)
        const cx = 3 * (cx1 - x0);
        const cy = 3 * (cy1 - y0);
        x = cx;
        y = cy;
      } else if (t > tMax) {
        // 3 * (x3 - x2), 3 * (y3 - y2)
        x = 3 * (x3 - cx2);
        y = 3 * (y3 - cy2);
      } else {
        // Calculate the polynomial coefficients.
        const cx = 3 * (cx1 - x0),
              bx = 3 * (cx2 - cx1) - cx,
              ax = x3 - x0 - cx - bx,
              cy = 3 * (cy1 - y0),
              by = 3 * (cy2 - cy1) - cy,
              ay = y3 - y0 - cy - by;
              
        x = (3 * ax * t + 2 * bx) * t + cx;
        y = (3 * ay * t + 2 * by) * t + cy;
      }
      
      if (normalized) {
        // When the tangent at t is zero and we're at the beginning
        // or the end, we can use the vector between the handles,
        // but only when normalizing as its weighted length is 0.
        if (x === 0 && y === 0 && (t < tMin || t > tMax)) {
          x = cx2 - cx1;
          y = cy2 - cy1;
        }
        // Now normalize x & y
        const len = Math.sqrt(x * x + y * y);
        if (len) {
          x /= len;
          y /= len;
        }
      }
      
      if (type === 3) {
        // Calculate 2nd derivative, and curvature from there:
        // k = |dx * d2y - dy * d2x| / (( dx^2 + dy^2 )^(3/2))
        const cx = 3 * (cx1 - x0),
              bx = 3 * (cx2 - cx1) - cx,
              ax = x3 - x0 - cx - bx,
              cy = 3 * (cy1 - y0),
              by = 3 * (cy2 - cy1) - cy,
              ay = y3 - y0 - cy - by;
              
        const x2 = 6 * ax * t + 2 * bx,
              y2 = 6 * ay * t + 2 * by,
              d = Math.pow(x * x + y * y, 3 / 2);
        // For JS optimizations we always return a Point, although
        // curvature is just a numeric value, stored in x:
        x = d !== 0 ? (x * y2 - y * x2) / d : 0;
        y = 0;
      }
      
      // The normal is simply the rotated tangent:
      return type === 2 ? new Point(y, -x) : new Point(x, y);
    }
  }

  /**
   * 曲線上の点を計算
   * paper.jsのgetPoint実装を移植
   */
  static getPoint(v: number[], t: number): Point | null {
    return CurveCalculation.evaluate(v, t, 0, false);
  }
  
  /**
   * 曲線上の正規化された接線ベクトルを計算
   * paper.jsのgetTangent実装を移植
   */
  static getTangent(v: number[], t: number): Point | null {
    return CurveCalculation.evaluate(v, t, 1, true);
  }
  
  /**
   * 曲線上の法線ベクトルを計算
   * paper.jsのgetNormal実装を移植
   */
  static getNormal(v: number[], t: number): Point | null {
    return CurveCalculation.evaluate(v, t, 2, true);
  }
  
  /**
   * 曲線上の重み付き接線ベクトルを計算
   * paper.jsのgetWeightedTangent実装を移植
   */
  static getWeightedTangent(v: number[], t: number): Point | null {
    return CurveCalculation.evaluate(v, t, 1, false);
  }
  
  /**
   * 曲線上の重み付き法線ベクトルを計算
   * paper.jsのgetWeightedNormal実装を移植
   */
  static getWeightedNormal(v: number[], t: number): Point | null {
    return CurveCalculation.evaluate(v, t, 2, false);
  }
  
  /**
   * 曲線上の曲率を計算
   * paper.jsのgetCurvature実装を移植
   */
  static getCurvature(v: number[], t: number): number {
    const result = CurveCalculation.evaluate(v, t, 3, false);
    return result ? result.x : 0;
  }

  /**
   * 指定された接線に対して曲線が接する時間パラメータを計算
   * paper.jsのgetTimesWithTangent実装を移植
   */
  static getTimesWithTangent(v: number[], tangent: Point): number[] {
    if (tangent.isZero()) {
      return [];
    }
    
    const x0 = v[0], y0 = v[1],
          x1 = v[2], y1 = v[3],
          x2 = v[4], y2 = v[5],
          x3 = v[6], y3 = v[7];
          
    const normalized = tangent.normalize();
    const tx = normalized.x;
    const ty = normalized.y;
    
    const ax = 3 * x3 - 9 * x2 + 9 * x1 - 3 * x0;
    const ay = 3 * y3 - 9 * y2 + 9 * y1 - 3 * y0;
    const bx = 6 * x2 - 12 * x1 + 6 * x0;
    const by = 6 * y2 - 12 * y1 + 6 * y0;
    const cx = 3 * x1 - 3 * x0;
    const cy = 3 * y1 - 3 * y0;
    
    const den = 2 * ax * ty - 2 * ay * tx;
    const times: number[] = [];
    
    if (Math.abs(den) < Numerical.CURVETIME_EPSILON) {
      const num = ax * cy - ay * cx;
      const den2 = ax * by - ay * bx;
      if (den2 !== 0) {
        const t = -num / den2;
        if (t >= 0 && t <= 1) {
          times.push(t);
        }
      }
    } else {
      const delta = (bx * bx - 4 * ax * cx) * ty * ty +
                   (-2 * bx * by + 4 * ay * cx + 4 * ax * cy) * tx * ty +
                   (by * by - 4 * ay * cy) * tx * tx;
      const k = bx * ty - by * tx;
      
      if (delta >= 0 && den !== 0) {
        const d = Math.sqrt(delta);
        const t0 = -(k + d) / den;
        const t1 = (-k + d) / den;
        
        if (t0 >= 0 && t0 <= 1) {
          times.push(t0);
        }
        if (t1 >= 0 && t1 <= 1) {
          times.push(t1);
        }
      }
    }
    
    return times;
  }

  /**
   * 三次ベジェ曲線のt位置の点を返す（null許容版）
   * Curve.tsから移動
   */
  static evaluateWithNull(v: number[], t: number, type: number = 0, normalized: boolean = false): Point | null {
    // Do not produce results if parameter is out of range or invalid.
    if (t == null || t < 0 || t > 1)
      return null;
    
    const x0 = v[0], y0 = v[1],
          x1 = v[2], y1 = v[3],
          x2 = v[4], y2 = v[5],
          x3 = v[6], y3 = v[7],
          isZero = Numerical.isZero;
    
    // If the curve handles are almost zero, reset the control points to the anchors.
    let cx1 = x1, cy1 = y1, cx2 = x2, cy2 = y2;
    if (isZero(cx1 - x0) && isZero(cy1 - y0)) {
      cx1 = x0;
      cy1 = y0;
    }
    if (isZero(cx2 - x3) && isZero(cy2 - y3)) {
      cx2 = x3;
      cy2 = y3;
    }
    
    // Calculate the polynomial coefficients.
    const cx = 3 * (cx1 - x0),
          bx = 3 * (cx2 - cx1) - cx,
          ax = x3 - x0 - cx - bx,
          cy = 3 * (cy1 - y0),
          by = 3 * (cy2 - cy1) - cy,
          ay = y3 - y0 - cy - by;
    
    let x, y;
    
    if (type === 0) {
      // type === 0: getPoint()
      // Calculate the curve point at parameter value t
      // Use special handling at t === 0 / 1, to avoid imprecisions.
      x = t === 0 ? x0 : t === 1 ? x3
              : ((ax * t + bx) * t + cx) * t + x0;
      y = t === 0 ? y0 : t === 1 ? y3
              : ((ay * t + by) * t + cy) * t + y0;
    } else {
      // type === 1: getTangent()
      // type === 2: getNormal()
      // type === 3: getCurvature()
      const tMin = Numerical.CURVETIME_EPSILON,
            tMax = 1 - tMin;
      
      // 1: tangent, 1st derivative
      // 2: normal, 1st derivative
      // 3: curvature, 1st derivative & 2nd derivative
      // Prevent tangents and normals of length 0:
      if (t < tMin) {
        x = cx;
        y = cy;
      } else if (t > tMax) {
        x = 3 * (x3 - cx2);
        y = 3 * (y3 - cy2);
      } else {
        x = (3 * ax * t + 2 * bx) * t + cx;
        y = (3 * ay * t + 2 * by) * t + cy;
      }
      
      if (normalized) {
        // When the tangent at t is zero and we're at the beginning
        // or the end, we can use the vector between the handles,
        // but only when normalizing as its weighted length is 0.
        if (x === 0 && y === 0 && (t < tMin || t > tMax)) {
          x = cx2 - cx1;
          y = cy2 - cy1;
        }
        // Now normalize x & y
        const len = Math.sqrt(x * x + y * y);
        if (len) {
          x /= len;
          y /= len;
        }
      }
      
      if (type === 3) {
        // Calculate 2nd derivative, and curvature from there:
        // k = |dx * d2y - dy * d2x| / (( dx^2 + dy^2 )^(3/2))
        const x2 = 6 * ax * t + 2 * bx,
              y2 = 6 * ay * t + 2 * by,
              d = Math.pow(x * x + y * y, 3 / 2);
        // For JS optimizations we always return a Point, although
        // curvature is just a numeric value, stored in x:
        x = d !== 0 ? (x * y2 - y * x2) / d : 0;
        y = 0;
      }
    }
    
    // The normal is simply the rotated tangent:
    return type === 2 ? new Point(y, -x) : new Point(x, y);
  }
}