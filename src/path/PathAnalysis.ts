/**
 * PathAnalysis: Boolean演算など一時的なPath拡張情報
 * Path本体に直接埋め込む
 */
export class PathAnalysis {
  /** 完全overlap判定用フラグ (paper.js: _overlapsOnly) */
  _overlapsOnly: boolean = false;
  // 必要に応じて他の一時情報もここに追加
}