# Papyrus2D と paper.js の仕様差分・未実装タスクリスト（2025/05/02時点）

## タスク一覧

- [x] 1. Point.equals- 現状: |x-x'|,|y-y'| ≤ 1e-8 で比較  
  - paper.js: Numerical.EPSILON (≈1e-12) を使用  
  - 差分: 許容値が大きめ。厳密一致を目指すなら Numerical.EPSILON を参照すべき

- [ ] 2. Curve.getTangentAt  
  - 直線時は (p2-p1).normalize()、曲線時は導関数 normalize。paper.js と一致

- [x] 3. Curve.getLength（現状paper.jsと同等の分割数推定式を採用）- 曲線長の数値積分で Curve.getIterations() がダミー（未実装）  
  - paper.js: 誤差に応じた adaptive subdivision  
  - 差分: 長さ精度は未保証

- [x] 4. Path.getBounds- anchor・handleIn・handleOut 全点を走査して AABB 算出  
  - 差分: Bézier 極値を考慮していないため、曲線がハンドル矩形外に張り出す場合は不正確  
  - paper.js: 極値解を求めて厳密外接矩形を返す

- [x] 5. Path.contains- 頂点・辺上は外部扱い、even-odd の直線交差数で判定  
  - 差分: 曲線区間（ハンドル付き）の交差数を求めていないため、曲線パスでは誤判定  
  - paper.js: CurveLocation.expand() でベジェと線分の交差を取得

- [x] 6. Path.getPointAt / getTangentAt（現状paper.jsと同等）- 総長依存の分割は合っているが、Curve.getLength の近似誤差が大きいと位置がずれる

- [x] 7. Path.cubicCurveTo（handleIn/Outの向き・smoothHandles・self-closing補助をpaper.jsに準拠し実装）
  - paper.js: handleOut に差分ベクトル、handleIn は toPoint の相対  
  - 差分: self-closing 補助や smoothHandles なし

- [ ] 8. Path.lineTo  
  - last 変数未使用。handle が保持されず常に 0

- [ ] 9. Curve.divide / split 関連  
  - divide() は実装されているが split(pathTime)/getPart() など paper.js API の大半が未実装

- [ ] 10. Numerical.integrate / Curve.getIterations  
  - integrate() はあるが精度パラメータ固定  
  - paper.js: アダプティブで MachineEpsilon 依存

- [ ] 11. CollisionDetection・Winding/Boolean 演算  
  - 未実装（todo_list フェーズ4 全体）

---

**要点まとめ**
- 基本 API 呼び出しシグネチャと直線関連挙動は paper.js と整合
- 曲線に対する厳密外接矩形、contains の曲線交差、Curve 長さ精度、Path/Curb 補助 API、boolean 系は未実装または簡略で仕様不一致
- 完全互換には Bézier 極値を用いた bounds、曲線-水平線交差計算を含む winding 算出、adaptive length 近似、Path/Curve 補助 API の追加が必須