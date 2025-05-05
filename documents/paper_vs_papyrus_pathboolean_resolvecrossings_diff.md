# PathBooleanResolveCrossings: Papyrus2Dとpaper.jsのアルゴリズム差分（挙動に影響するもののみ）

## 1. 交差点・重なり点の検出・分割処理

### 【差異1】CurveLocation.expandの扱い
- **paper.js**: intersections = CurveLocation.expand(intersections) で必ずexpandを通す。
- **Papyrus2D**: intersections = intersections.slice ? intersections.slice() : intersections; でsliceのみ。expand相当の処理が明示的にない。
- **影響**: CurveLocation.expandが交差点リストの正規化や重複排除を行っている場合、Papyrus2Dでは交差点リストの内容が異なり、分割点の数や位置に差が出る可能性がある。

### 【差異2】divideLocationsの分割時のセグメント選択
- **paper.js**: divideAtTime(time, true) で常にハンドルをセットし、返り値は新しいCurve。分割後はnewCurve._segment1を新しいセグメントとする。
- **Papyrus2D**: divideAtTime(time) の返り値がnumber型（インデックス）またはCurve型の両対応。numberの場合はsegments[newCurve]でセグメントを取得、Curveの場合はnewCurve._segment2を使う。
- **影響**: Papyrus2DのdivideAtTimeの返り値仕様が異なるため、分割後のセグメントの選択ロジックが異なり、分割点のセグメント割り当てに差が出る可能性がある。

### 【差異3】ハンドルクリアのタイミングと対象
- **paper.js**: divideLocations内でclearHandles=trueならclearCurves.push(curve, newCurve)し、最後にclearCurveHandles(clearCurves)で両方クリア。clearHandlesはdivideAtTimeの第2引数trueで常にハンドルをセットする前提。
- **Papyrus2D**: clearHandles時はclearCurves.push(curve)し、newCurveがnumberならcurves[newCurve]、CurveならnewCurve自体もpush。clearCurveHandlesでcurve._segment1, curve._segment2の両方をクリア。
- **影響**: Papyrus2Dは分割後のカーブの扱いが異なり、ハンドルクリアの対象が微妙に異なる場合がある。特にdivideAtTimeの返り値がnumber型の場合、paper.jsでは常にCurve型で処理しているため、分割後のハンドル状態に差が出る可能性がある。

## 2. 交差点リンク処理

### 【差異4】交差点情報のリンク構造
- **paper.js**: segment._intersection, loc._intersectionを直接操作し、linkIntersectionsで_next/_previousを使う。
- **Papyrus2D**: getMeta(segment).intersection, loc._intersectionを使い、linkIntersectionsでnext/_previousを使う。
- **影響**: Papyrus2DはgetMeta経由でintersection情報を管理しているため、セグメントのメタ情報の管理方法が異なる。これにより、交差点リンクの構造や参照の持ち方に差が出る場合がある。

## 3. 結果のパス構成

### 【差異5】CompoundPath生成・属性コピー
- **paper.js**: paths.length > 1 && childrenならsetChildren(paths)、1本ならsetSegments、どちらでもなければ新規CompoundPath生成＋reduce＋copyAttributes＋replaceWith。
- **Papyrus2D**: childrenありでpaths !== childrenならsetChildren、1本ならsetSegments、どちらでもなければ新規CompoundPath生成＋addChildren＋copyAttributes（reduceやreplaceWithはなし）。
- **影響**: Papyrus2DはCompoundPath生成時にreduceやreplaceWithを行わないため、不要なパスが残る・属性の伝播が異なる場合がある。

---

## まとめ

- **CurveLocation.expandの有無**、**divideAtTimeの返り値仕様**、**ハンドルクリアのタイミング・対象**、**交差点リンクの管理方法**、**CompoundPath生成時のreduce/replaceWith有無**が主な挙動差分。
- これらは交差点分割後のパス構造や、重なり・交差の除去、最終的なパスの属性・構造に差が出る可能性がある。
- 型強化やTypeScript由来の制約、単なるAPIラップの違いは挙動に影響しないため除外した。