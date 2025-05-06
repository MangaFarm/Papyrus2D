/**
 * SegmentPointクラス（Papyrus2D版）
 * Paper.jsのSegmentPointクラスを忠実に移植。
 * 内部用クラスのため、完全にミュータブルな実装。
 * レンダリングやDOM関連のコード（選択状態など）は除去。
 */

import { Point } from '../basic/Point';
import { Numerical } from '../util/Numerical';
import { Segment } from './Segment';

export class SegmentPoint {
  // 内部プロパティ
  _x: number;
  _y: number;
  _owner: Segment | undefined;

  /**
   * SegmentPointのコンストラクタ
   * @param point 点の座標（Point, 配列, または座標値）
   * @param owner この点を所有するSegment
   * @param key 所有者内でのプロパティ名（'point', 'handleIn', 'handleOut'）
   */
  constructor(
    point?: [number, number],
    owner?: Segment,
  ) {
    const x = point ? point[0] ?? 0 : 0;
    const y = point ? point[1] ?? 0 : 0;

    this._x = x;
    this._y = y;
    this._owner = owner;
  }

  /**
   * 座標を設定する内部メソッド
   * @param x X座標
   * @param y Y座標
   * @param change 変更通知フラグ（デフォルトはtrue）
   */
  _set(x: number, y: number, change: boolean = true): SegmentPoint {
    this._x = x;
    this._y = y;
    if (change && this._owner) {
      this._owner._changed(this);
    }
    return this;
  }

  /**
   * 別のSegmentPointの値をこのSegmentPointにセット
   * @param point セットするSegmentPoint
   */
  set(point: SegmentPoint): SegmentPoint {
    return this._set(point._x, point._y);
  }

  /**
   * X座標を取得
   */
  getX(): number {
    return this._x;
  }

  /**
   * X座標を設定
   */
  setX(x: number): void {
    this._x = x;
    if (this._owner) {
      this._owner._changed(this);
    }
  }

  /**
   * Y座標を取得
   */
  getY(): number {
    return this._y;
  }

  /**
   * Y座標を設定
   */
  setY(y: number): void {
    this._y = y;
    if (this._owner) {
      this._owner._changed(this);
    }
  }

  /**
   * このSegmentPointがゼロベクトルかどうか
   */
  isZero(): boolean {
    const isZero = Numerical.isZero;
    // パフォーマンス向上のため、アクセサを使わず内部プロパティを直接使用
    return isZero(this._x) && isZero(this._y);
  }

  /**
   * このベクトルとotherが同一直線上（外積が0）かどうか
   * 許容誤差はNumerical.GEOMETRIC_EPSILON
   */
  isCollinear(other: SegmentPoint): boolean {
    return Point.isCollinear(this._x, this._y, other._x, other._y);
  }

  /**
   * 等価判定
   */
  equals(other: SegmentPoint): boolean {
    return this === other || 
           (other instanceof SegmentPoint && this._x === other._x && this._y === other._y);
  }

  /**
   * 文字列表現
   */
  toString(): string {
    return `{ x: ${this._x}, y: ${this._y} }`;
  }

  /**
   * 複製
   */
  clone(): SegmentPoint {
    return new SegmentPoint([this._x, this._y]);
  }

  /**
   * Pointオブジェクトに変換
   */
  toPoint(): Point {
    return new Point(this._x, this._y);
  }

  /**
   * Pointオブジェクトから値を設定
   */
  setPoint(point: Point): void {
    this._set(point.x, point.y);
  }

  /**
   * 指定された点との距離を計算
   */
  getDistance(point: SegmentPoint): number {
    const x = point._x - this._x;
    const y = point._y - this._y;
    return Math.sqrt(x * x + y * y);
  }

  /**
   * ベクトル減算を行い、結果をPointオブジェクトとして返す
   */
  subtract(point: SegmentPoint): Point {
    return new Point(this._x - point._x, this._y - point._y);
  }

  /**
   * ベクトル乗算を行い、結果をPointオブジェクトとして返す
   */
  multiply(value: number | Point): Point {
    if (value instanceof Point) {
      return new Point(this._x * value.x, this._y * value.y);
    }
    return new Point(this._x * value, this._y * value);
  }
}