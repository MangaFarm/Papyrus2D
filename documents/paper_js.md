# paper.jsについてのメモ

## paper.jsのテストについて

- テストコードは `paper.js/test/tests/` ディレクトリに多数の `.js` ファイルとして格納されている（例: `Curve.js`, `Point.js`, `Path.js` など）。
- テスト用のアセット（SVGファイル等）は `paper.js/test/assets/` に配置されている。
- テストの実行には `paper.js/test/index.html`（ブラウザ用）や、Node.js環境用の仕組み（`gulpfile.js`や`gulp/tasks/test.js`など）が用意されている。
- テストヘルパーやローダーは `paper.js/test/helpers.js` および `paper.js/test/load.js` に実装されている。
- テストの詳細や実行方法は `paper.js/README.md` も参照。
