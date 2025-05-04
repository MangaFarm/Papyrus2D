# paper.js と Papyrus2D の PathBooleanWinding アルゴリズム上の違い

このドキュメントでは、paper.js と Papyrus2D の PathBooleanWinding 実装におけるアルゴリズム上の違いを分析します。モジュール構造や単なる型強化の違いは除外し、挙動に差が出る可能性のある部分のみに焦点を当てています。

## `getWinding` 関数の実装における違い

1. **曲線の単調性分割処理**

   Papyrus2D の `CurveSubdivision.getMonoCurves` は paper.js の `Curve.getMonoCurves` と同様の処理を行いますが、直線判定に `CurveGeometry.isStraight` を使用しています。この判定ロジックの実装の微妙な違いにより、境界ケースで異なる結果が生じる可能性があります。

2. **閉じたパスの処理**

   paper.js:
   ```javascript
   pathWindingL = pathWindingR = path.isClockwise(closed) ^ dir
                        ? 1 : -1;
   ```

   Papyrus2D:
   ```typescript
   pathWindingL = pathWindingR = path.isClockwise(closed) !== dir ? 1 : -1;
   ```

   論理演算子が異なります（`^` vs `!==`）。ブール値に対しては同じ結果になりますが、JavaScript では `^` は数値としてのビット演算も行うため、非ブール値が混入した場合に異なる挙動を示す可能性があります。

## `propagateWinding` 関数の実装における違い

1. **winding 結果の初期化**

   paper.js:
   ```javascript
   var winding = { winding: 0, quality: -1 };
   ```

   Papyrus2D:
   ```typescript
   let windingResult = { winding: 0, quality: -1, windingL: 0, windingR: 0, onPath: false };
   ```

   Papyrus2D では初期値に `windingL`, `windingR`, `onPath` が追加されています。これにより、winding 計算の結果が異なる可能性があります。

2. **タンジェント方向の判定**

   paper.js:
   ```javascript
   const dir = abs(curve.getTangentAtTime(t).y) < Math.SQRT1_2;
   ```

   Papyrus2D:
   ```typescript
   const dir = Math.abs(tangent.y) < Math.SQRT1_2;
   ```

   基本的に同じですが、`tangent` の取得方法が異なる場合、結果に差が生じる可能性があります。

3. **サブトラクション演算時の条件判定**

   paper.js:
   ```javascript
   if (operand === path1 && pathWinding.winding ||
       operand === path2 && !pathWinding.winding) {
       // ...
   }
   ```

   Papyrus2D:
   ```typescript
   if ((operand === path1 && pathWinding.winding) ||
       (operand === path2 && !pathWinding.winding)) {
       // ...
   }
   ```

   JavaScript の演算子優先順位により、括弧の有無が結果に影響する可能性があります。

## 結論

paper.js と Papyrus2D の PathBooleanWinding 実装は、基本的なアルゴリズムは同じですが、いくつかの実装上の違いがあります。これらの違いは、特定の境界ケースや異常な入力に対して異なる挙動を示す可能性がありますが、通常の使用では同じ結果を生成するはずです。