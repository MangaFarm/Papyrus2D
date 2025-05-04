# PathBooleanクラスの非交差矩形unite操作の調査結果（更新版）

## 問題の概要

非交差矩形のunite操作において、テストが失敗しています：

```
FAIL: expected 100 to be greater than or equal to 150
```

結果のバウンディングボックスの右端が、両方のパスの右端の最大値以上になっていません。

## デバッグ結果

デバッグログから判明した問題点：

```
DEBUG reorientPaths: Input paths: 2
DEBUG reorientPaths: Path[0] bounds: Rectangle { x: 0, y: 0, width: 100, height: 100 }
DEBUG reorientPaths: Path[1] bounds: Rectangle { x: 50, y: 50, width: 100, height: 100 }
DEBUG reorientPaths: Result paths: 1
DEBUG reorientPaths: Result[0] bounds: Rectangle { x: 0, y: 0, width: 100, height: 100 }
```

交差矩形のunite操作では、2つのパスを入力として受け取りながら、結果として1つのパスしか返していません。

さらに詳細なデバッグ情報：

```
DEBUG: path 0, winding=1, containerWinding=0
DEBUG: isInside(entry1.winding)=true, isInside(containerWinding)=false  // 保持される
DEBUG: path 1, winding=2, containerWinding=1
DEBUG: isInside(entry1.winding)=true, isInside(containerWinding)=true   // 除外される
```

## 原因分析

1. **isClockwise関数の問題**：
   - `isClockwise is not a function`エラーが発生
   - Pathクラスには実装されているが、テスト中に使用されるパスオブジェクトがこのメソッドを持っていない

2. **パスの除外条件の問題**：
   - paper.jsでは、unite操作の場合、windingが1または2のパスを保持
   - Papyrus2Dでは、`isInside(entry1.winding) === isInside(containerWinding)`の場合にパスを除外
   - unite操作では、path1は保持されるが、path2は除外されてしまう

3. **paper.jsとの実装の違い**：
   - paper.jsでは、operatorパラメータをreorientPaths関数に渡している
   - Papyrus2Dでは、operatorパラメータが渡されていない

## 修正内容

1. **isClockwise関数の問題を修正**：
```typescript
// isClockwiseメソッドが存在しない場合はgetAreaを使用
const isClockwise = path.isClockwise ? path.isClockwise() : path.getArea() >= 0;
```

2. **reorientPaths関数にoperatorパラメータを追加**：
```typescript
export function reorientPaths(
  paths: Path[],
  isInside: (winding: number) => boolean,
  clockwise?: boolean,
  operator?: { unite?: boolean; intersect?: boolean; subtract?: boolean; exclude?: boolean }
): Path[] {
```

3. **PathBoolean.tsのtracePaths関数でoperatorを渡す**：
```typescript
const paths = reorientPaths(
  [path1, path2],
  function(winding: number) {
    return !!operator[winding.toString()];
  },
  undefined,
  operator
);
```

これらの修正により、paper.jsと同じ動作になり、非交差矩形のunite操作で両方のパスが保持されるようになります。