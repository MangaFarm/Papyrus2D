# PathBoolean交点情報バグ修正・検証手順（実行者向け）

## 概要

この文書は、Papyrus2DのPathBoolean系バグ（交点情報がSegmentに正しくセットされない問題）の修正・検証を安全かつ分かりやすく進めるための手順書です。  
**必ず下記の検証テストを最初に実行し、現象を再現・把握してから修正作業に着手してください。**

---

## 1. 事前検証（バグの再現）

### 1-1. 専用バグ再現テストの実行

まず、修正前の現状で下記コマンドを実行し、バグが再現することを確認してください。

```sh
npm test test/PathBooleanIntersectionBug.test.ts
```

- 期待される出力例:  
  `expected 0 to be greater than 0`  
  もしくは `🔥BUG: intersection segmentに_intersectionがセットされていない` というエラーが出る

### 1-2. 基本ブーリアン演算テストの実行

続いて、通常のPathBooleanテストも失敗することを確認してください。

```sh
npm test test/PathBoolean.test.ts
```

---

## 2. 修正方針の理解

- 詳細な経緯・設計意図・修正手順は `documents/pathboolean_intersection_bug_fix_plan.md` を参照してください。
- 特に「divideLocationsの返り値型・交点情報のリンク構造」をpaper.jsと同等にする必要があることを理解してください。

---

## 3. 修正作業の流れ

1. **divideLocationsの返り値をCurveLocation[]に統一する**
2. **dividePathAtIntersectionsやtracePaths等、呼び出し側もCurveLocation[]を前提に修正する**
3. **交点情報のリンク・セット処理をpaper.jsと同等に見直す**
4. **関連する型・ユーティリティ関数も必要に応じて修正する**

---

## 4. 修正後の検証

### 4-1. バグ再現テストの再実行

```sh
npm test test/PathBooleanIntersectionBug.test.ts
```
- すべての交点Segmentに_intersectionがセットされ、テストがパスすること

### 4-2. 通常のPathBooleanテストの再実行

```sh
npm test test/PathBoolean.test.ts
```
- unite, subtract, intersect, exclude等の基本テストがすべてパスすること

---

## 5. 注意事項

- 修正範囲が広いため、**小さな単位でコミットし、こまめにテストを実行してください。**
- 既存のテストがすべてパスすることを必ず確認してください。
- 設計意図やpaper.jsとの差異が不明な場合は、`documents/pathboolean_intersection_bug_fix_plan.md`を必ず参照してください。

---