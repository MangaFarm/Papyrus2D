# Paper.js vs Papyrus2D: PathBoolean アルゴリズムの違い

このドキュメントでは、Paper.jsとPapyrus2Dの間のPathBooleanIntersectionsに関するアルゴリズム上の違いを分析します。

## 主要な違い

### 1. CurveLocation.expandメソッド

**Paper.js**: 
- CurveLocation.expandメソッドを使用して、交点情報を展開します。
- 交点の相互参照（_intersection）も配列に追加します。

**Papyrus2D**:
- 同様にCurveLocation.expandメソッドを実装し、交点情報を展開します。
- Paper.jsと同じ動作を実現するために、静的メソッドとして実装しています。

### 2. divideAtTimeメソッド

**Paper.js**:
- divideAtTimeメソッドは2つの引数を受け付けます：時間パラメータとハンドル設定フラグ。
- ハンドル設定フラグによって、分割後のカーブのハンドルを設定するかどうかを制御します。

**Papyrus2D**:
- 同様に2つの引数を受け付けるように実装しています。
- TypeScriptの型制約のため、戻り値の型が異なります（Paper.jsではCurveを返しますが、Papyrus2Dではインデックスを返します）。

### 3. 型の制約

**Paper.js**:
- JavaScriptの柔軟性を活かして、オブジェクトに直接プロパティを追加します。
- 動的な型変換が容易です。

**Papyrus2D**:
- TypeScriptの型制約により、明示的な型定義が必要です。
- 型キャストや型チェックが必要な場合があります。
- SegmentWithIntersectionのような拡張インターフェースを定義して型安全性を確保しています。

### 4. リンクリスト構造

**Paper.js**:
- 交点情報をリンクリスト構造として連結します。
- 各交点は次の交点（next）と前の交点（_previous）への参照を持ちます。

**Papyrus2D**:
- 同様のリンクリスト構造を実装していますが、TypeScriptの型制約のため、型キャストが必要です。
- linkIntersectionsメソッドはPaper.jsと同じ動作をします。

## 結論

Papyrus2DはPaper.jsのPathBoolean演算アルゴリズムを忠実に再現しています。主な違いはTypeScriptの型制約によるもので、アルゴリズム自体の動作には影響しません。いくつかの実装の詳細（型キャスト、インターフェース定義など）が異なりますが、これらはTypeScriptの型安全性を確保するために必要な変更です。

交点計算、交点の展開、パスの分割など、核となるアルゴリズムはPaper.jsと同じ動作をします。