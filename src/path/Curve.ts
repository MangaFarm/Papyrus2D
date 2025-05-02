/**
 * CurveLocation: 2つの曲線の交点情報
 */
export interface CurveLocation {
  curve1Index: number;
  curve2Index: number;
  t1: number;
  t2: number;
  point: import('../basic/Point').Point;
}
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
  /**
   * 曲線長を返す（paper.jsそっくり）
   */
  getLength(): number {
    if ((this as any)._length == null) {
      (this as any)._length = Curve.getLength(this.getValues(), 0, 1);
    }
    return (this as any)._length;
  }

  /**
   * static: paper.jsそっくりの曲線長計算
   */
  static getLength(v: number[], a?: number, b?: number, ds?: (t: number) => number): number {
    if (a === undefined) a = 0;
    if (b === undefined) b = 1;
    if (Curve.isStraight(v)) {
      // Sub-divide the linear curve at a and b, so we can simply
      // calculate the Pythagorean Theorem to get the range's length.
      let c = v;
      if (b < 1) {
        c = Curve.subdivide(c, b)[0]; // left
        a /= b; // Scale parameter to new sub-curve.
      }
      if (a > 0) {
        c = Curve.subdivide(c, a)[1]; // right
      }
      // The length of straight curves can be calculated more easily.
      const dx = c[6] - c[0];
      const dy = c[7] - c[1];
      return Math.sqrt(dx * dx + dy * dy);
    }
    return Numerical.integrate(ds || Curve.getLengthIntegrand(v), a, b, Curve.getIterations(a, b));
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
   * 積分分割数
   */
  /**
   * paper.jsそっくりの分割数推定
   */
  static getIterations(a: number, b: number): number {
    // Guess required precision based and size of range...
    // TODO: There should be much better educated guesses for this. Also, what does this depend on? Required precision?
    // paper.js本家と同じ仕様: 上限なし
    return Math.max(2, Math.ceil(Math.abs(b - a) * 32));
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
    // 直線の場合は単純なベクトルを返す
    if (Curve.isStraight(v)) {
      return new Point(v[6] - v[0], v[7] - v[1]).normalize();
    }
    // 三次ベジェ曲線の導関数
    const mt = 1 - t;
    const a = -3 * mt * mt;
    const b = 3 * mt * mt - 6 * mt * t;
    const c = 6 * mt * t - 3 * t * t;
    const d = 3 * t * t;
    const dx = a * v[0] + b * v[2] + c * v[4] + d * v[6];
    const dy = a * v[1] + b * v[3] + c * v[5] + d * v[7];
    return new Point(dx, dy).normalize();
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
     * 指定した区間[from, to]の部分曲線を返す（paper.jsのgetPart相当）
     */
    static getPart(v: number[], from: number, to: number): number[] {
      let vv = v;
      if (from > 0) {
        vv = Curve.subdivide(vv, from)[1];
      }
      if (to < 1) {
        vv = Curve.subdivide(vv, (to - from) / (1 - from))[0];
      }
      return vv;
    }
/**
   * 2つの三次ベジェ曲線の交点を列挙（AABB分割による粗実装, paper.js参考）
   * @param v1 制御点配列 [x1,y1,h1x,h1y,h2x,h2y,x2,y2]
   * @param v2 制御点配列
   * @param t1s t1開始
   * @param t1e t1終了
   * @param t2s t2開始
   * @param t2e t2終了
   * @param depth 再帰深さ
   */
  static getIntersections(
    v1: number[],
    v2: number[],
    t1s = 0, t1e = 1,
    t2s = 0, t2e = 1,
    depth = 0
  ): { t1: number; t2: number; point: import('../basic/Point').Point }[] {
    // AABBで早期リターン
    function getAABB(v: number[]) {
      const xs = [v[0], v[2], v[4], v[6]];
      const ys = [v[1], v[3], v[5], v[7]];
      return {
        minX: Math.min(...xs), maxX: Math.max(...xs),
        minY: Math.min(...ys), maxY: Math.max(...ys)
      };
    }
    const a1 = getAABB(v1), a2 = getAABB(v2);
    if (
      a1.maxX < a2.minX || a1.minX > a2.maxX ||
      a1.maxY < a2.minY || a1.minY > a2.maxY
    ) return [];

    // 直線同士なら厳密計算
    function isLine(v: number[]) {
      return v[0] === v[2] && v[1] === v[3] && v[4] === v[6] && v[5] === v[7];
    }
    if (isLine(v1) && isLine(v2)) {
      // v1: (x1,y1)-(x2,y2), v2: (x3,y3)-(x4,y4)
      const x1 = v1[0], y1 = v1[1], x2 = v1[6], y2 = v1[7];
      const x3 = v2[0], y3 = v2[1], x4 = v2[6], y4 = v2[7];
      const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
      if (Math.abs(denom) < 1e-12) return []; // 平行
      const px = ((x1*y2 - y1*x2)*(x3 - x4) - (x1 - x2)*(x3*y4 - y3*x4)) / denom;
      const py = ((x1*y2 - y1*x2)*(y3 - y4) - (y1 - y2)*(x3*y4 - y3*x4)) / denom;
      // パラメータ計算
      const t1 = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) /
                 ((x2 - x1) ** 2 + (y2 - y1) ** 2);
      const t2 = ((px - x3) * (x4 - x3) + (py - y3) * (y4 - y3)) /
                 ((x4 - x3) ** 2 + (y4 - y3) ** 2);
      if (t1 >= 0 && t1 <= 1 && t2 >= 0 && t2 <= 1) {
        return [{ t1: t1s + (t1e - t1s) * t1, t2: t2s + (t2e - t2s) * t2, point: new Point(px, py) }];
      }
      return [];
    }

    // 十分小さければ交点近似
    const EPS = 1e-4;
    if (
      Math.max(a1.maxX - a1.minX, a1.maxY - a1.minY) < EPS &&
      Math.max(a2.maxX - a2.minX, a2.maxY - a2.minY) < EPS
    ) {
      // 交点近似
      const t1 = (t1s + t1e) / 2;
      const t2 = (t2s + t2e) / 2;
      const p = Curve.evaluate(v1, t1);
      return [{ t1, t2, point: p }];
    }
    // 再帰分割
    if (depth > 18) return [];
    // 長い方を分割
    const d1 = Math.max(a1.maxX - a1.minX, a1.maxY - a1.minY);
    const d2 = Math.max(a2.maxX - a2.minX, a2.maxY - a2.minY);
    if (d1 > d2) {
      const [left, right] = Curve.subdivide(v1, 0.5);
      const mid = (t1s + t1e) / 2;
      return [
        ...Curve.getIntersections(left, v2, t1s, mid, t2s, t2e, depth + 1),
        ...Curve.getIntersections(right, v2, mid, t1e, t2s, t2e, depth + 1)
      ];
    } else {
      const [left, right] = Curve.subdivide(v2, 0.5);
      const mid = (t2s + t2e) / 2;
      return [
        ...Curve.getIntersections(v1, left, t1s, t1e, t2s, mid, depth + 1),
        ...Curve.getIntersections(v1, right, t1s, t1e, mid, t2e, depth + 1)
      ];
    }
  }
  
    /**
     * 制御点配列からCurveを生成
     */
    static fromValues(v: number[]): Curve {
      const p0 = new Point(v[0], v[1]);
      const h0 = new Point(v[2], v[3]).subtract(p0);
      const h1 = new Point(v[4], v[5]).subtract(new Point(v[6], v[7]));
      const p1 = new Point(v[6], v[7]);
      return new Curve(
        new Segment(p0, new Point(0, 0), h0),
        new Segment(p1, h1, new Point(0, 0))
      );
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