/**
 * Papyrus2D Point クラス（イミュータブル設計, TypeScript）
 * paper.js の Point 実装をベースに、イミュータブル・副作用なし・グローバル排除で再設計
 */
import { Numerical } from '../util/Numerical';
import { Matrix } from './Matrix';
import { Rectangle } from './Rectangle';

export class Point {
  readonly x: number;
  readonly y: number;

  constructor(x: number = 0, y: number = 0) {
    this.x = x;
    this.y = y;
    Object.freeze(this);
  }

  /**
   * 座標が等しいかどうかを判定
   * paper.jsのequals実装に近づける
   */
  equals(point: Point | number[]): boolean {
    return this === point ||
           (point instanceof Point && this.x === point.x && this.y === point.y) ||
           (Array.isArray(point) && point.length >= 2 && this.x === point[0] && this.y === point[1]);
  }

  clone(): Point {
    return new Point(this.x, this.y);
  }

  add(other: Point): Point {
    return new Point(this.x + other.x, this.y + other.y);
  }

  subtract(other: Point): Point {
    return new Point(this.x - other.x, this.y - other.y);
  }

  multiply(value: number | Point): Point {
    if (value instanceof Point) {
      return new Point(this.x * value.x, this.y * value.y);
    }
    return new Point(this.x * value, this.y * value);
  }

  divide(value: number | Point): Point {
    if (value instanceof Point) {
      return new Point(this.x / value.x, this.y / value.y);
    }
    return new Point(this.x / value, this.y / value);
  }

  getLength(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  /**
   * ベクトルの角度を度数法で取得
   * 引数なしの場合は自身の角度を返す
   * 引数ありの場合は2つのベクトル間の角度を計算
   * paper.jsのgetAngle実装に合わせる
   */
  getAngle(point?: Point): number {
    if (point === undefined) {
      // 引数なしの場合は自身の角度を返す
      if (this.isZero()) {
        return 0;
      }
      return Math.atan2(this.y, this.x) * 180 / Math.PI;
    } else {
      // 引数ありの場合は2つのベクトル間の角度を計算
      const div = this.getLength() * point.getLength();
      if (Numerical.isZero(div)) {
        return NaN;
      } else {
        const a = this.dot(point) / div;
        return Math.acos(a < -1 ? -1 : a > 1 ? 1 : a) * 180 / Math.PI;
      }
    }
  }

  /**
   * 長さを1（または指定された値）に正規化したベクトルを返す
   * paper.jsのnormalize実装に近づける
   */
  normalize(length: number = 1): Point {
    const current = this.getLength();
    const scale = current !== 0 ? length / current : 0;
    const point = new Point(this.x * scale, this.y * scale);
    return point;
  }

  /**
   * ベクトルの角度をラジアンで取得
   * 引数なしの場合は自身の角度を返す
   * 引数ありの場合は2つのベクトル間の角度を計算
   * paper.jsのgetAngleInRadians実装に合わせる
   */
  getAngleInRadians(point?: Point): number {
    if (point === undefined) {
      // 引数なしの場合は自身の角度を返す
      if (this.isZero()) {
        return 0;
      }
      return Math.atan2(this.y, this.x);
    } else {
      // 引数ありの場合は2つのベクトル間の角度を計算
      const div = this.getLength() * point.getLength();
      if (Numerical.isZero(div)) {
        return NaN;
      } else {
        const a = this.dot(point) / div;
        return Math.acos(a < -1 ? -1 : a > 1 ? 1 : a);
      }
    }
  }

  /**
   * 指定された角度だけ回転した新しいPointを返す
   * paper.jsのrotate実装に近づける
   */
  rotate(angle: number, center?: Point): Point {
    if (angle === 0) return this.clone();
    
    angle = angle * Math.PI / 180;
    const point = center ? this.subtract(center) : this;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    
    const rotated = new Point(
      point.x * cos - point.y * sin,
      point.x * sin + point.y * cos
    );
    
    return center ? rotated.add(center) : rotated;
  }

  /**
   * 行列変換を適用した新しいPointを返す
   * paper.jsのtransform実装を移植
   */
  transform(matrix: Matrix | null): Point {
    return matrix ? matrix.transform(this) : this.clone();
  }

  /**
   * 指定された矩形の内部にあるかどうかを判定
   * paper.jsのisInside実装を移植
   */
  isInside(rect: Rectangle): boolean {
    return rect.contains(this);
  }

  toString(): string {
    return `{ x: ${this.x}, y: ${this.y} }`;
  }

  /**
   * このベクトルとotherが同一直線上（外積が0）かどうか
   * 許容誤差はNumerical.GEOMETRIC_EPSILON
   */
  isCollinear(other: Point): boolean {
    // paper.jsの実装に合わせる
    return Point.isCollinear(this.x, this.y, other.x, other.y);
  }

  /**
   * このベクトルがゼロベクトルかどうか
   */
  public isZero(): boolean {
    const isZero = Numerical.isZero;
    return isZero(this.x) && isZero(this.y);
  }
  
  /**
   * 指定された点との距離が epsilon 以下かどうかを判定
   * paper.jsのisClose実装を移植
   */
  isClose(point: Point, epsilon: number): boolean {
    return this.getDistance(point) <= epsilon;
  }

  /**
   * 指定された点との距離を計算
   * paper.jsのgetDistance実装を移植
   */
  getDistance(point: Point, squared: boolean = false): number {
    const x = point.x - this.x;
    const y = point.y - this.y;
    const d = x * x + y * y;
    return squared ? d : Math.sqrt(d);
  }

  /**
   * 内積（ドット積）を計算
   * paper.jsのPoint.dot実装を移植
   */
  dot(point: Point): number {
    return this.x * point.x + this.y * point.y;
  }

  /**
   * 外積（クロス積）を計算
   * paper.jsのPoint.cross実装を移植
   */
  cross(point: Point): number {
    return this.x * point.y - this.y * point.x;
  }

  /**
   * 2つのベクトル間の有向角度を計算
   * paper.jsのgetDirectedAngle実装を移植
   */
  getDirectedAngle(point: Point): number {
    return Math.atan2(this.cross(point), this.dot(point)) * 180 / Math.PI;
  }

  /**
   * このベクトルが他のベクトルと直交しているかを判定
   * paper.jsのisOrthogonal実装を移植
   */
  isOrthogonal(point: Point): boolean {
    return Point.isOrthogonal(this.x, this.y, point.x, point.y);
  }

  /**
   * このベクトルの象限を取得
   * paper.jsのgetQuadrant実装を移植
   */
  getQuadrant(): number {
    return this.x >= 0 ? this.y >= 0 ? 1 : 4 : this.y >= 0 ? 2 : 3;
  }

  /**
   * 座標を四捨五入した新しいPointを返す
   * paper.jsのround実装を移植
   */
  round(): Point {
    return new Point(Math.round(this.x), Math.round(this.y));
  }

  /**
   * 座標を切り上げた新しいPointを返す
   * paper.jsのceil実装を移植
   */
  ceil(): Point {
    return new Point(Math.ceil(this.x), Math.ceil(this.y));
  }

  /**
   * 座標を切り捨てた新しいPointを返す
   * paper.jsのfloor実装を移植
   */
  floor(): Point {
    return new Point(Math.floor(this.x), Math.floor(this.y));
  }

  /**
   * 座標の絶対値を取った新しいPointを返す
   * paper.jsのabs実装を移植
   */
  abs(): Point {
    return new Point(Math.abs(this.x), Math.abs(this.y));
  }

  /**
   * このベクトルの反対方向のベクトルを返す
   * paper.jsのnegate実装を移植
   */
  negate(): Point {
    return new Point(-this.x, -this.y);
  }

  /**
   * 剰余演算を行い、新しいPointを返す
   * paper.jsのmodulo実装を移植
   */
  modulo(value: number | Point): Point {
    if (value instanceof Point) {
      return new Point(this.x % value.x, this.y % value.y);
    }
    return new Point(this.x % value, this.y % value);
  }

  /**
   * 座標がNaNかどうかを判定
   * paper.jsのisNaN実装を移植
   */
  isNaN(): boolean {
    return isNaN(this.x) || isNaN(this.y);
  }

  /**
   * 点が指定された象限内にあるかどうかを判定
   * paper.jsのisInQuadrant実装を移植
   */
  isInQuadrant(q: number): boolean {
    return this.x * (q > 1 && q < 4 ? -1 : 1) >= 0
      && this.y * (q > 2 ? -1 : 1) >= 0;
  }

  /**
   * このベクトルの他のベクトルへの射影を計算
   * paper.jsのproject実装を移植
   */
  project(point: Point): Point {
    const scale = point.isZero() ? 0 : this.dot(point) / point.dot(point);
    return new Point(
      point.x * scale,
      point.y * scale
    );
  }

  /**
   * 2つのPointの中で各座標の小さい方を持つPointを返す
   * paper.jsのPoint.min実装を移植
   */
  static min(point1: Point, point2: Point): Point {
    return new Point(
      Math.min(point1.x, point2.x),
      Math.min(point1.y, point2.y)
    );
  }

  /**
   * 2つのPointの中で各座標の大きい方を持つPointを返す
   * paper.jsのPoint.max実装を移植
   */
  static max(point1: Point, point2: Point): Point {
    return new Point(
      Math.max(point1.x, point2.x),
      Math.max(point1.y, point2.y)
    );
  }

  /**
   * 0から1の範囲のランダムな座標を持つPointを返す
   * paper.jsのPoint.random実装を移植
   */
  static random(): Point {
    return new Point(Math.random(), Math.random());
  }

  /**
   * 2つのベクトルが同一直線上（外積が0）かどうかを判定
   * paper.jsのPoint.isCollinear静的メソッドを移植
   */
  static isCollinear(x1: number, y1: number, x2: number, y2: number): boolean {
    // 正規化されたベクトルを使用して信頼性の高いイプシロン比較を行う
    return Math.abs(x1 * y2 - y1 * x2)
      <= Math.sqrt((x1 * x1 + y1 * y1) * (x2 * x2 + y2 * y2))
        * Numerical.TRIGONOMETRIC_EPSILON;
  }

  /**
   * 2つのベクトルが直交しているかを判定
   * paper.jsのPoint.isOrthogonal静的メソッドを移植
   */
  static isOrthogonal(x1: number, y1: number, x2: number, y2: number): boolean {
    return Math.abs(x1 * x2 + y1 * y2)
      <= Math.sqrt((x1 * x1 + y1 * y1) * (x2 * x2 + y2 * y2))
        * Numerical.TRIGONOMETRIC_EPSILON;
  }
}
