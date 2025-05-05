# Paper.js vs Papyrus2D: PathBoolean アルゴリズムの差異と修正方法

## 1. resolveCrossings関数 (PathBooleanPreparation.ts)

**問題**: PathBooleanPreparation.tsのresolveCrossings関数では、自己交差の解決処理が不完全です。tracePaths関数が呼び出されていません。

**修正方法**: 
- src/path/PathBooleanTracePaths.tsからtracePaths関数をインポートする
- paper.jsと同様に、すべてのセグメントを収集した後、tracePaths関数を呼び出す
- 結果のパスを返す前に、tracePaths関数の結果を使用する

## 2. 時間パラメータの再スケーリング (PathBooleanPreparation.ts)

**問題**: divideLocations関数内での時間パラメータの再スケーリング処理に問題があります。新しい変数（newTime）が定義されていますが、後続の処理で使用されていません。

**修正方法**:
- TypeScriptの制約上、constで宣言された変数は再代入できないため、以下のように修正する:
```
// 現在のコード
const newTime = time / prevTime;
// 修正後 (TypeScriptの制約上、直接再代入はできないため)
loc._time = time / prevTime;
```
- コメントを追加: `// TypeScript制約: constの再代入ができないため、直接_timeプロパティを設定`

## 3. CollisionDetection関数の呼び出し (PathBoolean.ts)

**問題**: traceBoolean関数内で、paper.jsのfindCurveBoundsCollisionsの代わりにfindCurveBoundsCollisionsWithBothAxisを使用しています。

**修正方法**:
- CollisionDetection.findCurveBoundsCollisionsWithBothAxisの代わりに、paper.jsと同じfindCurveBoundsCollisionsを使用する
- 引数も完全に一致させる: `CollisionDetection.findCurveBoundsCollisions(curvesValues, curvesValues, 0, true)`

## 4. null/undefined処理の修正

**全般的な修正方針**:
- paper.jsでnull/undefined判定をしていない箇所では、TypeScriptのエラーを回避するために非nullアサーション演算子(!)を使用する
- 例: `segment.next!` のように、paper.jsで明示的なnullチェックがない場合は!を使用する
- コメントを追加: `// paper.jsではnullチェックなし、TypeScript制約のため!を使用`

## 5. 順序の一致

**全般的な修正方針**:
- 関数の呼び出し順序、パラメータの順序などをpaper.jsと完全に一致させる
- 特にループ処理やイテレーションの順序が重要な箇所では、paper.jsのコードを参照して順序を合わせる

## 6. 型キャストの適切な使用

**全般的な修正方針**:
- TypeScriptの型システムの制約上必要な場合のみ型キャストを使用する
- 型キャストを使用する場合は、paper.jsの実装に忠実であることを示すコメントを追加する
- 例: `(segment as any)._intersection = dest; // paper.jsでは直接プロパティ設定`

## 7. 実装済み関数の活用

**全般的な修正方針**:
- src/archive.mdを参照して、既に実装済みの関数を確認する
- paper.jsで使用されている関数が既に実装されている場合は、それを活用する
- 未実装の関数がある場合は、paper.jsのコードを参照して忠実に実装する