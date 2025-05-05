# PathBooleanResolveCrossings.ts と paper.js PathItem.Boolean.js の resolveCrossings系呼び出しフローにおける挙動差分まとめ

---

## 1. 交差点・重なり点の検出・分割（resolveCrossings, divideLocations）

### 差異1: divideAtTimeの返り値仕様
Papyrus2Dでは `curve.divideAtTime(time)` の返り値が number型（インデックス）またはCurve型の両方を許容している。paper.jsでは常にCurveを返す前提で `newCurve._segment1` を使う。
- Papyrus2Dではnumber型の場合にsegments配列からsegmentを取得しているが、paper.jsでは常にCurveオブジェクトからsegmentを取得している。
- この違いにより、divideAtTimeの返り値仕様が異なる場合、分割後のセグメントの取得方法が異なり、分割点のリンクや後続処理に差が出る可能性がある。

### 差異2: ハンドルクリアのタイミング・対象
Papyrus2Dでは `clearCurveHandles` の対象カーブを `clearCurves.push(curve)` や `clearCurves.push(curves[newCurve])` で管理しているが、paper.jsでは `clearCurves.push(curve, newCurve)` で常に両方をpushしている。
- Papyrus2Dではnumber型返却時のみ新しいカーブをpushしているが、paper.jsは常に両方push。
- このため、分割後のカーブのハンドルクリア対象が異なり、特に分割後のカーブが複数生成される場合に、ハンドルが残る/消える挙動差が出る可能性がある。

### 差異3: 交差点リンクの構築
Papyrus2Dでは `linkIntersections` の呼び出しで、`other = other.next!` のようにTypeScriptのnull許容を `!` で回避しているが、paper.jsは `other = other._next` で素直に進めている。
- これは型安全上の違いだが、実行時にnullチェックが漏れるとリンクリストが途中で切れる可能性がある（ただし通常は同じ挙動になるはず）。

---

## 2. オーバーラップ・交差点の除去・分岐

### 差異4: 分割点の除外・正規化
Papyrus2Dでは、同一カーブ上で複数回分割する場合、`loc._time = time / prevTime` で時間パラメータを正規化している。paper.jsでは `time /= prevTime` で直接再スケール。
- この違いにより、分割点が密集している場合や、分割順序が異なる場合に、分割点の位置が微妙にずれる可能性がある。

---

## 3. 結果パスの構成

### 差異5: CompoundPath/PathItemの再利用・生成
Papyrus2Dでは、childrenの有無やpaths配列の長さによって、元のpath/compoundPathを再利用するか新規CompoundPathを生成するかを分岐している。paper.jsも同様だが、paper.jsは `replaceWith` で元のアイテムを置き換える場合がある。
- Papyrus2DではreplaceWith相当の処理がなければ、元のpathが残る場合がある。これにより、元のオブジェクト参照が残るかどうかに差が出る可能性がある。

---

## 4. その他

### 差異6: 内部API呼び出しの副作用
Papyrus2Dでは内部的に `getMeta` や `IntersectionInfo` などのラッパーを多用しているが、paper.jsは直接プロパティアクセスしている。
- getMeta等のラッパーが副作用を持つ場合、挙動差が出る可能性がある。

---

## まとめ

- divideAtTimeの返り値仕様の違い（Curve or number）による分割後セグメント・カーブの取得方法の差
- ハンドルクリア対象の違い（分割後のカーブ全て or 一部のみ）
- 分割点の正規化方法の違い（_timeの扱い）
- CompoundPath/PathItemの再利用・生成・置換の違い（replaceWith有無）
- getMeta等のラッパー副作用の有無

これらの差異が、パスの分割・交差解決・結果パスの構成・ハンドルクリアの挙動に影響しうる。