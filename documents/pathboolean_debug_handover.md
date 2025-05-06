# PathBoolean バグ調査・引き継ぎメモ

## 現状の問題

- `test/PathBoolean.test.ts` の `PathItem#resolveCrossings()` などで、Papyrus2Dの出力パスが paper.js の期待値と一致しない。
- 具体的には、交点分割後のパスのセグメント列で `{ x: 150, y: 200 }` が `{ x: 200, y: 200 }` になっているなど、交点のt値割り当て・分割点の選択に差異がある。

## ここまでの調査・根拠

- paper.js本家の `tracePaths`, `divideLocations`, `getCrossingSegments`, `addCurveIntersections`, `addLocation` などのロジックとPapyrus2Dの実装を1行ずつ厳密に比較。
- Papyrus2Dの `divideLocations` のデバッグ出力では `time: 0` の交点ばかりが生成されており、交点CurveLocationのt値が正しく計算・割り当てされていないことが根本原因。
- `addCurveIntersections` の isolated 交点生成時の t, u も出力されていない。
- 交点分割時のCurveLocation生成・t値割り当てロジックがpaper.jsと異なるため、本来分割すべき交点（例: {150,200}）でなく、{200,200}を選択している。

## 重要なデバッグ出力

- `src/path/PathBooleanIntersections.ts` の `divideLocations` で、各交点CurveLocation生成時の `i, time, segment1, segment2, segment` を🔥で出力。
- `src/path/CurveIntersectionConvexHull.ts` の `addCurveIntersections` で、isolated交点生成時の `t, u, flip, pt1, pt2` を🔥で出力。
- `src/path/PathBooleanTracePaths.ts` の `getCrossingSegments` で、collect時の `other, next, nextInter, crossings, starts` を🔥で出力。

## 不要なconsole.logの削除指示

- 上記以外のconsole.logは削除してOK。
- 必要なものは「divideLocationsの交点生成」「addCurveIntersectionsのisolated交点生成」「getCrossingSegmentsのcollect分岐」のみ。

## 今後の方針

- CurveLocation生成時のt値割り当てロジック（特に交点計算時のt, uの計算・伝播）をpaper.jsと完全一致させることが最重要。
- それにより、resolveCrossingsの出力パスがpaper.jsと完全一致する見込み。

## 参考

- paper.js本家: `/paper.js/src/path/PathItem.Boolean.js`
- Papyrus2D: `src/path/PathBooleanTracePaths.ts`, `src/path/PathBooleanIntersections.ts`, `src/path/CurveIntersectionConvexHull.ts`, `src/path/CurveLocation.ts`