/**
 * SegmentPointクラス（Papyrus2D版）
 * Paper.jsのSegmentPointクラスを忠実に移植。
 * 内部用クラスのため、完全にミュータブルな実装。
 * レンダリングやDOM関連のコード（選択状態など）は除去。
 */

import { Point } from '../basic/Point';
import { Numerical } from '../util/Numerical';

export class SegmentPoint {
  // 内部プロパティ
  _x: number;
  _y: number;
  _owner: any; // Segment型を参照するとcircular dependencyになるため、any型を使用

  /**
   * SegmentPointのコンストラクタ
   * @param point 点の座標（Point, 配列, または座標値）
   * @param owner この点を所有するSegment
   * @param key 所有者内でのプロパティ名（'point', 'handleIn', 'handleOut'）
   */
  constructor(point?: Point | number[] | any, owner?: any, key?: string) {
    let x: number, y: number;

    if (!point) {
      x = y = 0;
    } else if (Array.isArray(point)) {
      x = point[0] || 0;
      y = point[1] || 0;
    } else if (typeof point === 'number') {
      x = point;
      y = arguments[1] as number;
      owner = arguments[2];
      key = arguments[3] as string;
    } else {
      // Point-likeオブジェクト
      const pt = point;
      if (pt.x === undefined) {
        // Point.readに相当する処理（簡略化）
        const p = new Point(arguments[0] as number, arguments[1] as number);
        x = p.x;
        y = p.y;
      } else {
        x = pt.x;
        y = pt.y;
      }
    }

    this._x = x;
    this._y = y;
    this._owner = owner;
    
    // ownerに自身を設定
    if (owner && key) {
      owner[key] = this;
    }
  }

  /**
   * 座標を設定する内部メソッド
   * @param x X座標
   * @param y Y座標
   */
  _set(x: number, y: number): SegmentPoint {
    this._x = x;
    this._y = y;
    if (this._owner) {
      this._owner._changed(this);
    }
    return this;
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
    return new SegmentPoint(new Point(this._x, this._y));
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
}