# Papyrus2D PathBoolean デバッグ引き継ぎ用ドキュメント（2025-05-05）

## 現状の問題の全体像

### 1. 交点検出（addLineIntersection）の違い
- Papyrus2Dは矩形の辺同士の交点検出で「端点一致」や「辺の重なり」を交点として正しく扱えていなかった。
- 端点一致は修正済みだが、辺の重なり（完全一致でない場合）は依然として検出できていない可能性がある。

### 2. winding numberの伝播
- 端点overlapな交点（端点一致で追加されたCurveLocation）に対してwinding numberが正しくセットされていなかったが、propagateWindingの修正でセットされるようになった。

### 3. tracePaths/isValidの判定
- winding numberがセットされている場合でも、operator[winding.winding]がfalseだと無効と判定される。
- 端点overlapな交点のwinding numberは { winding: 1, ... } で、operator[1]がtrueであれば有効と判定されるはずだが、tracePathsのパス構築ロジックがpaper.jsと完全一致していない可能性がある。

### 4. パス構築結果の違い
- Papyrus2Dでは、矩形のunite/intersect/subtract/excludeの結果がpaper.jsと異なる。
- これは、交点検出・winding number伝播・tracePathsのいずれかの段階で、端点overlapや辺の重なりが正しく扱われていないことが原因。

### 5. preparePathの副作用・空パス化バグ（再現確定）
- Papyrus2DのpreparePath（src/path/PathBooleanPreparation.ts）で、resolveCrossingsやreorientの後にパスが空（セグメントなし）になる現象が発生している。
- これにより、traceBooleanで_path2が空のPathになり、getIntersectionsで交点が全く検出されなくなる。
- DEBUG出力より、preparePathのreorient後に_path2が空のPath（セグメントなし）になっていることが確定。
- 原因は、resolveCrossingsやreorientの内部でパスのセグメントが消える、またはreduce/transformの副作用でパスが壊れること。
- paper.jsではこのような副作用は発生しない。
- さらに、getIntersectionsのデバッグ出力より、path2のセグメント配列が空（[]）であることが明確に確認できた。

---

## ここまでのデバッグログ・観察ポイント

- preparePathの各段階でgetSegments()を出力し、reorient後に空パス化することを確認。
- traceBooleanで_path2が空のPathになっているため、getIntersectionsで交点が全く検出されない。
- getIntersectionsのデバッグ出力で、path2のセグメント配列が空（[]）であることを確認。
- そのため、tracePathsに渡されるsegments配列も空になり、パス構築が全く行われない。

---

## 次にやるべき調査・修正ポイント

1. **preparePath/resolveCrossings/reorient/reduce/transformの副作用バグの修正**
   - なぜreorient後にパスが空になるのか、paper.jsの同等処理とdiffをとって調査。
   - 必要ならresolveCrossings/reorientの実装をpaper.jsから再移植。

2. **辺の重なり（完全一致でない場合）の交点検出ロジックの強化**
   - getOverlaps/addLineIntersectionのロジックをpaper.jsと完全一致させる。

3. **tracePathsのisValid判定・パス構築ロジックのさらなる精査**
   - winding numberの扱い、operatorの判定、visitedフラグの扱いなどをpaper.jsと比較。

4. **paper.jsのPathItem.Boolean.jsのtracePathsアルゴリズムとのdiffを再確認し、細部まで一致させる**

---

## デバッグ用console.logの削除について
- 主要なconsole.log/console.errorデバッグ出力は今後削除してください（必要なもの以外）。

---

## 参考ファイル
- `documents/papyrus2d_vs_paperjs_pathboolean_diff.md` … 問題点まとめ
- `src/path/PathBooleanPreparation.ts` … preparePath実装
- `src/path/PathBooleanIntersections.ts` … getIntersections実装
- `src/path/PathBooleanTracePaths.ts` … tracePaths実装
- `test/PathBoolean.test.ts` … テストケース