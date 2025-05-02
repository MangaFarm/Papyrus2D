/**
 * Curveクラス: 2つのSegment（またはSegmentPoint）で定義される三次ベジェ曲線
 * - paper.jsのCurveクラスAPIを参考に設計
 * - イミュータブル設計
 */

import { Segment } from './Segment';
import { Point } from '../basic/Point';
import { Numerical } from '../util/Numerical';

export class Curve {
  readonly segment1: Segment;
  readonly segment2: Segment;

  constructor(segment1: Segment, segment2: Segment) {
    this.segment1 = segment1;
    this.segment2 = segment2;
  }

  /**
   * 曲線長を返す
   */
  getLength(): number {
    // ベジェ制御点配列を取得
    const v = this.getValues();
    // 直線判定
    if (Curve.isStraight(v)) {
      const dx = v[6] - v[0];
      const dy = v[7] - v[1];
      return Math.hypot(dx, dy);
    }
    // 曲線長を数値積分で計算
    return Numerical.integrate(Curve.getLengthIntegrand(v), 0, 1, Curve.getIterations(0, 1));
  }

  /**
   * ベジェ制御点配列 [x1, y1, h1x, h1y, h2x, h2y, x2, y2] を返す
   */
  private getValues(): number[] {
    const p1 = this.segment1.point;
    const h1 = p1.add(this.segment1.handleOut);
    const h2 = this.segment2.point.add(this.segment2.handleIn);
    const p2 = this.segment2.point;
    return [p1.x, p1.y, h1.x, h1.y, h2.x, h2.y, p2.x, p2.y];
  }

  /**
   * 直線判定
   */
  static isStraight(v: number[]): boolean {
    // ハンドルがゼロ or 全てcollinear
    const p1 = new Point(v[0], v[1]);
    const h1 = new Point(v[2] - v[0], v[3] - v[1]);
    const h2 = new Point(v[4] - v[6], v[5] - v[7]);
    const p2 = new Point(v[6], v[7]);
    if (h1.isZero() && h2.isZero()) return true;
    const vLine = p2.subtract(p1);
    if (vLine.isZero()) return false;
    return vLine.isCollinear(h1) && vLine.isCollinear(h2);
  }

  /**
   * 曲線長積分用の関数
   */
  static getLengthIntegrand(v: number[]): (t: number) => number {
    const x0 = v[0], y0 = v[1], x1 = v[2], y1 = v[3], x2 = v[4], y2 = v[5], x3 = v[6], y3 = v[7];
    const ax = 9 * (x1 - x2) + 3 * (x3 - x0);
    const bx = 6 * (x0 + x2) - 12 * x1;
    const cx = 3 * (x1 - x0);
    const ay = 9 * (y1 - y2) + 3 * (y3 - y0);
    const by = 6 * (y0 + y2) - 12 * y1;
    const cy = 3 * (y1 - y0);
    return function (t: number) {
      const dx = (ax * t + bx) * t + cx;
      const dy = (ay * t + by) * t + cy;
      return Math.hypot(dx, dy);
    };
  }

  /**
   * 積分分割数
   */
  static getIterations(a: number, b: number): number {
    return Math.max(2, Math.min(16, Math.ceil(Math.abs(b - a) * 32)));
  }

  /**
   * t(0-1)で指定した位置のPointを返す
   */
  getPointAt(t: number): Point {
    const v = this.getValues();
    return Curve.evaluate(v, t);
  }

  /**
   * 三次ベジェ曲線のt位置の点を返す
   * v: [x1, y1, h1x, h1y, h2x, h2y, x2, y2]
   */
  private static evaluate(v: number[], t: number): Point {
    if (t < 0 || t > 1) throw new Error('t must be in [0,1]');
    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;
    const a = mt2 * mt;
    const b = 3 * mt2 * t;
    const c = 3 * mt * t2;
    const d = t * t2;
    const x = a * v[0] + b * v[2] + c * v[4] + d * v[6];
    const y = a * v[1] + b * v[3] + c * v[5] + d * v[7];
    return new Point(x, y);
  }

  /**
   * t(0-1)で指定した位置の接線ベクトルを返す
   */
  getTangentAt(t: number): Point {
    const v = this.getValues();
    // 三次ベジェ曲線の導関数
    const mt = 1 - t;
    const a = -3 * mt * mt;
    const b = 3 * mt * mt - 6 * mt * t;
    const c = 6 * mt * t - 3 * t * t;
    const d = 3 * t * t;
    const dx = a * v[0] + b * v[2] + c * v[4] + d * v[6];
    const dy = a * v[1] + b * v[3] + c * v[5] + d * v[7];
    return new Point(dx, dy);
  }

  /**
   * 曲線をtで分割し、2つのCurveに分ける
   * paper.jsのde CasteljauアルゴリズムをTypeScriptで実装
   */
  divide(t: number): [Curve, Curve] {
    if (t < 0 || t > 1) throw new Error('t must be in [0,1]');
    const v = this.getValues();
    const [left, right] = Curve.subdivide(v, t);

    // left: [x0, y0, x4, y4, x7, y7, x9, y9]
    // right: [x9, y9, x8, y8, x6, y6, x3, y3]
    const seg1_left = new Segment(
      new Point(left[0], left[1]),
      new Point(left[2] - left[0], left[3] - left[1]), // handleOut
      new Point(0, 0) // handleIn
    );
    const seg2_left = new Segment(
      new Point(left[6], left[7]),
      new Point(0, 0), // handleOut
      new Point(left[4] - left[6], left[5] - left[7]) // handleIn
    );
    const seg1_right = new Segment(
      new Point(right[0], right[1]),
      new Point(right[2] - right[0], right[3] - right[1]), // handleOut
      new Point(0, 0) // handleIn
    );
    const seg2_right = new Segment(
      new Point(right[6], right[7]),
      new Point(0, 0), // handleOut
      new Point(right[4] - right[6], right[5] - right[7]) // handleIn
    );
    return [
      new Curve(seg1_left, seg2_left),
      new Curve(seg1_right, seg2_right)
    ];
  }

  /**
   * tで分割し、前半部分のCurveを返す
   */
  split(t: number): Curve {
    return this.divide(t)[0];
  }

  /**
   * de Casteljau アルゴリズムによる分割
   * v: [x1, y1, h1x, h1y, h2x, h2y, x2, y2]
   * t: 分割位置 (0-1)
   * 戻り値: [左側の制御点配列, 右側の制御点配列]
   */
  private static subdivide(v: number[], t: number): [number[], number[]] {
    const x0 = v[0], y0 = v[1];
    const x1 = v[2], y1 = v[3];
    const x2 = v[4], y2 = v[5];
    const x3 = v[6], y3 = v[7];
    const u = 1 - t;
    // 1次補間
    const x4 = u * x0 + t * x1, y4 = u * y0 + t * y1;
    const x5 = u * x1 + t * x2, y5 = u * y1 + t * y2;
    const x6 = u * x2 + t * x3, y6 = u * y2 + t * y3;
    // 2次補間
    const x7 = u * x4 + t * x5, y7 = u * y4 + t * y5;
    const x8 = u * x5 + t * x6, y8 = u * y5 + t * y6;
    // 3次補間
    const x9 = u * x7 + t * x8, y9 = u * y7 + t * y8;
    // 左右の制御点配列
    return [
      [x0, y0, x4, y4, x7, y7, x9, y9],
      [x9, y9, x8, y8, x6, y6, x3, y3]
    ];
  }
}