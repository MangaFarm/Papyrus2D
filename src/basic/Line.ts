/**
 * Papyrus2D Line クラス（イミュータブル設計, TypeScript）
 * paper.js の Line 実装をベースに、イミュータブル・副作用なし・グローバル排除で再設計
 */
import { Numerical } from '../util/Numerical';
import { Point } from './Point';

/**
 * @name Line
 * @class 直線または線分を表すクラス
 */
export class Line {
  readonly _px: number;
  readonly _py: number;
  readonly _vx: number;
  readonly _vy: number;

  /**
   * Lineオブジェクトを作成します。
   *
   * @param point1 始点
   * @param point2 終点
   * @param asVector 第2引数をベクトルとして扱うかどうか（falseの場合は終点として扱う）
   */
  constructor(point1: Point, point2: Point, asVector?: boolean);

  /**
   * Lineオブジェクトを作成します。
   *
   * @param px 始点のx座標
   * @param py 始点のy座標
   * @param vx ベクトルのx成分または終点のx座標
   * @param vy ベクトルのy成分または終点のy座標
   * @param asVector 第3,4引数をベクトルとして扱うかどうか（falseの場合は終点として扱う）
   */
  constructor(px: number, py: number, vx: number, vy: number, asVector?: boolean);

  constructor(arg0: Point | number, arg1: Point | number, arg2?: boolean | number, arg3?: number, arg4?: boolean) {
    let asVector = false;

    if (typeof arg0 === 'number' && typeof arg1 === 'number' && 
        typeof arg2 === 'number' && typeof arg3 === 'number') {
      // 数値引数の場合
      this._px = arg0;
      this._py = arg1;
      this._vx = arg2;
      this._vy = arg3;
      asVector = !!arg4;
    } else if (arg0 instanceof Point && arg1 instanceof Point) {
      // Point引数の場合
      this._px = arg0.x;
      this._py = arg0.y;
      this._vx = arg1.x;
      this._vy = arg1.y;
      asVector = !!arg2;
    } else {
      throw new Error('Invalid arguments for Line constructor');
    }

    // asVectorがfalseの場合、第2引数は終点なのでベクトルに変換
    if (!asVector) {
      this._vx -= this._px;
      this._vy -= this._py;
    }

    Object.freeze(this);
  }

  /**
   * 直線の始点を取得します。
   *
   * @return 始点
   */
  getPoint(): Point {
    return new Point(this._px, this._py);
  }

  /**
   * 直線のベクトルを取得します。
   *
   * @return ベクトル
   */
  getVector(): Point {
    return new Point(this._vx, this._vy);
  }

  /**
   * 直線の長さを取得します。
   *
   * @return 長さ
   */
  getLength(): number {
    return this.getVector().getLength();
  }

  /**
   * 別の直線との交点を計算します。
   *
   * @param line 交点を計算する直線
   * @param isInfinite 両方の直線を無限に延長するかどうか
   * @return 交点、または直線が平行の場合はundefined
   */
  intersect(line: Line, isInfinite: boolean): Point | undefined {
    return Line.intersect(
      this._px, this._py, this._vx, this._vy,
      line._px, line._py, line._vx, line._vy,
      true, isInfinite
    );
  }

  /**
   * 点が直線のどちら側にあるかを判定します。
   *
   * @param point 判定する点
   * @param isInfinite 直線を無限に延長するかどうか
   * @return 点が直線の左側にある場合は-1、右側にある場合は1、直線上にある場合は0
   */
  getSide(point: Point, isInfinite?: boolean): number {
    return Line.getSide(
      this._px, this._py, this._vx, this._vy,
      point.x, point.y, true, isInfinite
    );
  }

  /**
   * 点から直線までの距離を計算します。
   *
   * @param point 距離を計算する点
   * @return 距離
   */
  getDistance(point: Point): number {
    return Math.abs(this.getSignedDistance(point));
  }

  /**
   * 点から直線までの符号付き距離を計算します。
   *
   * @param point 距離を計算する点
   * @return 符号付き距離
   */
  getSignedDistance(point: Point): number {
    return Line.getSignedDistance(
      this._px, this._py, this._vx, this._vy,
      point.x, point.y, true
    );
  }

  /**
   * 2つの直線が同一直線上にあるかどうかを判定します。
   *
   * @param line 判定する直線
   * @return 同一直線上にある場合はtrue
   */
  isCollinear(line: Line): boolean {
    return Point.isCollinear(this._vx, this._vy, line._vx, line._vy);
  }

  /**
   * 2つの直線が直交しているかどうかを判定します。
   *
   * @param line 判定する直線
   * @return 直交している場合はtrue
   */
  isOrthogonal(line: Line): boolean {
    return Point.isOrthogonal(this._vx, this._vy, line._vx, line._vy);
  }

  /**
   * 2つの直線の交点を計算します。
   *
   * @param p1x 第1直線の始点のx座標
   * @param p1y 第1直線の始点のy座標
   * @param v1x 第1直線のベクトルのx成分
   * @param v1y 第1直線のベクトルのy成分
   * @param p2x 第2直線の始点のx座標
   * @param p2y 第2直線の始点のy座標
   * @param v2x 第2直線のベクトルのx成分
   * @param v2y 第2直線のベクトルのy成分
   * @param asVector 第3,4,7,8引数をベクトルとして扱うかどうか
   * @param isInfinite 両方の直線を無限に延長するかどうか
   * @return 交点、または直線が平行の場合はundefined
   */
  static intersect(
    p1x: number, p1y: number, v1x: number, v1y: number,
    p2x: number, p2y: number, v2x: number, v2y: number,
    asVector: boolean, isInfinite: boolean
  ): Point | undefined {
    // ベクトルとして指定されていない場合は、終点から始点を引いてベクトルに変換
    if (!asVector) {
      v1x -= p1x;
      v1y -= p1y;
      v2x -= p2x;
      v2y -= p2y;
    }

    const cross = v1x * v2y - v1y * v2x;
    // 0に近い値の場合の誤差を避ける
    if (!Numerical.isMachineZero(cross)) {
      const dx = p1x - p2x;
      const dy = p1y - p2y;
      const u1 = (v2x * dy - v2y * dx) / cross;
      const u2 = (v1x * dy - v1y * dx) / cross;
      // 直線が有限の場合、u1とu2が[0,1]の範囲内にあるかチェック
      // ただし、数値誤差を考慮して少し範囲を広げる
      const epsilon = Numerical.EPSILON;
      const uMin = -epsilon;
      const uMax = 1 + epsilon;

      if (isInfinite || (uMin < u1 && u1 < uMax && uMin < u2 && u2 < uMax)) {
        if (!isInfinite) {
          // 境界での許容誤差を考慮して、実際の範囲にクリップ
          const clampedU1 = u1 <= 0 ? 0 : u1 >= 1 ? 1 : u1;
          return new Point(
            p1x + clampedU1 * v1x,
            p1y + clampedU1 * v1y
          );
        } else {
          return new Point(
            p1x + u1 * v1x,
            p1y + u1 * v1y
          );
        }
      }
    }
    // 直線が平行または交差しない場合はundefinedを返す
    return undefined;
  }

  /**
   * 点が直線のどちら側にあるかを判定します。
   *
   * @param px 直線の始点のx座標
   * @param py 直線の始点のy座標
   * @param vx 直線のベクトルのx成分
   * @param vy 直線のベクトルのy成分
   * @param x 判定する点のx座標
   * @param y 判定する点のy座標
   * @param asVector 第3,4引数をベクトルとして扱うかどうか
   * @param isInfinite 直線を無限に延長するかどうか
   * @return 点が直線の左側にある場合は-1、右側にある場合は1、直線上にある場合は0
   */
  static getSide(
    px: number, py: number, vx: number, vy: number,
    x: number, y: number, asVector: boolean, isInfinite?: boolean
  ): number {
    if (!asVector) {
      vx -= px;
      vy -= py;
    }

    const v2x = x - px;
    const v2y = y - py;
    // 外積で判定
    let ccw = v2x * vy - v2y * vx;

    if (!isInfinite && Numerical.isMachineZero(ccw)) {
      // 点が無限直線上にある場合、有限直線上にもあるかチェック
      // v2をv1に射影し、uの値で判定
      // u = v2.dot(v1) / v1.dot(v1)
      ccw = (v2x * vx + v2y * vy) / (vx * vx + vy * vy);
      // uが[0,1]の範囲内なら直線上にある
      if (ccw >= 0 && ccw <= 1) {
        ccw = 0;
      }
    }

    return ccw < 0 ? -1 : ccw > 0 ? 1 : 0;
  }

  /**
   * 点から直線までの符号付き距離を計算します。
   *
   * @param px 直線の始点のx座標
   * @param py 直線の始点のy座標
   * @param vx 直線のベクトルのx成分
   * @param vy 直線のベクトルのy成分
   * @param x 距離を計算する点のx座標
   * @param y 距離を計算する点のy座標
   * @param asVector 第3,4引数をベクトルとして扱うかどうか
   * @return 符号付き距離
   */
  static getSignedDistance(
    px: number, py: number, vx: number, vy: number,
    x: number, y: number, asVector: boolean
  ): number {
    if (!asVector) {
      vx -= px;
      vy -= py;
  }
  // Based on the error analysis by @iconexperience outlined in #799
    return  vx === 0 ? (vy > 0 ? x - px : px - x)
          : vy === 0 ? (vx < 0 ? y - py : py - y)
          : ((x - px) * vy - (y - py) * vx) / (
              vy > vx
                  ? vy * Math.sqrt(1 + (vx * vx) / (vy * vy))
                  : vx * Math.sqrt(1 + (vy * vy) / (vx * vx))
          );
  }

  /**
   * 点から直線までの距離を計算します。
   *
   * @param px 直線の始点のx座標
   * @param py 直線の始点のy座標
   * @param vx 直線のベクトルのx成分
   * @param vy 直線のベクトルのy成分
   * @param x 距離を計算する点のx座標
   * @param y 距離を計算する点のy座標
   * @param asVector 第3,4引数をベクトルとして扱うかどうか
   * @return 距離
   */
  static getDistance(
    px: number, py: number, vx: number, vy: number,
    x: number, y: number, asVector: boolean
  ): number {
    return Math.abs(
      Line.getSignedDistance(px, py, vx, vy, x, y, asVector)
    );
  }
}