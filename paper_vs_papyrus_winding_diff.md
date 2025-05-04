# paper.js と Papyrus2D の PathBooleanWinding 実装の違い

このドキュメントでは、paper.js と Papyrus2D の PathBooleanWinding 実装における挙動に差が出る可能性のあるアルゴリズム上の違いを分析します。

## getMonoCurves 実装の違い

曲線を単調な部分に分割する処理において、インデックスの初期値に違いがあります：

- paper.js では `io` の初期値が `dir ? 0 : 1` となっています
- Papyrus2D では `io` の初期値が `dir ? 1 : 0` となっています

この違いにより、曲線の分割方法が異なる可能性があり、結果として winding number の計算に影響を与える可能性があります。

## winding 寄与の計算における null/undefined 処理

winding 寄与の計算において、Papyrus2D では windingL と windingR が undefined の場合のデフォルト値処理が追加されています：

- paper.js では `winding.windingL - winding.windingR` と直接計算しています
- Papyrus2D では `(winding.windingL || 0) - (winding.windingR || 0)` と undefined の場合に 0 をデフォルト値として使用しています

この違いにより、windingL または windingR が undefined の場合に異なる結果が生じる可能性があります。