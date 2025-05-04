# paper.js と Papyrus2D の PathGeometry アルゴリズム上の違い

## getIntersections 関数

- Papyrus2D では境界ボックスチェックが常に行われるが、paper.js では条件付き（self || this.getBounds(matrix1).intersects(path.getBounds(matrix2), Numerical.EPSILON)）で行われる
- この違いにより、境界ボックスが交差していない特定のケースで、交点検出の挙動が異なる可能性がある

## winding number 計算

- paper.js では getWinding 関数内の数値計算で、一部の条件分岐で異なる処理が行われる
- Papyrus2D では paper.js の実装を忠実に再現しているが、数値計算の微妙な違いにより、エッジケース（特に数値の精度が問題になるケース）で挙動が異なる可能性がある

## 境界ボックス計算

- computeBounds 関数と paper.js の Path.getBounds メソッドは基本的に同じアルゴリズムを使用しているが、Papyrus2D では padding パラメータの扱いが明示的になっている
- この違いにより、padding を使用する場合に境界ボックスの計算結果が微妙に異なる可能性がある