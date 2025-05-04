# paper.js と Papyrus2D の PathGeometry アルゴリズム上の違い

## contains メソッドの実装

### 主な違い

1. **パス上の点の扱い**：
   - paper.js: パス上の点は `winding.onPath` フラグで判定され、内部判定に影響する
   - Papyrus2D: パス上の点は常に `true` を返す（内部と見なす）

2. **nonzero ルールの実装**：
   - paper.js: 単一の `winding.winding` 値を使用
   - Papyrus2D: 左右の winding 値 (`windingL` と `windingR`) のどちらかが 0 でなければ内部と判定

## getIntersections メソッドの実装

### 主な違い

1. **境界ボックスチェックの実装**：
   - paper.js: 単純な境界ボックスの交差チェックのみ
   - Papyrus2D: 境界ボックスが交差していない場合でも、制御点のハンドルが長い場合（20以上）は追加チェックを行う

2. **境界ボックス計算の精度**：
   - paper.js: 単純に端点のみで境界ボックスを計算
   - Papyrus2D: 制御点も考慮した詳細な境界ボックス計算

## isOnPath メソッドの実装

### 主な違い

1. **実装の分離**：
   - paper.js: パス上の判定は `getWinding` 関数内に組み込まれている
   - Papyrus2D: 明示的な `isOnPath` 関数として分離されている

2. **直線と曲線の処理**：
   - Papyrus2D: 直線と曲線で異なる処理を行い、直線の場合は最適化された計算を使用
   - paper.js: 曲線の処理に統一されている

3. **端点の判定**：
   - Papyrus2D: 最初に端点との距離をチェックし、十分近い場合は早期リターン
   - paper.js: このような最適化は行われていない