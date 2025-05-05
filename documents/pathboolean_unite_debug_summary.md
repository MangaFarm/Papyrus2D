# Papyrus2D PathBoolean uniteバグ調査まとめ

## 1. 問題の現象

- `test/PathBoolean.test.ts` の「重なる矩形のunite」テストが失敗する。
- 期待されるパスデータは「M0,0L100,0L100,50L150,50L150,150L50,150L50,100L0,100Z」（複合パス1つ）だが、
- 実際の出力は「M0,0L100,0L100,100L0,100ZM50,50L150,50L150,150L50,150Z」（2つの矩形がそのまま）となる。

---

## 2. これまでの調査で分かったこと

### 2.1 交点検出の流れ

- unite本体で `PathBoolean.traceBoolean` → `getIntersections(_path1, _path2)` が呼ばれる。
- ここで交点が0個となり、単なるCompoundPath（2つの矩形）として返ってしまう。

### 2.2 パスの準備と向き

- `preparePath` で `clone(true)` した上で `resolveCrossings` → `reorient` を呼ぶ。
- reorientではsetClockwiseで時計回りに揃える処理が入る。

### 2.3 セグメント配列の順序

- unite本体で_path2.getSegments()は常に[ [ 50, 50 ], [ 150, 50 ], [ 150, 150 ], [ 50, 150 ] ]（時計回り）で安定している。
- しかしgetCurves()呼び出し時に[ [ 50, 50 ], [ 50, 150 ], [ 150, 150 ], [ 150, 50 ] ]（反時計回り）にズレているタイミングがある。

### 2.4 reverse()の副作用

- Path.reverse()はthis._segments.reverse()で配列を破壊的に反転している。
- さらに「reverse前の先頭点」をreverse後の配列で探して先頭にrotateする処理を追加したが、矩形reverse時に正しく先頭が揃わない場合がある。
- これにより、getCurves()のカーブ生成順が意図しない順序（反時計回り）になることがある。

### 2.5 交点検出失敗の直接原因

- getCurves()のカーブ生成順がズレることで、交点検出ロジックが「矩形の辺同士が正しく重ならない」と判定し、交点が0個になる。
- そのため、unite結果が単なるCompoundPath（2つの矩形）となる。

---

## 3. これまでに試した修正

- Path.reverse()でreverse後に「reverse前の先頭点」を探して先頭にrotateする処理を追加。
- しかし、矩形reverse時にreverse前の先頭点がreverse後の末尾に来るため、rotateのロジックが不十分で、依然としてカーブ生成順がズレる場合がある。

---

## 4. 根本原因の仮説

- Path.reverse()の「reverse前の先頭点」をreverse後の配列で正確に特定し、必ず0番目にrotateする必要がある。
- これが正しくできていないため、getCurves()のカーブ生成順がズレ、交点検出が失敗する。

---

## 5. 今後の調査・修正方針

- Path.reverse()の先頭揃えロジックを「reverse前の先頭点がreverse後のどこに来るか」を正確に特定し、そのインデックスを0番目にrotateするように修正する。
- これにより、reverseしても常に「元の先頭」が維持され、getCurves()のカーブ生成順が安定し、交点検出も正しくなるはず。

---

## 6. その他

- これまでのデバッグでconsole.logの出力が多すぎてバグることがあったため、デバッグ出力は最小限に絞っている。
- PathBooleanPreparation, CompoundPath, PathBooleanReorient, PathBooleanIntersections, CurveIntersectionMain, PathBoolean などの主要な箇所で破壊的な配列操作やreverseの副作用に注意が必要。

---