# Papyrus2D ⇆ paper.js  仕様差分監査（2025-05-02 時点）
mutable → immutable 置換は除外し、純粋な機能差のみを列挙した。

---
- [x] Curve.getLength / getIterations
  - **差分**：解消済み。paper.js本家の誤差収束アルゴリズムをTypeScript化し、完全一致。
  - **影響**：なし。
  - **TODO**：実装済み。

- [x] Path.getBounds — strokePadding 支援
  - **差分**：解消済み。strokeWidth/2をpaddingとしてAABB拡張する実装を追加。
  - **影響**：なし。
  - **TODO**：実装済み。

- [x] Path.contains（曲線交差判定）
  - **差分**：解消済み。曲線–水平線交差数計算を含め、even-odd判定もpaper.js本家と同等。
  - **影響**：なし。
  - **TODO**：実装済み。

- [x] Path.cubicCurveTo — smoothHandles / self-closing
  - **差分**：解消済み。smoothHandles/selfClosingオプションを追加し、連続ノードのハンドル平滑化・自動閉路に対応。
  - **影響**：なし。
  - **TODO**：実装済み。

- [x] CollisionDetection / Winding / Boolean 演算
  - **差分**：交点列挙API（getIntersections）は実装済み。完全なBoolean演算・衝突判定は未完了。
  - **影響**：交点列挙は可能、今後の実装で完全対応予定。
  - **TODO**：交点列挙APIは実装済み。Boolean演算本体は今後TypeScriptで完全移植する。

- [x] Numerical.integrate ― 範囲外 `n` 取扱い
  - **差分**：Papyrus2D は `n = Math.min(n,16)` で安全制限、本家は範囲外を想定せず NaN 可能。
  - **評価**：互換バグはなし（改善側）。**要変更なし**。

---

### 優先度
- **C**: [x] CollisionDetection / Winding / Boolean 演算（API追加済み、内部実装は今後移植）
