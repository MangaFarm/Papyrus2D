# PathIntersections.test.ts の問題点分析

これから行う修正だけ書きます。過去に行った修正は随時削除します。
このファイルはレポートではありません。行った修正はノイズなので、必ず削除してください。
テストに通らなくても、修正を行ったのなら削除してください。検証は別途行います。

## 問題の概要

`PathIntersections.test.ts` のテストが失敗しています。主な問題は、交点の数が期待値と一致していないことです：

- その他のテストケースでも交点が検出されていないものが多い
## paper.jsとPapyrus2Dの実装の違い

### 1. Path.getIntersections の違い

paper.jsとPapyrus2Dの`Path.getIntersections`メソッドには以下の重要な違いがあります：

1. **マトリックスの処理**:
   - paper.jsでは、`this._matrix._orNullIfIdentity()`を呼び出す際に`_matrix`がnullの場合でも問題なく動作します。これはpaper.jsの内部実装で、特定のプロパティにアクセスする前に存在チェックを行っているためです。
   - Papyrus2Dでは、`this._matrix`が`undefined`の場合に`this._matrix._orNullIfIdentity()`を呼び出すとエラーが発生します。アクセスする前の存在チェックがありません。

2. **境界チェックの問題**:
   - paper.jsでは、`this.getBounds(matrix1).intersects(path!.getBounds(matrix2), Numerical.EPSILON)`の条件が正確に評価されています。
   - Papyrus2Dでは、境界ボックス交差判定が期待通りに機能していない可能性があります。これにより交点検出の前に早期リターンしている可能性があります。

3. **交点検出アルゴリズム**:
   - テスト結果から、多くの場合交点が検出されておらず、一部のケースでは少ない交点数しか検出されていないことがわかります。
   - `Curve.getIntersections`関数の呼び出し方法や、その内部実装に問題がある可能性があります。

4. **自己交差の検出**:
   - paper.jsでは、`getSelfIntersection`関数により自己交差が正しく検出されますが、Papyrus2Dでは機能していない可能性があります。

5. **オーバーラップの処理**:
   - 円の交差テストでは、期待より多くの交点が検出されています（3つ検出、2つ期待）。これは`getOverlaps`関数やオーバーラップのフィルタリングに問題がある可能性があります。

6. **重複交点のフィルタリング**:
   - 重複交点を正確にフィルタリングするプロセスが異なる可能性があります。paper.jsでは`CurveLocation.insert`によってフィルタリングが行われます。

### 2. 重要な修正点

以下の修正が必要と考えられます：

1. **境界ボックスチェックの問題**:
   Papyrus2Dでは境界ボックスのチェックが強化されており、適切な条件で交点検出をスキップすべきではありません。add_diffで適用した修正でこの問題は対処済みです。

2. **交点計算アルゴリズムの問題**:
   テスト結果から、問題の本質は`addLineIntersection`や`getCurveIntersections`などの関数にありそうです。すべてのテストケースでうまく交点が検出されていません。Curve.getIntersections関数がCurveIntesections.tsの関数を正しく呼び出せていない可能性があります。

3. **根本的な問題**:
   特に単純な直線同士の交差さえ検出できていないことから、基本的な交点計算ロジックに欠陥があると考えられます。最も単純なケースからデバッグを開始します：

   ```typescript
   // 水平線と垂直線の交差
   const path1 = new Path([
     new Segment(new Point(0, 0)),
     new Segment(new Point(100, 0))
   ]);

   const path2 = new Path([
     new Segment(new Point(50, -50)),
     new Segment(new Point(50, 50))
   ]);
   
   // この場合、(50,0)に交点があるはず
   ```

4. **特に注目すべき点**:
   - `addLineIntersection`関数の実装: 線分同士の交差検出の基本部分
   - `getCurveIntersections`関数: 一般的な曲線の交差検出
   - `getSelfIntersection`関数: 自己交差の検出（特に自己交差テストで失敗している）

### 3. 推定される原因と対策

1. **Curve.getIntersections** の実装問題:
   - 特に散見される問題は、数値配列からCurveオブジェクトに変換する部分で、paper.jsと実装が異なる可能性
   - Curve.fromValues関数の実装を確認する必要あり

2. **addCurveIntersections** の問題:
   - 再帰アルゴリズムが深すぎるか、計算精度の問題で交点を見逃している可能性

3. **数値誤差の処理**:
   - paper.jsでは数値計算の安定性のための特別な処理が多数あるが、これが正しく移植されていない可能性

テスト結果と実装の比較から、単純な交点計算（線分同士の交点など）でさえ失敗していることから、根本的な実装ミスがあると考えられます。paper.jsのテストケースに準拠した形で実装が行われていないか、あるいは重要な処理部分が欠落している可能性があります。


