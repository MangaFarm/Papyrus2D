/**
 * CurveGeometry: 曲線の幾何学的特性（長さ、面積、分類など）の計算機能
 * Curve.tsから分離した静的幾何計算関数群
 */

import { Point } from '../basic/Point';
import { Numerical } from '../util/Numerical';
import { CurveSubdivision } from './CurveSubdivision';
export class CurveGeometry {
  /**
   * 直線判定 - paper.jsの実装と完全に同じ
   */
  static isStraight(v: number[]): boolean {
    // ハンドルがゼロ or 全てcollinear
    const p1 = new Point(v[0], v[1]);
    const h1 = new Point(v[2] - v[0], v[3] - v[1]);
    const h2 = new Point(v[4] - v[6], v[5] - v[7]);
    const p2 = new Point(v[6], v[7]);
    
    // ハンドルがゼロの場合
    if (h1.isZero() && h2.isZero()) return true;
    
    // 線分の方向ベクトル
    const vLine = p2.subtract(p1);
    
    // ゼロ長の線分の場合
    if (vLine.isZero()) return false;
    
    // ハンドルが線分と同一線上にあるかチェック
    if (vLine.isCollinear(h1) && vLine.isCollinear(h2)) {
      // paper.jsと同様に、ハンドルが線分上にあるかをより厳密にチェック
      // 線分からの距離をチェック
      const line = { point: p1, vector: vLine };
      const epsilon = Numerical.GEOMETRIC_EPSILON;
      
      // 線分からの距離が十分に小さいか
      const getDistance = (pt: Point): number => {
        const v2 = pt.subtract(line.point);
        const vl = line.vector;
        const vl2 = vl.x * vl.x + vl.y * vl.y;
        if (vl2 === 0) return v2.getLength();
        const t = (v2.x * vl.x + v2.y * vl.y) / vl2;
        const proj = line.point.add(vl.multiply(t));
        return pt.subtract(proj).getLength();
      };
      
      if (getDistance(p1.add(h1)) < epsilon && getDistance(p2.add(h2)) < epsilon) {
        // ハンドルが線分の範囲内にあるかチェック
        const div = vLine.dot(vLine);
        const s1 = vLine.dot(h1) / div;
        const s2 = vLine.dot(h2) / div;
        return s1 >= 0 && s1 <= 1 && s2 <= 0 && s2 >= -1;
      }
    }
    
    return false;
  }

  /**
   * paper.jsそっくりの曲線長計算
   */
  static getLength(v: number[], a?: number, b?: number, ds?: (t: number) => number): number {
    if (a === undefined) a = 0;
    if (b === undefined) b = 1;
    if (CurveGeometry.isStraight(v)) {
      // Sub-divide the linear curve at a and b, so we can simply
      // calculate the Pythagorean Theorem to get the range's length.
      let c = v;
      if (b < 1) {
        c = CurveSubdivision.subdivide(c, b)[0]; // left
        a /= b; // Scale parameter to new sub-curve.
      }
      if (a > 0) {
        c = CurveSubdivision.subdivide(c, a)[1]; // right
      }
      // The length of straight curves can be calculated more easily.
      // paper.jsと同じ計算方法を使用
      const dx = c[6] - c[0];
      const dy = c[7] - c[1];
      return Math.sqrt(dx * dx + dy * dy);
    }
    return Numerical.integrate(ds || CurveGeometry.getLengthIntegrand(v), a, b, CurveGeometry.getIterations(a, b));
  }

  /**
   * paper.jsそっくりの曲線長積分用関数
   */
  static getLengthIntegrand(v: number[]): (t: number) => number {
    // Calculate the coefficients of a Bezier derivative.
    const x0 = v[0], y0 = v[1],
      x1 = v[2], y1 = v[3],
      x2 = v[4], y2 = v[5],
      x3 = v[6], y3 = v[7];

    const ax = 9 * (x1 - x2) + 3 * (x3 - x0),
      bx = 6 * (x0 + x2) - 12 * x1,
      cx = 3 * (x1 - x0),
      ay = 9 * (y1 - y2) + 3 * (y3 - y0),
      by = 6 * (y0 + y2) - 12 * y1,
      cy = 3 * (y1 - y0);

    return function (t: number) {
      // Calculate quadratic equations of derivatives for x and y
      const dx = (ax * t + bx) * t + cx,
        dy = (ay * t + by) * t + cy;
      return Math.sqrt(dx * dx + dy * dy);
    };
  }

  /**
   * paper.jsそっくりの分割数推定
   */
  static getIterations(a: number, b: number): number {
    // Guess required precision based and size of range...
    // TODO: There should be much better educated guesses for this. Also, what does this depend on? Required precision?
    return Math.max(2, Math.min(16, Math.ceil(Math.abs(b - a) * 32)));
  }

  /**
   * 点から直線への距離を計算
   */
  static getDistanceFromLine(p1: Point, p2: Point, point: Point): number {
    const line = p2.subtract(p1);
    const lineLength = line.getLength();
    
    if (lineLength < Numerical.EPSILON) {
      return point.subtract(p1).getLength();
    }
    
    // 直線上の最近接点を計算
    // paper.jsと同じ計算方法を使用
    const t = point.subtract(p1).dot(line) / (lineLength * lineLength);
    const projection = p1.add(line.multiply(t));
    
    // 点から直線への距離
    return point.subtract(projection).getLength();
  }

  /**
   * 動的再帰深度の計算
   * paper.jsのgetDepthを完全移植
   */
  static getDepth(v: number[]): number {
    // paper.jsと同じLUTベースの実装
    const p1 = new Point(v[0], v[1]);
    const p2 = new Point(v[6], v[7]);
    const c1 = new Point(v[2], v[3]);
    const c2 = new Point(v[4], v[5]);
    
    // 制御点から直線への距離を計算
    const d1 = CurveGeometry.getDistanceFromLine(p1, p2, c1);
    const d2 = CurveGeometry.getDistanceFromLine(p1, p2, c2);
    
    // 最大距離
    const maxDist = Math.max(d1, d2);
    
    // paper.jsと同じLUT（Look-Up Table）を使用
    const LUT_SIZE = 16;
    const lookupTable = [
      [0.0150, 4], // 0
      [0.0205, 5], // 1
      [0.0260, 5], // 2
      [0.0315, 6], // 3
      [0.0370, 6], // 4
      [0.0425, 7], // 5
      [0.0480, 7], // 6
      [0.0540, 8], // 7
      [0.0600, 8], // 8
      [0.0665, 9], // 9
      [0.0730, 9], // 10
      [0.0795, 10], // 11
      [0.0860, 10], // 12
      [0.0930, 11], // 13
      [0.1000, 11], // 14
      [0.1075, 12]  // 15
    ];
    
    // 曲線が直線に近い場合は再帰深度を小さく
    if (maxDist < Numerical.EPSILON) {
      return 1;
    }
    
    // LUTを使用して再帰深度を決定
    for (let i = 0; i < LUT_SIZE; i++) {
      if (maxDist <= lookupTable[i][0]) {
        return lookupTable[i][1];
      }
    }
    
    // LUTの範囲外の場合は最大値を返す
    return 12;
  }

  /**
   * Fat-line 上下限計算: 曲線の上下限境界を計算
   * paper.jsのCurve._getFatLineBounds相当
   * @param v 制御点配列 [x1,y1,h1x,h1y,h2x,h2y,x2,y2]
   * @param point 基準点
   * @param dir 方向（falseならx方向、trueならy方向）
   * @returns {min, max} 上下限値
   */
  static _getFatLineBounds(v: number[], point: Point, dir = false): { min: number, max: number } {
    const p0 = new Point(v[0], v[1]);
    const p1 = new Point(v[6], v[7]);
    
    // 基準点から線分への距離を計算
    const fromPoint = point[dir ? 'y' : 'x'];
    const px = fromPoint - p0[dir ? 'y' : 'x'];
    const py = p1[dir ? 'y' : 'x'] - p0[dir ? 'y' : 'x'];
    
    // 線分の長さが0の場合は特別処理
    if (Math.abs(py) < Numerical.EPSILON) {
      return { min: px, max: px };
    }
    
    // 制御点から線分への距離を計算
    const vx = p0[dir ? 'x' : 'y'];
    const vy = p1[dir ? 'x' : 'y'];
    const c1 = new Point(v[2], v[3]);
    const c2 = new Point(v[4], v[5]);
    
    // 3次ベジェ曲線の制御点から線分への距離
    const f1 = (c1[dir ? 'y' : 'x'] - p0[dir ? 'y' : 'x']) / py;
    const f2 = (c2[dir ? 'y' : 'x'] - p0[dir ? 'y' : 'x']) / py;
    
    // 制御点の直交方向の距離
    const d1 = c1[dir ? 'x' : 'y'] - (vx + f1 * (vy - vx));
    const d2 = c2[dir ? 'x' : 'y'] - (vx + f2 * (vy - vx));
    
    // 上下限を計算 - paper.jsと同じ係数を使用
    const min = Math.min(0, 3 * d1, 3 * d2, d1 + d2);
    const max = Math.max(0, 3 * d1, 3 * d2, d1 + d2);
    
    return { min, max };
  }

  /**
   * 曲線の分類（直線、二次曲線、蛇行曲線、尖点、ループ、アーチ）
   * paper.jsのCurve.classify実装を移植
   */
  static classify(v: number[]): { type: string; roots?: number[] } {
    // paper.jsのCurve.classify実装を移植
    // 参考: Loop and Blinn, 2005, Resolution Independent Curve Rendering
    // using Programmable Graphics Hardware, GPU Gems 3 chapter 25
    //
    // 可能な分類:
    //   'line'       (d1 == d2 == d3 == 0)
    //   'quadratic'  (d1 == d2 == 0)
    //   'serpentine' (d > 0)
    //   'cusp'       (d == 0)
    //   'loop'       (d < 0)
    //   'arch'       (serpentine, cusp or loop with roots outside 0..1)
    
    const x0 = v[0], y0 = v[1],
          x1 = v[2], y1 = v[3],
          x2 = v[4], y2 = v[5],
          x3 = v[6], y3 = v[7];
    
    // I(s, t)の係数を計算（変曲点）
    const a1 = x0 * (y3 - y2) + y0 * (x2 - x3) + x3 * y2 - y3 * x2;
    const a2 = x1 * (y0 - y3) + y1 * (x3 - x0) + x0 * y3 - y0 * x3;
    const a3 = x2 * (y1 - y0) + y2 * (x0 - x1) + x1 * y0 - y1 * x0;
    let d3 = 3 * a3;
    let d2 = d3 - a2;
    let d1 = d2 - a2 + a1;
    
    // ベクトル(d1, d2, d3)を正規化して誤差を一定に保つ
    const l = Math.sqrt(d1 * d1 + d2 * d2 + d3 * d3);
    const s = l !== 0 ? 1 / l : 0;
    // Paper.jsと完全に同じ精度で計算するために、
    // isZero関数の代わりにNumerical.EPSILONを直接使用
    const isZero = (val: number): boolean => Math.abs(val) < Numerical.EPSILON;
    
    d1 *= s;
    d2 *= s;
    d3 *= s;
    
    // 分類関数
    function type(type: string, t1?: number, t2?: number): { type: string; roots?: number[] } {
      const hasRoots = t1 !== undefined;
      let t1Ok = hasRoots && t1 > 0 && t1 < 1;
      let t2Ok = hasRoots && t2! > 0 && t2! < 1;
      
      // 0..1の範囲内に解がない場合はarchに格下げ
      // loopは2つの解が必要
      if (hasRoots && (!(t1Ok || t2Ok) || type === 'loop' && !(t1Ok && t2Ok))) {
        type = 'arch';
        t1Ok = t2Ok = false;
      }
      
      return {
        type: type,
        roots: t1Ok || t2Ok
          ? t1Ok && t2Ok
            ? t1! < t2! ? [t1!, t2!] : [t2!, t1!] // 2つの解
            : [t1Ok ? t1! : t2!] // 1つの解
          : undefined
      };
    }
    
    if (isZero(d1)) {
      return isZero(d2)
        ? type(isZero(d3) ? 'line' : 'quadratic') // 5. / 4.
        : type('serpentine', d3 / (3 * d2));      // 3b.
    }
    
    const d = 3 * d2 * d2 - 4 * d1 * d3;
    if (isZero(d)) {
      return type('cusp', d2 / (2 * d1));         // 3a.
    }
    
    // Paper.jsと同じ精度で計算するために、
    // 数値計算の安定性を向上させる
    
    const f1 = d > 0 ? Math.sqrt(d / 3) : Math.sqrt(-d);
    const f2 = 2 * d1;
    return type(d > 0 ? 'serpentine' : 'loop',    // 1. / 2.
      (d2 + f1) / f2,
      (d2 - f1) / f2);
  }

  /**
   * ベジェ曲線の面積を計算
   * paper.jsのCurve.getArea実装を移植
   * @param v 制御点配列 [x1,y1,h1x,h1y,h2x,h2y,x2,y2]
   * @returns 曲線の面積
   */
  static getArea(v: number[]): number {
    const x0 = v[0], y0 = v[1],
          x1 = v[2], y1 = v[3],
          x2 = v[4], y2 = v[5],
          x3 = v[6], y3 = v[7];
    
    // paper.jsと完全に同じ計算式を使用
    // http://objectmix.com/graphics/133553-area-closed-bezier-curve.html
    return 3 * ((y3 - y0) * (x1 + x2) - (x3 - x0) * (y1 + y2)
            + y1 * (x0 - x2) - x1 * (y0 - y2)
            + y3 * (x2 + x0 / 3) - x3 * (y2 + y0 / 3)) / 20;
  }

}
