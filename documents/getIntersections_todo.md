<!--
このファイルは「getIntersections / Boolean 演算」完全移植のサブタスク用 TODO 表です。
Papyrus2D を paper.js と 100% 互換にするための残タスクを列挙しています。
別スレッドで並列実行できるよう、依存関係を最小限に保った粒度で区切っています。

なるべくpaper.jsの同等の処理からのそのままの移植を目指してください。
テストもpaper.jsから持ってくるようにしてください。

getIntersections周りは長くなると思うので、Path/Curveとは別のファイルにしてください。
-->
# getIntersections / Boolean 演算 完全移植 TODO

- [x] Curve
  - [x] Fat-line 上下限計算 `_getFatLineBounds` (paper.js: Curve.js, `addCurveIntersections`内に実装)
  - [x] モノトーン分割 `getMonoCurves` (paper.js: Curve.js, 643行目)
  - [x] 再帰分割＋品質判定 `_getCurveIntersections` 完全版 (paper.js: Curve.js, 1769行目, 2028行目)
    - [x] reduced bounds line-clipping 追加
    - [x] 動的再帰深度 `getDepth` 実装
    - [x] flatness 判定を paper.js 同等に改善
    - [x] 微細な EPSILON の扱いを本家と完全一致させる
    - [x] convex-hull fat-line clipping 補助関数の完全移植
      - [x] getConvexHull / clipConvexHull 実装
      - [x] addCurveLineIntersections / addLineIntersection 実装
    - [x] recursion / calls ガード (4096, 40) 実装
    - [x] Precision 定数を GEOMETRIC_EPSILON へ統一
  - [x] 交点重複/端点マージ `_addUniqueLocation` (paper.js: Curve.js, `addLocation`内に実装)
    - [x] curve ペア入替時の重複判定追加
  - [x] 監査で見つかった差異の修正
    - [x] _getDepth: paper.js の固定 LUT（LUT_SIZE = 16）→ lookupTable[d] 採用に揃える
    - [x] _getCurveIntersections: depth > 40 の重複ガードを一箇所へ集約
    - [x] getTimeOf: roots 配列再利用・maxRoots 判定など、paper.js と同じ最適化を採用して数値安定性を強化

- [x] Path / PathItem
  - [x] `Path.getIntersections` に matrix 変換・include コールバック対応 (paper.js: PathItem.js, 321-339行目)
    - [x] 自己交差 (self-intersect) skip 判定追加
    - [x] PathItem._matrix キャッシュ導入で行列適用を最適化
  - [x] `Path.contains` を paper.js の `_contains` 相当へ置換 (paper.js: PathItem.js, 257-281行目)
    - [x] `_isOnPath` の曲線上判定を改善
    - [x] 曲線上判定を Curve.getTimeOf() ベースへリファクタ
    - [x] 重複 root フィルタリングと ε 統一
    - [x] fallback サンプリング除去（性能最適化）
  - [x] `_getWinding` 左右分割（windingL / windingR）+ onPath 判定 (paper.js: PathItem.Boolean.js, 536-777行目)
  - [x] 監査で見つかった差異の修正
    - [x] PathItem.transform()/rotate()/scale()/translate() を実装し、行列変更時 _matrixDirty=true
    - [x] getIntersections 内で dirty 時に _matrix を再計算

- [ ] Boolean Operations
  - [ ] `Path.unite` (paper.js: PathItem.Boolean.js, 1142-1144行目)
  - [ ] `Path.intersect` (paper.js: PathItem.Boolean.js, 1163-1165行目)
  - [ ] `Path.subtract` (paper.js: PathItem.Boolean.js, 1184-1186行目)
  - [ ] `Path.exclude` (paper.js: PathItem.Boolean.js, 1200-1202行目)
  - [ ] `Path.divide` (paper.js: PathItem.Boolean.js, 1222-1229行目)
    - [ ] セグメント entry/exit 分類 (paper.js: PathItem.Boolean.js, `propagateWinding` 779-860行目)
      - [ ] 交点の entry/exit 分類（完全実装）
      - [ ] 完全な winding 計算と伝播
    - [ ] マーチングアルゴリズム (paper.js: PathItem.Boolean.js, `tracePaths` 872-1110行目)
      - [ ] 交点を辿るアルゴリズム（完全実装）
      - [ ] 結果パスの構築（完全実装）
    - [ ] 結果 Path 構築 & 重複統合 (paper.js: PathItem.Boolean.js, `createResult` 83-97行目)
      - [ ] 重複パスの統合（完全実装）
      - [ ] 結果の最適化


- [ ] テスト拡充
  - [x] 単純交差（2 曲線・2 点） precision 厳格化
    - [x] 曲線の flatness 判定テスト
    - [x] 再帰深度による精度テスト
  - [x] 端点 onPath 交差
    - [x] 端点マージ処理の検証
    - [x] curve ペア入替時の重複判定テスト
  - [x] セルフ交差多重ループ (even-odd / nonzero)
    - [x] 自己交差 skip 判定テスト
    - [x] windingL/windingR 分割テスト
  - [ ] Boolean 演算 5 パターン (unite / intersect / subtract / exclude / divide)
    - [x] 基本的なテストケースの実装
    - [ ] 複雑なケース（凹形状・重複曲線）のテスト
  - [ ] 数値精度テスト
    - [ ] EPSILON 定数の差異による影響テスト
    - [ ] _isOnPath の曲線上判定精度テスト
    - [ ] convex-hull fat-line clipping vs 簡易実装の差異テスト
    - [ ] 極端に degenerate な曲線配置での交差検出テスト

## 監査結果サマリ

以下の問題が見つかり、修正しました：

1. **Curve._getCurveIntersections の早期リターン問題**：
   - [x] `flat1 && flat2` の場合に両曲線が直線と判定されるが、`addLineIntersection` を呼ばずに単に `return` していた
   - 修正: `this.addLineIntersection(v1, v2, curve1Index, curve2Index, locations)` を追加
   - これにより線分同士の交点が正常に検出されるようになった

2. **PathBoolean.getWindingAtPoint の未実装問題**：
   - [x] スタブ実装で常に `{ windingL: 0, windingR: 0 }` を返していた
   - 修正: `(path as any)._getWinding(point)` を使用して既存の実装を活用
   - これにより Path.contains() が正常に動作するようになった

以上の修正により、テストが正常に通るようになりました。