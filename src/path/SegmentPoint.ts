/**
 * SegmentPointクラス（Papyrus2D版, イミュータブル設計）
 * パス上の特定の点（アンカーポイントやハンドル点）を表現する。
 * Paper.jsの設計を参考にしつつ、グローバル状態や副作用を排除。
 */

import { Point } from '../basic/Point';

export type SegmentPointType = 'anchor' | 'handleIn' | 'handleOut';

export class SegmentPoint {
  public readonly point: Point;
  public readonly type: SegmentPointType;
  public readonly segmentIndex: number;

  /**
   * SegmentPointのコンストラクタ
   * @param point 点の座標
   * @param type 点の種類（anchor/handleIn/handleOut）
   * @param segmentIndex 属するSegmentのインデックス
   */
  constructor(
    point: Point,
    type: SegmentPointType = 'anchor',
    segmentIndex: number = 0
  ) {
    this.point = point;
    this.type = type;
    this.segmentIndex = segmentIndex;
    Object.freeze(this);
  }

  /**
   * SegmentPointを複製する（イミュータブル）
   */
  clone(): SegmentPoint {
    return new SegmentPoint(this.point, this.type, this.segmentIndex);
  }

  /**
   * 等価判定
   */
  equals(other: SegmentPoint): boolean {
    return (
      this.point.equals(other.point) &&
      this.type === other.type &&
      this.segmentIndex === other.segmentIndex
    );
  }

  /**
   * toString
   */
  toString(): string {
    return `{ point: ${this.point.toString()}, type: ${this.type}, segmentIndex: ${this.segmentIndex} }`;
  }
}