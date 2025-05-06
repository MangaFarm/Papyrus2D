# PathBoolean系デバッグ・二分探索の引き継ぎドキュメント

## どのテスト・コマンドで何が出るか

- **`npm test test/PathBooleanResolveCrossings.debug.test.ts`**
  - `test/PathBooleanResolveCrossings.debug.test.ts` の `"trace add for paper.js #1"` テストを実行。
  - `src/path/PathBooleanResolveCrossings.ts` の resolveCrossings 内で
    - `[resolveCrossings] after divideLocations: ...`
    - `🔥 intersections: ...`（divideLocations直後のintersections配列の内容）
    - `🔥 allSegments: ...`（tracePathsに渡すsegments配列の内容・順序）
    - `🔥 segments state: ...`（各セグメントのwinding/visited状態）
  - `src/path/CurveLocationUtils.ts` の equals で
    - `🔥 equals step: ...`（等価判定の各ステップ）

- **`npm test test/PathBoolean.test.ts`**
  - PathBooleanの本番テスト。失敗時に
    - `[resolveCrossings] after divideLocations: ...`
    - `🔥 [resolveCrossings] tracePaths: ...`
    - `🔥 [resolveCrossings] reduce: ...`
    - `🔥 Papyrus2D resolveCrossings segments: ...`
    - などが出る（resolveCrossings, tracePaths, reduceのSVG出力やセグメント列）

## 現状の問題

- `test/PathBoolean.test.ts` の `PathItem#resolveCrossings()` などで、SVG出力が paper.js と一致しない。
- Papyrus2Dの `tracePaths` でパス構築が途中で止まり、`l0,-50l0,-50l100,0` のような分割列になる（本来は `l50,-50l-50,0` になるべき）。
- `divideLocations` 直後の `intersections` 配列に `{ x: 100, y: 200 }` のような同一座標の交点が大量に生成されている。
- `tracePaths` に渡す `segments` 配列の内容・順序は13個で、同じ点が複数回現れるが、`intersections` ほどの重複はない。
- `segments` の各要素の winding はすべて1、visitedはundefined（未訪問）である。

## これまでの二分探索・デバッグ証拠

- `isValid` の判定や `visited` のpush/リセット/再利用、分岐処理はpaper.jsと一致している。
- `CurveLocation.expand` で `insert` の `merge` 引数をtrueにしても、`intersections` の重複は解消しない。
- `CurveLocationUtils.equals` の等価判定の精度や、`getOffset`/`getCurve` のキャッシュ・再計算の精度に差異がある可能性が高い。
- `equals` の判定過程をデバッグプリントで追うと、`offset mismatch` でfalseになるケースが多い。

## 重要なデバッグ出力例

- `🔥 intersections:` の出力で `{ x: 100, y: 200 }` が大量に並ぶ。
- `🔥 allSegments:` の出力で `{ x: 100, y: 300 } | { x: 100, y: 250 } | ...` のような点列が得られる。
- `🔥 segments state:` の出力で winding/visited の状態がわかる。
- `🔥 equals step:` の出力で `offset mismatch` でfalseになるケースが多い。

## 直近の修正・調査ポイント

- `CurveLocationUtils.equals` の判定精度・再帰的比較・getOffsetの精度をpaper.jsと完全一致させる必要がある。
- `CurveLocation.expand` で `insert` の `merge` 引数をtrueにしても、重複除去が不十分な場合は、equalsの判定精度をさらに上げる必要がある。
- `divideLocations` 直後の `intersections` 配列の内容・順序がpaper.jsと一致しているか、またはPapyrus2D特有の現象かを引き続き比較すること。

## 今後の二分探索・デバッグ方針

1. `CurveLocationUtils.equals` の判定過程をさらに細かくデバッグプリントし、どの条件でfalseになるかを突き止める。
2. `getOffset` や `getCurve` のキャッシュ・再計算の精度をpaper.jsと完全一致させる。
3. `divideLocations` 直後の `intersections` 配列の内容・順序をpaper.jsと比較し、重複除去・正規化のロジックを合わせる。
4. それでも解決しない場合は、`tracePaths` の分岐処理や `isValid` の判定、`visited` の管理を再度精査する。

---

**このドキュメントは、PathBoolean系の二分探索デバッグの現状証拠・方針・どのコマンドで何が出るかを引き継ぐためのものです。**