/**
 * SegmentAnalysis: Boolean演算のためのセグメント拡張情報
 * Segment クラスに_analysisプロパティとして埋め込む
 */

import { Path } from './Path';
import { Point } from '../basic/Point';
import { CurveLocation } from './CurveLocation';
import { Segment } from './Segment';

/**
 * 交点情報
 * 元の Intersection インターフェースを再利用
 */
export interface IntersectionInfo {
  point: Point;
  curve1Index: number;
  curve2Index: number;
  t1?: number | null;
  t2?: number | null;
  type?: 'entry' | 'exit';
  winding?: number;
  visited?: boolean;
  _next?: IntersectionInfo;
  _previous?: IntersectionInfo;
  _segment?: Segment;
  _overlap?: boolean;
  _intersection?: IntersectionInfo;
}

/**
 * ワインディング情報
 */
export interface WindingInfo {
  winding: number;
  windingL?: number;
  windingR?: number;
}

/**
 * セグメント拡張情報
 * paper.jsのSegment._visited, _intersection, _winding, _pathに対応
 */
export interface SegmentAnalysis {
  _visited?: boolean;
  _intersection?: CurveLocation | null;
  _winding?: WindingInfo;
  _path?: Path & {
    _overlapsOnly?: boolean;
    _closed?: boolean;
    _id?: number;
    compare?: (path: Path) => boolean;
  };
}