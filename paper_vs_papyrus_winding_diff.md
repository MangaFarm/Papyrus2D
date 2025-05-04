# paper.jsとPapyrus2DのPathBooleanWindingモジュールの違い

このドキュメントでは、paper.jsとPapyrus2DのPathBooleanWindingモジュールにおけるアルゴリズム上の違いを分析します。

## 概要

Papyrus2DのPathBooleanWindingモジュールは、paper.jsのPathItem.Boolean.jsから移植されています。基本的なアルゴリズムは同じですが、いくつかの実装の違いがあります。

## 主な違い

### 1. モジュール構造

- **paper.js**: PathItem.Boolean.jsファイル内に実装されています。
- **Papyrus2D**: PathBooleanWinding.tsとして独立したモジュールに分離されています。

これは単なる構造上の違いであり、アルゴリズムには影響しません。

### 2. 型システム

- **paper.js**: JavaScriptで実装されています。
- **Papyrus2D**: TypeScriptで実装され、型安全性が向上しています。

これも基本的なアルゴリズムには影響しません。

## アルゴリズム上の違い

以下の点で、paper.jsとPapyrus2Dの間にアルゴリズム上の違いはありませんでした：

1. **getWinding関数**:
   - 座標インデックスの解釈（dir=trueはy方向、dir=falseはx方向）
   - 水平曲線の特殊処理
   - 曲線上の時間パラメータの計算
   - 曲線上の点の横座標の計算
   - 曲線の始点での処理
   - 標準的なケースの処理
   - パスの最後の曲線の処理
   - パス上にあり、windingが相殺された場合の処理

2. **propagateWinding関数**:
   - 曲線チェーンの構築
   - winding numberの計算
   - winding numberの伝播

3. **getWindingContribution関数**:
   - winding寄与の計算

## 結論

paper.jsとPapyrus2DのPathBooleanWindingモジュールは、アルゴリズム上の違いはありません。違いは主に言語（JavaScriptからTypeScript）とモジュール構造の変更に関するものです。Papyrus2Dは、paper.jsのアルゴリズムを忠実に再現しています。