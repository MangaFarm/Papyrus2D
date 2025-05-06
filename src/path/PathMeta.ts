/**
 * PathMeta: Boolean演算など一時的なPath拡張情報
 * Path本体を汚染せず WeakMap で拡張情報を管理
 */

import { Path } from './Path';

/**
 * Pathの一時的な拡張情報（paper.js互換プロパティ）
 */
export interface PathMeta {
  /** 完全overlap判定用フラグ (paper.js: _overlapsOnly) */
  _overlapsOnly?: boolean;
}

const pathMetaStore = new WeakMap<Path, PathMeta>();

/**
 * Pathの拡張情報を取得（なければ新規作成）
 */
export function getPathMeta(path: Path | null | undefined): PathMeta | null | undefined {
  if (!path) return null;
  let meta = pathMetaStore.get(path);
  if (!meta) {
    meta = {};
    pathMetaStore.set(path, meta);
  }
  return meta;
}

/**
 * Pathの拡張情報を設定
 */
export function setPathMeta(path: Path, meta: PathMeta): void {
  pathMetaStore.set(path, meta);
}

/**
 * Pathの拡張情報をクリア
 */
export function clearPathMeta(path: Path): void {
  pathMetaStore.delete(path);
}