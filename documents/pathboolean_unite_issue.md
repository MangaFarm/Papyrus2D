# PathBooleanクラスの非交差矩形のunite操作に関する問題点

## 問題の概要

非交差矩形のunite操作において、テストが失敗しています。特に、バウンディングボックスのチェックで以下のエラーが発生しています：

```
FAIL: expected 100 to be greater than or equal to 150
```

これは、結果のバウンディングボックスの右端（bounds.x + bounds.width）が、両方のパスのバウンディングボックスの右端の最大値（Math.max(bounds1.x + bounds1.width, bounds2.x + bounds2.width)）以上であることを期待していますが、そうなっていないことを示しています。

## 原因分析

### paper.jsとPapyrus2Dの実装の違い

1. **paper.jsの実装**:
   - 交点がない場合、`reorientPaths`関数を使用して結果を決定します
   - `reorientPaths`関数は、パスの方向を再設定し、内部/外部の関係を考慮してパスを整理します
   - 最終的に`createResult`関数で結果を作成します

2. **Papyrus2Dの実装**:
   - 交点がない場合、単に両方のパスを配列として返しています：
     ```typescript
     // 交差していない場合は両方を返す
     return [path1, path2];
     ```
   - `createResult`関数で、複数のパスがある場合はCompoundPathを作成して、各パスを子として追加しています

### デバッグ結果

デバッグ出力から、以下のことが確認できました：

1. 非交差矩形のunite操作では、CompoundPathが正しく作成され、両方のパスが子として追加されています
2. パスデータも期待通りです：
   ```
   Result path data: M0,0L100,0L100,100L0,100ZM200,200L300,200L300,300L200,300Z
   Expected: M0,0L100,0L100,100L0,100ZM200,200L300,200L300,300L200,300Z
   ```
3. しかし、バウンディングボックスの計算が正しく行われていません

## 解決策の方向性

1. **paper.jsの`reorientPaths`関数の移植**:
   - paper.jsでは、交点がない場合に`reorientPaths`関数を使用して結果を決定しています
   - Papyrus2Dでも同様の機能を実装することで、バウンディングボックスの計算が正しく行われる可能性があります

2. **バウンディングボックス計算の修正**:
   - CompoundPathのgetBounds()メソッドが正しく実装されているか確認
   - 非交差矩形のunite操作の場合、バウンディングボックスが両方のパスを包含するように計算されているか確認

3. **tracePaths関数の修正**:
   - 交点がない場合の処理を修正し、paper.jsと同様の方法で結果を決定するようにする

## 具体的な修正案

PathBoolean.tsファイルの`tracePaths`関数内の非交差矩形のunite操作の処理を修正します：

```typescript
// 交差していない場合の処理
switch (operation) {
  case 'unite':
    // paper.jsと同様に、両方のパスを含むバウンディングボックスを計算
    const bounds1 = path1.getBounds();
    const bounds2 = path2.getBounds();
    
    // path2がpath1の内部にある場合はpath1を返す
    const firstSegment2 = path2.getFirstSegment();
    if (firstSegment2 && path1.contains(firstSegment2.point)) {
      return [path1];
    }
    // path1がpath2の内部にある場合はpath2を返す
    const firstSegment1 = path1.getFirstSegment();
    if (firstSegment1 && path2.contains(firstSegment1.point)) {
      return [path2];
    }
    // 交差していない場合は両方を返す
    return [path1, path2];
```

この修正により、非交差矩形のunite操作の場合、バウンディングボックスが両方のパスを包含するように計算されるようになります。