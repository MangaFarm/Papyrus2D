# paper.js と Papyrus2D の PathBooleanTracePaths アルゴリズム比較

PathBooleanTracePaths.ts と paper.js の tracePaths 関数を比較した結果、アルゴリズム上の本質的な違いは見つかりませんでした。

両実装は以下の点で完全に一致しています：

1. セグメントの有効性判定ロジック (isValid 関数)
2. 開始点判定ロジック (isStart 関数)
3. パス訪問処理 (visitPath 関数)
4. 交差セグメント取得ロジック (getCrossingSegments 関数)
5. セグメントのソートロジック
6. パストレースのメインループ処理
7. 重なり (オーバーラップ) の特別処理
8. 分岐処理とバックトラック処理
9. パスの閉じ方と面積チェック

TypeScript の型システム対応のための違いや、getMeta を使用したメタデータ管理方法の違いはありますが、これらは実行時の挙動には影響しません。

結論として、paper.js の tracePaths アルゴリズムは Papyrus2D に忠実に移植されており、アルゴリズム上の本質的な違いはありません。