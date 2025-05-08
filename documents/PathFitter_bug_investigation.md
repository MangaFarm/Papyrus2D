# PathFitter.test.ts バグ調査 引き継ぎ

## 問題のテスト
- test/PathFitter.test.ts > PathFitter > Path.simplify > should preserve the shape while reducing segments
- 四角形パスの単純化で、面積が大きく壊れ、isClosed()がfalseになる

## 二分探索・デバッグ出力で判明したこと

- path.setClosed(true)直後: isClosed()=true, _closed=true
- path.getArea()直後: isClosed()=true, _closed=true
- path.simplify直前: isClosed()=true, _closed=true
- Path.simplify内: isClosed()=false, _closed=false
- PathFitter.constructor: path.isClosed()=false
- setSegments呼び出し前: this._closed=false
- setSegments呼び出し前後: this._closed=false

## PathFitter.fit出口の証拠

- PathFitter.fit: closed判定 first= { x: 0, y: 52 } last= { x: 90, y: 48 } closed= false

## 根本原因

- PathFitter.fitの戻り値segmentsが「開いたパス」になっている（最初と最後の点が一致しない）
- そのため、setSegments(segments)でPath._closedがfalseのままになり、以降のisClosed()もfalseになる
- PathFitter.fitは閉じたパスのとき、segmentsの最初と最後の点が一致するように生成すべき

## 修正指針（まだ修正は行わない）

- PathFitter.fit出口で、this.closedがtrueのときはsegmentsの最初と最後の点が一致するようにする必要あり
- もしくはsetSegmentsでsegmentsが閉じているか判定し、_closedを正しく設定する必要あり

## 参考デバッグ出力

- 🔥 PathFitter.fit: closed判定 first= { x: 0, y: 52 } last= { x: 90, y: 48 } closed= false
- 🔥 Path.simplify: this.isClosed()(start)= true this._closed= true
- 🔥 Path.simplify: this._closed(before setSegments)= false
- 🔥 setSegments: this._closed(before)= false
- 🔥 setSegments: this._closed(after length=0)= false
- 🔥 setSegments: this._closed(after)= false
- 🔥 Path.simplify: this.isClosed()(end)= false this._closed= false