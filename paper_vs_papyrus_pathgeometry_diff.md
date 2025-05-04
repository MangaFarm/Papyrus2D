# Paper.js と Papyrus2D の PathGeometry 実装の違いと修正方針

このドキュメントでは、Paper.js と Papyrus2D の PathGeometry 関連の実装の違いを分析し、Paper.js の挙動に完全に一致させるための修正方針を示します。

## 1. computeBounds 関数

### 現在の実装の違い

Papyrus2D の `computeBounds` 関数は、各曲線区間ごとに三次ベジェの極値を明示的に計算し、それらをAABBに含めています。一方、Paper.js は `Curve._addBounds` 関数を使用して境界を計算しています。

### 修正方針

Paper.js の実装に合わせるために、以下の修正が必要です：

1. 現在の極値計算ロジックを Paper.js の `Curve._addBounds` 関数に基づく実装に置き換える
2. 再帰的な分割アプローチを採用する
3. 境界計算の順序を Paper.js と同じにする

## 2. isOnPath 関数

### 現在の実装の違い

Papyrus2D の `isOnPath` 関数は、曲線上の点と与えられた点の距離が最小になる時間パラメータを求めるために、x座標とy座標それぞれについて三次方程式を解いています。Paper.js は同様のアプローチですが、実装の詳細が異なります。

### 修正方針

Paper.js の実装に合わせるために、以下の修正が必要です：

1. 曲線の分割方法と距離計算の方法を Paper.js と同じにする
2. エッジケースの処理を Paper.js と同じにする
3. TypeScript の nullable エラーが出る場合は、Paper.js で判定していないなら `!` を使用する

## 3. getIntersections 関数

### 現在の実装の違い

Papyrus2D の `getIntersections` 関数は、`getBoundsFromCurves` 関数を使用して境界ボックスを計算し、それらの交差をチェックしています。Paper.js は同様のアプローチですが、境界ボックスの計算方法が異なります。

### 修正方針

Paper.js の実装に合わせるために、以下の修正が必要です：

1. 境界ボックスの計算方法を Paper.js と同じにする
2. 行列変換の処理を Paper.js と同じにする
3. 自己交差の場合の処理を Paper.js と同じにする

## 4. contains 関数

### 現在の実装の違い

Papyrus2D の `contains` 関数は、`getWinding` 関数を使用して winding number を計算し、その結果に基づいて判定しています。Paper.js は同様のアプローチですが、winding number の計算方法に微妙な違いがあります。

### 修正方針

Paper.js の実装に合わせるために、以下の修正が必要です：

1. winding number の計算方法を Paper.js と同じにする
2. 判定ロジックを Paper.js と同じにする
3. 境界チェックの方法を Paper.js と同じにする

## 5. getBoundsFromCurves 関数 (内部関数)

### 現在の実装の違い

Papyrus2D の `getBoundsFromCurves` 関数は、各曲線の境界ボックスを計算し、それらを統合しています。Paper.js は同様のアプローチですが、より多くの最適化が実装されています。

### 修正方針

Paper.js の実装に合わせるために、以下の修正が必要です：

1. 境界ボックスの計算と統合の方法を Paper.js と同じにする
2. Paper.js の最適化を取り入れる

## 結論

Papyrus2D の PathGeometry.ts を Paper.js の挙動に完全に一致させるためには、上記の修正が必要です。これらの修正により、アルゴリズムの違いによる挙動の差異を解消することができます。