# Papyrus2D vs paper.js Path Boolean 差異・問題点まとめ（2025-05-05時点・preparePath空パス化バグ追記）

## 1. 交点検出（addLineIntersection）の違い
- **Papyrus2D**では、矩形の辺同士の交点検出で「端点一致」や「辺の重なり」を交点として正しく扱えていなかった。
  - 端点一致（例：2つの矩形のコーナーが重なる場合）を交点としてCurveLocationに追加するロジックがなかった。
  - 辺の重なり（共線かつ重複）もgetOverlapsでしか検出していなかったが、完全一致でなければ検出されない。
- **paper.js**では、端点一致や辺の重なりも交点（overlap）としてCurveLocationに追加し、パス構築に利用している。

### 修正状況
- Papyrus2Dでも端点一致を交点としてCurveLocationに追加するよう修正済み。
- ただし、辺の重なり（完全一致でない場合）は依然として検出できていない可能性がある。

---

## 2. winding number（winding/windingL/windingR）の伝播
- **Papyrus2D**では、端点overlapな交点（端点一致で追加されたCurveLocation）に対してwinding numberが正しくセットされていなかった。
  - そのため、tracePathsのisValidで「windingが未セット→無効」と判定され、パス構築に利用されなかった。
- **paper.js**では、端点overlapな交点にもwinding numberが必ずセットされ、isValidで有効なセグメントとして扱われる。

### 修正状況
- Papyrus2DでもpropagateWindingを端点overlapな交点に対しても呼ぶよう修正済み。
- curveCollisionsMapが空の場合はpath.getCurves()を使うよう修正し、winding numberが必ずセットされるようにした。

---

## 3. tracePaths/isValidの判定
- **Papyrus2D**のtracePathsのisValid関数は、winding numberが未セットの場合はtrueを返すよう一時的に修正していたが、これは本来の挙動ではない。
- winding numberがセットされている場合でも、operator[winding.winding]がfalseだと無効と判定される。
- 端点overlapな交点のwinding numberは { winding: 1, ... } で、operator[1]がtrueであれば有効と判定されるはずだが、tracePathsのパス構築ロジックがpaper.jsと完全一致していない可能性がある。

---

## 4. パス構築結果の違い
- **Papyrus2D**では、矩形のunite/intersect/subtract/excludeの結果がpaper.jsと異なる。
  - 例：uniteの結果が「M0,0L100,0L100,100L0,100ZM50,50L150,50L150,150L50,150Z」ではなく「M0,0L100,0L100,50L150,50L150,150L50,150L50,100L0,100Z」になるべき。
- これは、交点検出・winding number伝播・tracePathsのいずれかの段階で、端点overlapや辺の重なりが正しく扱われていないことが原因。

---

## 5. preparePathの副作用・空パス化バグ（2025-05-05追記・再現確定）
- Papyrus2DのpreparePath（src/path/PathBooleanPreparation.ts）で、resolveCrossingsやreorientの後にパスが空（セグメントなし）になる現象が発生している。
- これにより、traceBooleanで_path2が空のPathになり、getIntersectionsで交点が全く検出されなくなる。
- DEBUG出力より、preparePathのreorient後に_path2が空のPath（セグメントなし）になっていることが確定。
- 原因は、resolveCrossingsやreorientの内部でパスのセグメントが消える、またはreduce/transformの副作用でパスが壊れること。
- paper.jsではこのような副作用は発生しない。
- さらに、getIntersectionsのデバッグ出力より、path2のセグメント配列が空（[]）であることが明確に確認できた。

---

## まとめ

### 明確な問題点
1. **端点overlapや辺の重なりの交点検出・winding number伝播・tracePathsでの有効判定がpaper.jsと完全一致していない。**
2. **tracePathsのパス構築ロジックが、端点overlapな交点を有効なセグメントとして扱えていない場合がある。**
3. **preparePathの副作用でパスが空になり、以降の交点検出・パス構築が全て失敗する場合がある（再現確定）。**
4. **結果として、矩形のunite/intersect/subtract/excludeのパスデータがpaper.jsと異なる。**

### 追加で調査・修正が必要な点
- 辺の重なり（完全一致でない場合）の交点検出ロジックの強化
- tracePathsのisValid判定・パス構築ロジックのさらなる精査
- preparePath/resolveCrossings/reorient/reduce/transformの副作用バグの修正（特に空パス化の再現と修正）
- paper.jsのPathItem.Boolean.jsのtracePathsアルゴリズムとのdiffを再確認し、細部まで一致させる

---

## デバッグ用console.logの削除について
- 主要なconsole.log/console.errorデバッグ出力は今後削除してください（必要なもの以外）。