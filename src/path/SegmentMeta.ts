/**
 * SegmentMeta: Boolean演算のためのセグメント拡張情報
 * Segment クラスを汚染せず WeakMap で拡張情報を管理
 */

import { Segment } from './Segment';
import { Path } from './Path';
import { Point } from '../basic/Point';

/**
 * 交点情報
 * 元の Intersection インターフェースを再利用
 */
export interface IntersectionInfo {
  // 交点の座標
  point: Point;
  // 交点のパス1上のカーブインデックス
  curve1Index: number;
  // 交点のパス2上のカーブインデックス
  curve2Index: number;
  // 交点のパス1上のカーブパラメータ
  t1?: number | null;
  // 交点のパス2上のカーブパラメータ
  t2?: number | null;
  // 交点の種類（entry/exit）
  type?: 'entry' | 'exit';
  // 交点のwinding number
  winding?: number;
  // 交点の処理済みフラグ
  visited?: boolean;
  // 次の交点への参照（リンクリスト構造, paper.js互換）
  _next?: IntersectionInfo;
  // 前の交点への参照（リンクリスト構造, paper.js互換）
  _previous?: IntersectionInfo;
  // 交点のセグメント（paper.js互換）
  _segment?: Segment;
  // 交点が重なりかどうか
  _overlap?: boolean;
  // 交点の情報（自己参照または他の交点への参照, paper.js互換）
  _intersection?: IntersectionInfo;
}

/**
 * ワインディング情報
 */
export interface WindingInfo {
  // 基本ワインディング値
  winding: number;
  // 左側ワインディング
  windingL?: number;
  // 右側ワインディング
  windingR?: number;
}

/**
 * セグメント拡張情報
 * 元の SegmentInfo インターフェースを分割・整理
 */
export interface SegmentMeta {
  // セグメントが訪問済みかどうか
  visited?: boolean;
  // セグメントの交点情報
  intersection?: IntersectionInfo | null;
  // セグメントのwinding情報
  winding?: WindingInfo;
  // セグメントのパス
  path?: Path & {
    _overlapsOnly?: boolean;
    _closed?: boolean;
    _id?: number;
    compare?: (path: Path) => boolean;
  };
}

// WeakMap を使用してセグメントと拡張情報を関連付け
const metaStore = new WeakMap<Segment, SegmentMeta>();

/**
 * セグメントの拡張情報を取得
 * 存在しない場合は新しく作成して返す
 */
export function getMeta(segment: Segment | null | undefined): SegmentMeta | null | undefined {
  if (!segment) return null;
  
  let meta = metaStore.get(segment);
  if (!meta) {
    meta = {};
    metaStore.set(segment, meta);
  }
  return meta;
}

/**
 * セグメントの拡張情報を設定
 */
export function setMeta(segment: Segment, meta: SegmentMeta): void {
  metaStore.set(segment, meta);
}

/**
 * セグメントの拡張情報をクリア
 */
export function clearMeta(segment: Segment): void {
  metaStore.delete(segment);
}