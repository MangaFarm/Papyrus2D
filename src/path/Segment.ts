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
}