# CurveIntersections.test.ts の問題点分析

## 問題の概要

`CurveIntersections.test.ts` のテストが失敗しています。主なエラーメッセージは以下の通りです：

```
TypeError: curves1[i].getValues is not a function
```

このエラーは、`Curve.getIntersections` メソッドが `Curve` オブジェクトの配列を期待しているのに対し、テストでは数値配列（ベジェ曲線の制御点を表す配列）を直接渡しているために発生しています。

## 詳細な分析

### テストコードの問題箇所

テストでは以下のように `Curve.getIntersections` を呼び出しています：

```typescript
// test/CurveIntersections.test.ts の例
const v1 = [0, 0, 0, 0, 0, 0, 100, 100];
const v2 = [0, 100, 0, 100, 0, 100, 100, 0];
const intersections = Curve.getIntersections(v1, v2);
```

### 実装コードの問題箇所

`Curve.getIntersections` の実装（src/path/Curve.ts の587行目付近）では：

```typescript
static getIntersections(
  curves1: Curve[],
  curves2: Curve[] | null,
  include?: (loc: CurveLocation) => boolean,
  matrix1?: Matrix | null,
  matrix2?: Matrix | null,
  _returnFirst?: boolean
): CurveLocation[] {
  // ...
  for (let i = 0; i < length1; i++) {
    values1[i] = curves1[i].getValues(); // ここでエラー発生
  }
  // ...
}
```

数値配列には `getValues` メソッドがないため、エラーが発生しています。

## Paper.js との違い

Paper.js の実装では、`Curve.getIntersections` は以下の2つの形式で呼び出せるようになっています：

1. `Curve` オブジェクトの配列を渡す方法
2. 数値配列（ベジェ曲線の制御点）を直接渡す方法

しかし、Papyrus2D の実装では、1の方法しかサポートしていないようです。

Paper.js の実装では、引数の型をチェックして、数値配列が渡された場合は適切に処理するようになっていると考えられます。

## 解決の方向性

テストを通すためには、以下のいずれかの対応が必要です：

1. `Curve.getIntersections` メソッドを修正して、Paper.js と同様に数値配列を直接受け取れるようにする
2. テストコードを修正して、数値配列ではなく `Curve` オブジェクトを渡すようにする

ただし、指示によれば「みだりに修正しないよう注意」とのことなので、Paper.js の実装をより詳細に調査し、最小限の修正で対応することが望ましいでしょう。