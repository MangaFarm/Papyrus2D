# PathBooleanResolveCrossings/Papyrus2Dとpaper.jsのアルゴリズム差分（挙動に影響しうるもののみ）

## 1. 交差点・重なり点の分割処理（divideLocations）

- **Papyrus2DではTypeScriptの型制約により、CurveLocationの_timeや_segmentなど内部プロパティの扱いが異なる。**
  - 例: time再スケール時に`loc._time = time / prevTime`のような直接代入を行っている。
  - paper.jsでは`time /= prevTime`のような書き方や、`segment._intersection`への直接代入が多い。
  - これにより、複数回分割時や交差点の再正規化で微妙な挙動差が出る可能性がある。

- **clearHandles/clearCurvesの扱いが異なる。**
  - Papyrus2Dでは`clearHandles`の判定や`clearCurves`へのpushがTypeScriptの型安全性を意識した実装になっている。
  - paper.jsでは`clearHandles`がtrueのとき`clearCurves.push(curve, newCurve)`のように2つpushするが、Papyrus2Dでは新カーブの取得方法が異なる場合がある。
  - これにより、ハンドルクリアのタイミングや対象カーブに差が出る場合がある。

- **linkIntersectionsの呼び出しとリンクリスト構築の副作用**
  - Papyrus2DではIntersectionInfoの型やプロパティ名の違い、`next!`や`_previous`の扱いが異なる。
  - paper.jsは`_next`/`_previous`で双方向リンクを構築するが、Papyrus2DはTypeScriptのnull安全性のため`!`を多用している。
  - これにより、交差点のリンクリストが複雑な場合に副作用の順序やリンク切れが発生する可能性がある。

## 2. 交差点・重なり点の除去ロジック

- **交差点・重なり点の除去条件の微妙な違い**
  - Papyrus2Dでは`hasOverlap(prev, path) && hasOverlap(next, path)`の判定や、`prev !== seg && !prev.getCurve().hasLength()`の条件分岐がTypeScriptの型安全性を意識したものになっている。
  - paper.jsでは`prev._handleOut._set(0, 0)`のような内部プロパティ呼び出しが多いが、Papyrus2Dでは`set`メソッドを使う。
  - これにより、セグメント削除やハンドルクリアの副作用が異なる場合がある。

## 3. パス返却・CompoundPath生成

- **結果のパス返却方法の違い**
  - Papyrus2DではCompoundPath生成時に`copyAttributes(path)`のみだが、paper.jsでは`reduce()`や`replaceWith()`を呼ぶ場合がある。
  - これにより、返却されるパスの型や属性、親子関係に差が出る場合がある。

## 4. その他

- **内部プロパティ名・null安全性の違い**
  - Papyrus2DはTypeScriptのため、`!`や型アサーションを多用し、paper.jsのようなnull許容のまま進める実装とは異なる。
  - これにより、nullチェック漏れや型エラー回避のための分岐が追加されている。

---

※上記以外の部分（型強化、ts制約、型アサーション、モジュール構造、ネイティブキャンバス実装）は挙動に影響しないため省略。