/**
 * CurveLocation: 曲線上の位置情報（交点、端点など）
 * paper.jsのCurveLocationクラスに相当
 */

import { Segment } from './Segment';
import { Point } from '../basic/Point';
import { Matrix } from '../basic/Matrix';
import { Numerical } from '../util/Numerical';
import { CollisionDetection } from './CollisionDetection';
import { getSelfIntersection, getCurveIntersections } from './CurveIntersections';

export class CurveLocation {
  // 基本情報
  curve1Index: number = -1;  // 曲線1のインデックス
  curve2Index: number = -1;  // 曲線2のインデックス
  curve: Curve | null;       // 曲線オブジェクト（paper.js互換）
  curve1: Curve | null;      // 曲線1オブジェクト（Papyrus2D拡張）
  curve2: Curve | null;      // 曲線2オブジェクト（Papyrus2D拡張）
  time: number | null;       // 曲線上のパラメータ（paper.js互換）
  t1: number | null;         // 曲線1上のパラメータ（Papyrus2D拡張）
  t2: number | null;         // 曲線2上のパラメータ（Papyrus2D拡張）
  point: Point;              // 交点の座標
  
  // 追加情報（重複判定・端点マージ用）
  overlap: boolean;          // 重複フラグ
  distance?: number;         // 距離（近接判定用）
  tangent?: boolean;         // 接線共有フラグ
  onPath?: boolean;          // パス上フラグ
  
  // Paper.jsと同様のプロパティ（交点の相互参照用）
  _intersection?: CurveLocation; // 対応する交点
  _next?: CurveLocation;         // 連結リスト用
  _previous?: CurveLocation;     // 連結リスト用

  /**
   * Paper.js互換のコンストラクタ
   * @param curve 曲線
   * @param time 曲線上のパラメータ
   * @param point 交点の座標（nullの場合は自動計算）
   * @param overlap 重複フラグ
   * @param distance 距離
   */
  constructor(
    curve: Curve | null,
    time: number | null,
    point?: Point | null,
    overlap: boolean = false,
    distance?: number
  ) {
    // Paper.jsと同様に、端点の場合は次の曲線にマージする処理を追加
    if (time !== null && time >= (1 - Numerical.CURVETIME_EPSILON) && curve) {
      const next = curve.getNext();
      if (next) {
        time = 0;
        curve = next;
      }
    }
    
    this.curve = curve;
    this.curve1 = curve;  // 互換性のため
    this.curve2 = null;   // 互換性のため
    this.time = time;
    this.t1 = time;       // 互換性のため
    this.t2 = null;       // 互換性のため
    
    // paper.jsと同様に、pointがnullの場合は自動的に計算
    if (point) {
      this.point = point;
    } else if (time !== null && curve) {
      this.point = curve.getPointAt(time);
    } else {
      this.point = new Point(0, 0);
    }
    
    this.overlap = overlap;
    if (distance !== undefined) {
      this.distance = distance;
    }
  }
}

/**
 * Curveクラス: 2つのSegment（またはSegmentPoint）で定義される三次ベジェ曲線
 * - paper.jsのCurveクラスAPIを参考に設計
 * - イミュータブル設計
 */
export class Curve {
  readonly segment1: Segment;
  readonly segment2: Segment;

  constructor(segment1: Segment, segment2: Segment) {
    this.segment1 = segment1;
    this.segment2 = segment2;
  }

  /**
   * 前のカーブを取得（paper.js互換）
   * 現在は常にnullを返す
   */
  getPrevious(): Curve | null {
    return null;
  }

  /**
   * 次のカーブを取得（paper.js互換）
   * 現在は常にnullを返す
   */
  getNext(): Curve | null {
    return null;
  }

  /**
   * 曲線の始点を取得（paper.js互換）
   */
  getPoint1(): Point {
    return this.segment1.point;
  }

  /**
   * 曲線の終点を取得（paper.js互換）
   */
  getPoint2(): Point {
    return this.segment2.point;
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
  static evaluate(v: number[], t: number): Point {
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
   * 動的再帰深度の計算
   * paper.jsのgetDepthを完全移植
   */
  private static getDepth(v: number[]): number {
    // paper.jsと同じLUTベースの実装
    const p1 = new Point(v[0], v[1]);
    const p2 = new Point(v[6], v[7]);
    const c1 = new Point(v[2], v[3]);
    const c2 = new Point(v[4], v[5]);
    
    // 制御点から直線への距離を計算
    const d1 = this.getDistanceFromLine(p1, p2, c1);
    const d2 = this.getDistanceFromLine(p1, p2, c2);
    
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
   * 点から直線への距離を計算
   */
  private static getDistanceFromLine(p1: Point, p2: Point, point: Point): number {
    const line = p2.subtract(p1);
    const lineLength = line.getLength();
    
    if (lineLength < Numerical.EPSILON) {
      return point.subtract(p1).getLength();
    }
    
    // 直線上の最近接点を計算
    const t = point.subtract(p1).multiply(line).getLength() / (lineLength * lineLength);
    const projection = p1.add(line.multiply(t));
    
    // 点から直線への距離
    return point.subtract(projection).getLength();
  }

  /**
   * 2つの三次ベジェ曲線の交点を列挙（paper.js完全版）
   * @param v1 制御点配列 [x1,y1,h1x,h1y,h2x,h2y,x2,y2]
   * @param v2 制御点配列
   * @param locations 交点を格納する配列
   * @param t1s t1開始
   * @param t1e t1終了
   * @param t2s t2開始
   * @param t2e t2終了
   * @param depth 再帰深さ
   * @param maxDepth 最大再帰深さ
   */
  
  /**
   * 曲線と直線の交点を計算
   * paper.jsのgetCurveLineIntersections実装を移植
   */
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
    const maxRoots = 8; // paper.jsと同じ最大ルート数
    let tMin = 1;
    let tMax = 0;
    
    // 再利用可能なルート配列
    const allRoots: number[] = new Array(maxRoots);
    
    for (let c = 0; c < 2; c++) {
      // 三次方程式を解く
      const count = Numerical.solveCubic(
        3 * (-v[c] + 3 * v[c + 2] - 3 * v[c + 4] + v[c + 6]),
        6 * (v[c] - 2 * v[c + 2] + v[c + 4]),
        3 * (-v[c] + v[c + 2]),
        v[c] - coords[c],
        allRoots, 0, 1
      );
      
      // 各解について、曲線上の点と与えられた点の距離をチェック
      for (let i = 0; i < count; i++) {
        const t = allRoots[i];
        // 既に見つかったルートと重複しないようにする
        let duplicate = false;
        for (let j = 0; j < roots.length && !duplicate; j++) {
          duplicate = Math.abs(t - roots[j]) < epsilon;
        }
        
        if (!duplicate) {
          roots.push(t);
          const p = Curve.evaluate(v, t);
          if (point.isClose(p, geomEpsilon)) {
            return t;
          }
          // 最小・最大のtを更新
          if (t < tMin) tMin = t;
          if (t > tMax) tMax = t;
        }
      }
    }
    
    // 端点が十分近い場合は幾何学的イプシロンでも確認
    if (point.isClose(p0, geomEpsilon)) return 0;
    if (point.isClose(p3, geomEpsilon)) return 1;
    
    // 見つかったルートの範囲内で最も近い点を探す
    if (roots.length > 0) {
      // 範囲を少し広げる
      tMin = Math.max(0, tMin - 0.01);
      tMax = Math.min(1, tMax + 0.01);
      
      // 最も近い点を探す
      let minDist = Number.MAX_VALUE;
      let bestT: number | null = null;
      
      // サンプリング数（paper.jsと同じ）
      const samples = 100;
      for (let i = 0; i <= samples; i++) {
        const t = tMin + (tMax - tMin) * i / samples;
        const p = Curve.evaluate(v, t);
        const dist = point.subtract(p).getLength();
        if (dist < minDist) {
          minDist = dist;
          bestT = t;
        }
      }
      
      if (bestT !== null && minDist < geomEpsilon) {
        return bestT;
      }
    }
    
    return null;
  }
  
  /**
   * 三次方程式を解く
   * paper.jsのsolveCubic実装を移植
   */
  static solveCubic(a: number, b: number, c: number, d: number, roots: number[], min?: number, max?: number): number {
    // Numerical.solveCubicを使用
    return Numerical.solveCubic(a, b, c, d, roots, min, max);
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
    static subdivide(v: number[], t: number): [number[], number[]] {
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
  /**
   * モノトーン分割: 曲線をx方向またはy方向に単調な部分曲線に分割
   * paper.jsのCurve.getMonoCurves()を移植
   * @param v 制御点配列 [x1,y1,h1x,h1y,h2x,h2y,x2,y2]
   * @param dir 方向（falseならx方向、trueならy方向）
   * @returns 分割された制御点配列の配列
   */
  static getMonoCurves(v: number[], dir = false): number[][] {
    const x = dir ? 1 : 0;
    const y = dir ? 0 : 1;
    const curves: number[][] = [];
    let roots: number[] = [];
    let minT = 0;

    function add(t: number) {
      const curve = Curve.getPart(v, minT, t);
      if (dir) {
        // y方向の場合はx,yを入れ替える
        for (let i = 0; i < 8; i += 2) {
          const tmp = curve[i];
          curve[i] = curve[i + 1];
          curve[i + 1] = tmp;
        }
      }
      curves.push(curve);
      minT = t;
    }

    // 導関数の根を求める（単調性が変わる点）
    // 三次ベジェの導関数は二次ベジェ
    const a1 = 3 * (v[x + 2] - v[x]);
    const a2 = 3 * (v[x + 4] - v[x + 2]) - a1;
    const a3 = v[x + 6] - v[x] - a1 - a2;

    // 二次導関数の根を求める（変曲点）
    // 三次ベジェの二次導関数は一次式
    const inflections = Numerical.solveQuadratic(3 * a3, 2 * a2, a1, roots);
    
    // 単調性が変わる点で分割
    for (let i = 0; i < inflections; i++) {
      const t = roots[i];
      if (t > minT && t < 1) {
        add(t);
      }
    }
    
    // 最後の部分を追加
    add(1);
    
    return curves;
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
    const d = dir ? 1 : 0; // 方向インデックス（0=x, 1=y）
    const cd = dir ? 0 : 1; // 直交方向インデックス（0=x, 1=y）
    
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
    
    // 上下限を計算
    const min = Math.min(0, 3 * d1, 3 * d2, d1 + d2);
    const max = Math.max(0, 3 * d1, 3 * d2, d1 + d2);
    
    return { min, max };
  }

  /**
   * 2つの曲線の交点を計算
   * paper.jsのCurve.getIntersections実装を移植
   */
  /**
   * 2つの曲線の交点を計算
   * paper.jsのCurve.getIntersections実装を移植
   */
  static getIntersections(
    curves1: Curve[],
    curves2: Curve[] | null,
    include?: (loc: CurveLocation) => boolean,
    matrix1?: Matrix,
    matrix2?: Matrix,
    _returnFirst?: boolean
  ): CurveLocation[] {
    const epsilon = Numerical.GEOMETRIC_EPSILON;
    const self = !curves2;
    if (self) {
      curves2 = curves1;
    }
    const length1 = curves1.length;
    const length2 = curves2!.length;
    const values1: number[][] = new Array(length1);
    const values2 = self ? values1 : new Array(length2);
    const locations: CurveLocation[] = [];
    
    // 各曲線の値を取得（行列変換を適用）
    for (let i = 0; i < length1; i++) {
      values1[i] = curves1[i].getValues();
      if (matrix1) {
        // 行列変換を適用
        for (let j = 0; j < 8; j += 2) {
          const p = new Point(values1[i][j], values1[i][j + 1]);
          const transformed = matrix1.transform(p);
          values1[i][j] = transformed.x;
          values1[i][j + 1] = transformed.y;
        }
      }
    }
    
    if (!self) {
      for (let i = 0; i < length2; i++) {
        values2[i] = curves2![i].getValues();
        if (matrix2) {
          // 行列変換を適用
          for (let j = 0; j < 8; j += 2) {
            const p = new Point(values2[i][j], values2[i][j + 1]);
            const transformed = matrix2.transform(p);
            values2[i][j] = transformed.x;
            values2[i][j + 1] = transformed.y;
          }
        }
      }
    }
    
    // CollisionDetection.findCurveBoundsCollisionsを呼び出す
    const boundsCollisions = CollisionDetection.findCurveBoundsCollisions(
      values1, self ? values1 : values2, epsilon
    );
    
    // 各曲線の交点を計算
    for (let index1 = 0; index1 < length1; index1++) {
      const curve1 = curves1[index1];
      const v1 = values1[index1];
      
      if (self) {
        // 自己交差チェック
        getSelfIntersection(v1, curve1, locations, include);
      }
      
      // 潜在的に交差する曲線とのチェック
      const collisions1 = boundsCollisions[index1];
      if (collisions1) {
        for (let j = 0; j < collisions1.length; j++) {
          // 既に交点が見つかっていて、最初の交点だけを返す場合は早期リターン
          if (_returnFirst && locations.length) {
            return locations;
          }
          
          const index2 = collisions1[j];
          // 自己交差の場合は、重複チェックを避けるために index2 > index1 の場合のみ処理
          if (!self || index2 > index1) {
            const curve2 = curves2![index2];
            const v2 = values2[index2];
            
            // 曲線の交点を計算
            getCurveIntersections(
              v1, v2, curve1, curve2, locations, include
            );
            
            // 曲線インデックスを設定
            for (let k = locations.length - 1; k >= 0; k--) {
              const loc = locations[k];
              if (loc.curve1Index === -1) {
                loc.curve1Index = index1;
                loc.curve2Index = index2;
                
                // paper.jsと同様に、交点が見つかった後に曲線インデックスを設定
                if (loc.time !== null) {
                  // paper.jsでは交点の位置は変換された座標系で計算され、
                  // 元の座標系に戻す処理は行われない
                  // 交点の位置はそのまま使用する
                }
              }
            }
          }
        }
      }
    }
    
    return locations;
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
}
