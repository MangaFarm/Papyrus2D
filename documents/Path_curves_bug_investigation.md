# Path.getCurves() バグ調査ログ・引き継ぎ

## 現象
- Path#removeSegments() で全セグメントを取得し、setSegments() で再セットすると
  - getSegments().length は正しいが
  - getCurves().length が常に0になる
- 例:  
  ```
  const path = new Path();
  path.add(new Segment(new Point(0, 0)));
  path.add(new Segment(new Point(100, 0)));
  path.add(new Segment(new Point(100, 100)));
  const segs = path.removeSegments();
  path.setSegments(segs);
  // path.getSegments().length === 3
  // path.getCurves().length === 0 ←バグ
  ```

## 証拠
- setSegments→_addで_segment._path, _indexは正しくセットされている
- _segments.length, _closed, _countCurves() も正しい値
- だがgetCurves()の返り値が0

## 推定原因
- Path._countCurves() の返り値が0になっている可能性が高い
- ただし、_segments.length=3, _closed=false なら _countCurves()は2を返すはず
- getCurves()の初期化ロジック、またはsetSegments/removeSegmentsの副作用で_curvesが不正になる可能性

## 調査ログ
- Path._addで_segment._path, _indexは正しくセットされていることを確認
- setSegments直後のthisPath._segments.length, thisPath._closed, thisPath._countCurves()も正しい
- だがgetCurves()の返り値が0
- Path._curvesの初期化やクリアタイミング、removeSegments/setSegmentsの副作用に要注意

## 再現テスト
- test/Path_curves.debug.test.ts にバグ再現・正常系テストを追加済み

## 次の調査ポイント
- getCurves()のforループが回らない理由（length=0になる理由）をさらに深掘り
- setSegments/removeSegmentsで_curvesや_segmentsの参照切れ・配列破壊が起きていないか
- paper.js本家の挙動・実装とdiffをとる