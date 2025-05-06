# PathBoolean交点情報バグ修正計画

## 1. 経緯

- PathBooleanの矩形unite等の最も基礎的なテストが失敗し、結果パスが空になる現象が発生。
- デバッグ出力と二分探索により、tracePathsに渡されるsegmentsの多くに交点情報（_intersection）がセットされていないことが判明。
- dividePathAtIntersections/divideLocationsの実装をpaper.jsと比較した結果、返り値型・交点情報のリンク構造に決定的な差異があることを発見。
- 専用のバグ再現テスト（test/PathBooleanIntersectionBug.test.ts）でも、交点に対応するSegmentに_intersectionがセットされていないことが自明に再現された。

## 2. 変更しなければならない理由

- **paper.jsはdivideLocationsの返り値としてCurveLocation[]（交点情報付き）を返し、tracePaths等の後続処理もこれを前提に設計されている。**
- Papyrus2DはSegment[]を返し、交点情報のリンクが一部のSegmentにしかセットされないため、パストレースが進行できず、Boolean演算の根本的な失敗を招いている。
- このままでは、交点を含む全てのパス演算で正しい結果が得られないため、設計レベルでpaper.jsと同等の構造に修正する必要がある。

## 3. 変更手順

1. **divideLocationsの返り値をCurveLocation[]に統一**
   - Segment[]ではなく、交点情報付きCurveLocation[]を返すように修正。
   - results配列の扱い・返し方をpaper.jsに合わせる。

2. **dividePathAtIntersectionsの修正**
   - divideLocationsの返り値型変更に合わせて、呼び出し側もCurveLocation[]を前提に修正。
   - 必要に応じて、分割後のSegment取得はlocation._segmentから取得する。

3. **tracePaths等の呼び出し側・フローの修正**
   - tracePathsに渡すsegmentsの生成方法を、CurveLocation[]から必要なSegment[]を抽出する形に修正。
   - 交点情報のリンク・セット処理もpaper.jsのロジックに合わせて見直す。

4. **交点情報のリンク構造の見直し**
   - segment._intersection, loc._intersectionの相互リンク・リスト化をpaper.jsと同等に行う。

5. **関連する型・ユーティリティ関数の修正**
   - SegmentMeta等、交点情報の取得・セットに関わる部分も必要に応じて修正。

