/**
 * Segmentクラス（Papyrus2D版, イミュータブル設計）
 * Paper.jsのSegmentクラスを参考に、point/handleIn/handleOutを持つ。
 * グローバル状態や副作用を排除し、全てのプロパティはreadonly。
 */

import { Point } from '../basic/Point';

export class Segment {
  public readonly point: Point;
  public readonly handleIn: Point;
  public readonly handleOut: Point;

  /**
   * Segmentのコンストラクタ
   * @param point アンカーポイント
   * @param handleIn 入力ハンドル
   * @param handleOut 出力ハンドル
   */
  constructor(
    point: Point = new Point(0, 0),
    handleIn: Point = new Point(0, 0),
    handleOut: Point = new Point(0, 0)
  ) {
    this.point = point;
    this.handleIn = handleIn;
    this.handleOut = handleOut;
    Object.freeze(this);
  }

  /**
   * Segmentを複製する（イミュータブル）
   */
  clone(): Segment {
    return new Segment(this.point, this.handleIn, this.handleOut);
  }

  /**
   * ハンドルを反転した新しいSegmentを返す
   */
  reversed(): Segment {
    return new Segment(this.point, this.handleOut, this.handleIn);
  }

  /**
   * toString
   */
  toString(): string {
    const p = `point: ${this.point.toString()}`;
    const hi = this.handleIn && !this.handleIn.isZero() ? `, handleIn: ${this.handleIn.toString()}` : '';
    const ho = this.handleOut && !this.handleOut.isZero() ? `, handleOut: ${this.handleOut.toString()}` : '';
    return `{ ${p}${hi}${ho} }`;
  }

  /**
   * 等価判定
   */
  equals(other: Segment): boolean {
    return (
      this.point.equals(other.point) &&
      this.handleIn.equals(other.handleIn) &&
      this.handleOut.equals(other.handleOut)
    );
  }

  /**
   * Segment を平行移動した新しいインスタンスを返す
   * @param offset 移動量（Point もしくは number）。number の場合は dx とみなす
   * @param dy offset が number の場合の y 方向移動量（省略時は 0）
   */
  translate(offset: Point | number, dy: number = 0): Segment {
    const delta = offset instanceof Point ? offset : new Point(offset, dy);
    return new Segment(this.point.add(delta), this.handleIn, this.handleOut);
  }

  /**
   * Segment を回転させた新しいインスタンスを返す
   * @param angle 角度（度数法）
   * @param center 回転中心（デフォルトは原点）
   */
  rotate(angle: number, center: Point = new Point(0, 0)): Segment {
    const newPoint = this.point.rotate(angle, center);
    // ハンドルは point からの相対ベクトルなので原点中心で回転
    const newHandleIn = this.handleIn.rotate(angle);
    const newHandleOut = this.handleOut.rotate(angle);
    return new Segment(newPoint, newHandleIn, newHandleOut);
  }

  /**
   * Segment をスケール変換した新しいインスタンスを返す
   * @param scale スケール係数（Point もしくは number）。number の場合は等方スケール
   * @param sy scale が number の場合の y 方向スケール（省略時は scale と同値）
   * @param center スケール中心（デフォルトは原点）
   */
  scale(scale: Point | number, sy?: number, center: Point = new Point(0, 0)): Segment {
    let sx: number;
    let syVal: number;
    if (scale instanceof Point) {
      sx = scale.x;
      syVal = scale.y;
    } else {
      sx = scale;
      syVal = sy ?? scale;
    }

    // point は center からのベクトルにスケールを掛けて戻す
    const shifted = this.point.subtract(center).multiply(new Point(sx, syVal));
    const newPoint = shifted.add(center);

    // ハンドルは相対ベクトルなのでそのままスケール
    const newHandleIn = this.handleIn.multiply(new Point(sx, syVal));
    const newHandleOut = this.handleOut.multiply(new Point(sx, syVal));

    return new Segment(newPoint, newHandleIn, newHandleOut);
  }
  /**
   * handleOut のみを変更した新しい Segment を返す
   * @param handleOut 新しい handleOut
   */
  withHandleOut(handleOut: Point): Segment {
    return new Segment(this.point, this.handleIn, handleOut);
  }
}