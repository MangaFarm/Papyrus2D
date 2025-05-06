# PathBoolean系下位デバッグ・引継メモ

## ここまでの検証・修正内容

- divideLocations, tracePaths, getIntersections, SegmentMeta などBoolean演算の下位APIを徹底的にデバッグ
- Segmentのmeta.path/windingのセット漏れや、tracePathsのcurrentSeg=null時break等、paper.js設計に忠実に修正
- 下位テスト用にtest/PathBooleanDebug.test.tsを作成し、最小交点ケースやwinding手動セットケースを多数検証

## 下位テストで分かったこと・現状

- divideLocationsで生成されるCurveLocationの_segmentや_pointは正しくセットされている
- ただしwindingはpropagateWinding（またはrunBoolean等の上位API）でセットされる設計
- tracePathsに交点分割セグメント＋元パス全セグメントを渡しても、winding未セットのセグメントが混じるとpaths.length=0になる
- 下位API単体で「パスが生成される」ことを期待するのは設計上困難（paper.jsも同様）

## paper.jsとの設計比較

- paper.jsも「交点分割＋winding伝播＋マーチング」は一連の流れで、下位API単体ではパス生成は保証されない
- 必ずpropagateWinding（またはrunBoolean等の上位API）を経由してwindingをセットする必要がある

## 今後の推奨方針

- 下位API単体テストでpaths.length>0を期待するのは保留
- Boolean演算の正しい検証はrunBooleanやPathBoolean.unite等の上位API経由でpropagateWindingを含めて行う
- 下位テストは「winding未セット時の挙動」や「meta情報の伝播」などの観察・デバッグ用途に限定

## 追加で必要な作業・注意点

- 下位APIの型・プロパティ名（_segment, _intersection, _next, _previous等）はpaper.jsと完全一致させること
- Segment生成時のmeta.pathセット漏れに注意
- windingのセット・伝播は必ずpropagateWinding経由で行うこと
- 下位テストで不自然な挙動が出た場合は、まずwinding/visited/meta情報の伝播を疑う

---

2025/5/6 PathBoolean下位デバッグ担当より