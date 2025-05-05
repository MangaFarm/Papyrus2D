# PathBooleanTracePaths.ts と paper.js tracePaths アルゴリズムの挙動差分まとめ

本ドキュメントは、Papyrus2Dの `PathBooleanTracePaths.ts` と paper.js の `PathItem.Boolean.js` 内 `tracePaths` アルゴリズムの呼び出しフローを下位レイヤーまで追跡し、挙動に差が出る部分のみ簡潔にまとめたものです。  
（型強化・ts制約・モジュール構造・型アサーション等、動作に影響しない差異は除外）

---

## 1. winding number / operator 判定の差異

- **operator[winding.winding] の扱い**
  - Papyrus2D・paper.jsともに winding number がセットされていても、operator[winding.winding] が false ならそのセグメントは無効と判定される。
  - ただし Papyrus2D では `winding` オブジェクトが null/undefined の場合の分岐がやや異なり、winding情報が無い場合は true 扱いとなる（paper.jsも実質同様だが、分岐の順序が異なる）。
- **unite時の2重領域除外**
  - winding.winding === 2 かつ winding.windingL, winding.windingR が両方非ゼロの場合、operator.unite時は無効扱いとするロジックは両実装で一致。
  - ただし Papyrus2D 側はこの条件分岐の位置が異なるため、winding情報の伝播やnull時の挙動でごく稀に差が出る可能性がある。

---

## 2. overlap交点・端点overlapの扱い

- **端点overlapな交点のwinding number**
  - 両実装とも、overlap交点の winding number は `{ winding: 1, ... }` となり、operator[1] が true であれば有効と判定される。
  - ただし、Papyrus2DのtracePathsでは、overlap交点を含むパス構築時の分岐（特にgetCrossingSegments, isValid, isStartの連携）で、paper.jsと完全一致しないケースがある。
  - そのため、端点overlapを含む複雑な交点列で、パスの分割・構築順序やvisited管理に差が出る場合がある。

---

## 3. crossing探索・backtrackの分岐

- **crossing探索時の分岐**
  - getCrossingSegments, isValid, isStart の呼び出し順序・分岐条件はほぼ一致しているが、Papyrus2DではTypeScriptの型制約やnullチェックの位置が異なるため、交点リストの構築順序やbacktrack時の挙動にごく稀な差が生じる可能性がある。
- **backtrack時のvisited管理**
  - Papyrus2Dではvisited解除やpath.removeSegmentsの呼び出しタイミングがpaper.jsと微妙に異なる場合があり、複雑な交点列でパスの分岐・合流時に一時的なvisited状態の差が出ることがある。

---

## 4. パス構築時のopen/closed判定・handle処理

- **open/closed判定**
  - パスの端点（isFirst, isLast）でclosed状態を引き継ぐ処理は両実装で一致しているが、Papyrus2DではgetMeta経由でpath._closedを参照するため、pathオブジェクトの状態が一時的にズレている場合に挙動差が出る可能性がある。
- **handleIn/handleOutの処理**
  - パス構築時のhandleIn/handleOutの付与・引き継ぎはpaper.jsのロジックを忠実に再現しているが、Papyrus2DではPoint型の変換やnull許容のための分岐が追加されており、極端なケースでhandleが欠落する場合がある。

---

## 5. その他、挙動に影響する差異

- **完全重なりパスの処理**
  - 両実装とも、完全重なりパス（_overlapsOnly=true）はcompareで同一判定し、getArea()が非ゼロならcloneして結果に追加する。ただしPapyrus2Dではintersection.segmentのgetMeta経由でpathを取得するため、交点情報が不完全な場合に漏れが生じる可能性がある。
- **分岐・合流の枝管理**
  - Papyrus2Dではbranch/crossings/visitedの管理がpaper.jsより厳密でない場合があり、複雑な交点列で枝の探索順序やbacktrackの深さに差が出ることがある。

---

## 備考

- Numeric, getMeta等の数値計算・メタ情報取得は両実装で信頼できるものとみなしてよい。
- 型強化・TypeScript由来の分岐・型アサーションは挙動差に含めていない。
- 上記以外の部分でpaper.jsと完全一致している箇所は本ドキュメントでは省略。