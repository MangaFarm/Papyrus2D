# PathBooleanIntersections アルゴリズム差異

Paper.jsとPapyrus2DのPathBooleanIntersectionsモジュールを比較した結果、以下の重要な差異が見つかりました：

## divideAtTimeメソッドの戻り値の違い

Paper.jsとPapyrus2DのdivideAtTimeメソッドには、戻り値の型に重要な違いがありました：

- **Paper.js**: 新しい曲線オブジェクト（Curve）を返します
- **Papyrus2D（修正前）**: 分割点のインデックス（数値）を返していました

この違いは、PathBooleanIntersections.tsのdivideLocations関数内での曲線分割処理に影響していました。Paper.jsでは、divideAtTimeの戻り値を直接Curveオブジェクトとして扱いますが、Papyrus2Dでは、戻り値のインデックスを使って新しいカーブを取得する必要がありました。

```javascript
// Paper.js
var newCurve = curve.divideAtTime(time, true);
if (clearHandles) {
  clearCurves.push(curve, newCurve);
}
segment = newCurve._segment1;
```

```typescript
// Papyrus2D（修正前）
const newSegmentIndex = curve.divideAtTime(time, clearHandles);
if (clearHandles && newSegmentIndex !== -1) {
  clearCurves.push(curve);
  const newCurve = curve._path._curves[newSegmentIndex];
  if (newCurve) {
    clearCurves.push(newCurve);
  }
}
if (newSegmentIndex !== -1) {
  segment = curve._path._segments[newSegmentIndex];
  // ...
}
```

この違いにより、エッジケースでの挙動が異なる可能性がありました。特に、曲線分割が失敗した場合や、複雑な形状を処理する場合に問題が発生する可能性がありました。

## 修正内容

以下のファイルを修正して、Paper.jsの実装と完全に一致させました：

1. **Curve.ts**: divideAtTimeメソッドを修正して、新しい曲線オブジェクト（Curve）を返すようにしました
2. **PathBooleanIntersections.ts**: divideAtTimeメソッドの戻り値を正しく処理するように修正しました
3. **CurveLocation.ts**: divideメソッドを修正して、Paper.jsの実装と完全に一致させました

これらの修正により、Papyrus2DのPathBooleanIntersectionsモジュールがPaper.jsと同じ挙動をするようになりました。