# paper.js vs Papyrus2D: PathBooleanWinding アルゴリズム差異分析

## 概要

Papyrus2DのPathBooleanWinding.tsは、paper.jsのPathItem.Boolean.jsのwinding number計算部分を移植したものですが、いくつかの実装上の違いがあります。以下では、挙動に差が出うる主要な違いを分析します。

## 1. winding number計算

### getWinding関数

- **paper.js**: 
  - 点に対するwinding numberを計算する関数
  - 曲線の衝突マップを使用して効率的に計算
  - 左右のwinding numberを別々に計算

- **Papyrus2D**: 
  - 基本的なアルゴリズムは同じ
  - TypeScriptの型安全性のための調整が行われている
  - 特にビット演算子の使用方法が異なる（paper.jsでは `path.isClockwise(closed) ^ dir ? 1 : -1` だが、Papyrus2Dでは `(path.isClockwise(closed) !== dir) ? 1 : -1`）

この違いは、特定のエッジケースでのwinding number計算に影響を与える可能性があります。特に、閉じたパスと開いたパスの境界付近での計算結果が異なる可能性があります。

## 2. winding numberの伝播

### propagateWinding関数

- **paper.js**: 
  - セグメントチェーンに沿ってwinding numberを伝播する関数
  - 複数の点でwinding numberを計算し、最も信頼性の高い結果を使用

- **Papyrus2D**: 
  - 基本的なアルゴリズムは同じ
  - TypeScriptの型安全性のための調整が行われている
  - セグメント情報の取得方法が異なる（型キャストを使用）

この違いは、複雑なパスや自己交差するパスでのwinding number伝播に影響を与える可能性があります。

## 3. 型の扱いの違い

- **paper.js**: 
  - JavaScriptの柔軟な型システムを活用
  - プロパティの動的な追加が可能

- **Papyrus2D**: 
  - TypeScriptの静的型システムに適応するための調整
  - SegmentInfoインターフェースの定義と型キャスト
  - asSegmentInfo関数を使用して型安全性を確保

この違いは直接的なアルゴリズムの違いではありませんが、型の扱いの違いによって、特定のエッジケースでの挙動が異なる可能性があります。

## 4. 追加された機能

### getWindingContribution関数

- **paper.js**: 
  - 明示的な関数として存在しない（内部ロジックに組み込まれている）

- **Papyrus2D**: 
  - 交点のwinding numberの寄与を計算する独立した関数として実装
  - Boolean演算の種類に応じた計算ロジックを提供

この追加機能は、Papyrus2Dでのコード構造の違いによるもので、機能的には同等ですが、モジュール化されたアプローチにより、特定のケースでの挙動が異なる可能性があります。

## 結論

Papyrus2DのPathBooleanWinding.tsは、paper.jsのwinding number計算アルゴリズムを基本的に踏襲していますが、TypeScriptの型システムへの適応や、一部の演算子の使用方法の違いがあります。これらの違いは、特に複雑なパスや自己交差するパス、閉じたパスと開いたパスの境界付近での計算結果に影響を与える可能性があります。

最も重要な違いは、ビット演算子の使用方法の違いと、型の扱いの違いです。これらは、Boolean演算の結果の精度や安定性に影響を与える可能性があります。