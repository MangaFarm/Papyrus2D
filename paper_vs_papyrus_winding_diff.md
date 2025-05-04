# paper.js と Papyrus2D の PathBooleanWinding 実装の違い

このドキュメントでは、paper.js と Papyrus2D の PathBooleanWinding 関連の実装で、挙動に差が出うる重要な違いを分析します。

## getWinding 関数の違い

### 1. PathGeometry.ts の getWinding 実装

Papyrus2D では、`PathGeometry.ts` に独自の `getWinding` 実装があります：

```typescript
export function getWinding(
  curves: Curve[],
  point: Point
): { windingL: number; windingR: number } {
  let windingL = 0;
  let windingR = 0;

  for (const curve of curves) {
    // 曲線の値を取得...

    // y成分の範囲外ならスキップ...

    // y成分の三次方程式を解く...

    for (const t of roots) {
      // ...
      // 左右に分けてカウント
      if (x < point.x - Numerical.EPSILON) {
        windingL += dy > 0 ? 1 : -1;
      } else if (x > point.x + Numerical.EPSILON) {
        windingR += dy > 0 ? 1 : -1;
      } else {
        // x座標が一致する場合は両方にカウント
        windingL += dy > 0 ? 0.5 : -0.5;
        windingR += dy > 0 ? 0.5 : -0.5;
      }
    }
  }

  return { windingL, windingR };
}
```

この実装は paper.js の複雑な実装とは異なり、シンプルな方法で winding 値を計算します。特に：

- 曲線と点の y 座標が交差する場所を見つけ、その x 座標に基づいて左右の winding 値を更新
- paper.js のような品質評価のロジックがない
- 水平曲線の特殊処理が異なる

これにより、特に複雑な曲線や点が曲線に非常に近い場合に、異なる結果が生じる可能性があります。

### 2. segment.getNext() の処理の違い

**paper.js**:
```javascript
segment = segment.getNext();
```

**Papyrus2D**:
```typescript
segment = segment.getNext() || segment;
```

Papyrus2D では、`segment.getNext()` が null を返す場合に現在のセグメントを使用します。これにより、特定のケースでセグメントチェーンの構築方法が異なり、winding の伝播に影響を与える可能性があります。

### 3. x座標が一致する場合の処理

**paper.js** では、点が曲線上にある場合の処理が複雑で、様々な特殊ケースを考慮しています。

**Papyrus2D (PathGeometry.ts)** では、x座標が一致する場合に両方の winding 値に半分ずつ寄与させる単純な方法を採用しています：

```typescript
// x座標が一致する場合は両方にカウント
windingL += dy > 0 ? 0.5 : -0.5;
windingR += dy > 0 ? 0.5 : -0.5;
```

この違いにより、点が曲線上またはその非常に近くにある場合に、異なる winding 値が計算される可能性があります。

## 結論

paper.js と Papyrus2D の PathBooleanWinding 実装には、挙動に影響を与える可能性のある以下の主な違いがあります：

1. **PathGeometry.ts の独自実装**:
   - シンプルな winding 計算方法
   - 品質評価のロジックの欠如
   - 水平曲線の処理の違い

2. **セグメントチェーンの構築**:
   - `segment.getNext()` が null を返す場合の処理の違い

3. **境界ケースの処理**:
   - x座標が一致する場合の処理の違い

これらの違いは、特に複雑な形状や境界ケースで異なる結果をもたらす可能性があります。