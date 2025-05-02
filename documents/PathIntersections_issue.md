# PathIntersections.test.ts の問題点分析

これから行う修正だけ書きます。過去に行った修正は随時削除します。
このファイルはレポートではありません。行った修正はノイズなので、必ず削除してください。

## 問題の概要

`PathIntersections.test.ts` のテストが失敗しています。主な問題は、交点の数が期待値と一致していないことです：

- 円と円の交差テスト：期待値は2点の交点ですが、実際には11点の交点が検出されています
- 円と四角形の交差テスト：期待値は2点の交点ですが、実際には交点が検出されていません
- 自己交差テスト：交点が検出されていません

## Path.getIntersections と paper.js の getIntersections の違い

paper.jsとPapyrus2Dの実装を比較した結果、以下の違いが見つかりました：

1. **excludeStart/excludeEndの実装の違い**:
   - paper.js: `excludeStart = !overlap && c1.getPrevious() === c2`
   - Papyrus2D: `excludeStart = !overlap && c1.segment1 === c2.segment2`
   この違いにより、連続するセグメント間の交点処理が異なります。paper.jsではカーブの前後関係を見ていますが、Papyrus2Dではセグメントの直接比較をしています。

2. **addLocationでの点の計算**:
   - paper.js: 点の計算を行わず、後で必要に応じて計算します
   - Papyrus2D: `const point = t1 !== null ? c1.getPointAt(t1) : new Point(0, 0);`
   Papyrus2Dでは常に点を計算していますが、paper.jsではnullを渡して後で必要に応じて計算します。

3. **自己交差の検出**:
   - paper.jsのgetSelfIntersection関数では、ループ曲線の場合にrootsの存在チェックのみを行っています
   - Papyrus2Dでは`info.roots && info.roots.length >= 2`という追加チェックを行っています
   この違いにより、自己交差の検出に差異が生じる可能性があります。

4. **CollisionDetection.findCurveBoundsCollisionsの結果処理**:
   - paper.jsでは結果を直接使用していますが、Papyrus2Dでは`if (collisions1 && Array.isArray(collisions1))`という追加チェックを行っています
   - これにより、境界衝突検出の結果処理に違いが生じる可能性があります。

5. **交点の座標変換処理**:
   - paper.jsでは交点が見つかった後に元の座標系に戻す処理が行われますが、Papyrus2Dでは条件付きで行われています
   - `if (matrix1 && !self) { ... }`という条件により、一部のケースで座標変換が行われない可能性があります。

6. **曲線の分類と自己交差**:
   - paper.jsのCurve.classify関数では、ループ曲線の場合にrootsを返しますが、Papyrus2Dでは追加チェックがあります
   - これにより、特に自己交差の検出に影響が出る可能性があります。

これらの違いが、特に円と円の交差テスト、円と四角形の交差テスト、自己交差テストの失敗の原因になっていると考えられます。
## 修正方針

Paper.jsとの相違点を優先的に修正し、Paper.jsの実装に忠実に合わせることを最優先します。独自の改善や最適化は行わず、まずはPaper.jsの実装を正確に再現することに注力します。