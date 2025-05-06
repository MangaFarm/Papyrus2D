# 現在のPathBoolean系の問題点と今後の対応方針

## 現在の問題点

- **PathBoolean系テスト（test/PathBoolean.test.ts）のSVG出力がpaper.jsと一致しない**
  - 例: `M100,300l0,-50l0,-50l100,0l-100,-100l200,0l0,200l-200,0z` のように、`l0,-50l0,-50l100,0` となるべき部分が `l50,-50l-50,0` にならない
  - これは、tracePathsで生成される分割後のセグメント列がpaper.jsと一致していないため

- **Path.reduce()のcollinearな直線マージが不十分**
  - paper.jsのreduce({simplify:true})は、連続する同方向の直線（collinearなlコマンド）を1本にまとめるが、Papyrus2Dのreduce()はこの最適化が不十分
  - そのため、SVG出力で余分なl0,-50等が残る

- **PathSVG.tsのtoPathDataはpaper.jsのtoPathDataロジックにほぼ一致しているが、セグメント列自体が異なるため出力も一致しない**

## 今後すべきこと

1. **Path.reduce()のcollinear判定・マージロジックをpaper.jsのreduce({simplify:true})に完全に合わせる**
   - 3点がcollinearかつ同方向の直線を1本にまとめる
   - 長さ0のセグメントも除去する
   - tolerance付き比較はPoint.equals(point, tolerance)で統一

2. **tracePathsで生成されるパスのセグメント列がpaper.jsと完全一致するかを再度デバッグ出力で確認し、必要ならtracePathsの分割・始点揃えロジックもpaper.jsに合わせて修正する**

3. **PathSVG.tsのtoPathDataは現状のままでよい（collinearマージが正しく動けばSVG出力も一致するはず）**

4. **test/PathBoolean.test.tsなどのテストを再度実行し、SVG出力・テスト期待値が完全一致することを確認する**