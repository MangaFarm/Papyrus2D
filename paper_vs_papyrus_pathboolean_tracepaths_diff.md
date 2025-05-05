# PathBooleanTracePaths アルゴリズム比較

PathBooleanTracePaths.tsとpaper.jsのPathItem.Boolean.jsのtracePathsアルゴリズムを比較した結果、以下の違いが見つかりました：

## 重要な違い

**重なりパスの処理（overlapsOnly）**
- paper.js: 重なりパスの処理で、`path1.compare(path2)`を直接呼び出し、パスの比較を行う
- Papyrus2D: `path1.compare && path2 && path1.compare(path2)`と、メソッドの存在確認を追加

この違いにより、paper.jsでは`compare`メソッドが存在しない場合に実行時エラーが発生する可能性がありますが、Papyrus2Dではメソッドの存在を確認してから呼び出すため、エラーを回避できます。これは実行時の挙動に影響を与える可能性があります。

その他の違いはTypeScriptの型制約に関連するもので、実行時の挙動には影響しません。