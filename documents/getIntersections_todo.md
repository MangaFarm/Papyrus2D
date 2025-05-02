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
  - [ ] 再帰分割＋品質判定 `_getCurveIntersections` 完全版 (paper.js: Curve.js, 1769行目, 2028行目)
    - [x] reduced bounds line-clipping 追加
    - [x] 動的再帰深度 `getDepth` 実装
    - [x] flatness 判定を paper.js 同等に改善
    - [x] 微細な EPSILON の扱いを本家と完全一致させる
    - [ ] convex-hull fat-line clipping 補助関数の完全移植
      - [ ] getConvexHull / clipConvexHull 実装
      - [ ] addCurveLineIntersections / addLineIntersection 実装
    - [x] recursion / calls ガード (4096, 40) 実装
    - [x] Precision 定数を GEOMETRIC_EPSILON へ統一
  - [x] 交点重複/端点マージ `_addUniqueLocation` (paper.js: Curve.js, `addLocation`内に実装)
    - [x] curve ペア入替時の重複判定追加

- [ ] Path / PathItem
  - [x] `Path.getIntersections` に matrix 変換・include コールバック対応 (paper.js: PathItem.js, 321-339行目)
    - [x] 自己交差 (self-intersect) skip 判定追加
    - [ ] PathItem._matrix キャッシュ導入で行列適用を最適化
  - [x] `Path.contains` を paper.js の `_contains` 相当へ置換 (paper.js: PathItem.js, 257-281行目)
    - [x] `_isOnPath` の曲線上判定を改善
    - [x] 曲線上判定を Curve.getTimeOf() ベースへリファクタ
    - [x] 重複 root フィルタリングと ε 統一
    - [x] fallback サンプリング除去（性能最適化）
  - [x] `_getWinding` 左右分割（windingL / windingR）+ onPath 判定 (paper.js: PathItem.Boolean.js, 536-777行目)

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

現状の実装は「一般的な実務誤差 ≤ 1e-7 px」までの交差検出では paper.js と同等に振る舞いますが、
極端に degenerate な曲線配置や高倍率ズームでの Boolean 前処理では誤判定が残る可能性があります。

主な差異：
1. Curve._getCurveIntersections: convex-hull fat-line clipping 補助関数未移植
2. Path._isOnPath: Curve.getTimeOf() 相当ロジック未利用（root 重複フィルタ欠如）
3. 行列処理: paper.js の PathItem._matrix キャッシュでなく逐次 transform

上記を解消することで paper.js との完全互換性が達成できます。