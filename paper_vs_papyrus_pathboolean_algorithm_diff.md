# Paper.js vs Papyrus2D: PathBooleanTracePaths アルゴリズム差異

## リンクリスト操作の違い

- `PathBooleanTracePaths.ts`の`getCrossingSegments`関数では、Paper.jsでは`_previous`プロパティを使用しているのに対し、Papyrus2Dでは`prev`プロパティを使用している。これによりリンクリストの走査に差異が生じる可能性がある。

- `linkIntersections`関数では、Paper.jsとPapyrus2Dでリンクリストの連結方法に微妙な違いがある。特に、リンクリストの先頭を探す際の処理が異なる。

## 交点処理の違い

- `PathBooleanTracePaths.ts`の`getCrossingSegments`関数内の`collect`関数では、交差するセグメントの判定ロジックに違いがある。Paper.jsでは交差判定の条件式が若干異なり、エッジケースで異なる結果を返す可能性がある。

## パス構築時の処理

- `PathBooleanTracePaths.ts`のメインループ内で、パス構築時のハンドル処理に違いがある。特に、閉じたパスの最初のセグメントのハンドル設定方法が異なり、曲線の形状に影響を与える可能性がある。

## 重なり処理

- `PathBooleanTracePaths.ts`内の重なりパスの処理（`path1._overlapsOnly`の処理）において、Paper.jsとPapyrus2Dで微妙な違いがある。これにより、完全に重なるパスの処理結果が異なる可能性がある。

## バックトラック処理

- `PathBooleanTracePaths.ts`内の無効なセグメントに遭遇した際のバックトラック処理に違いがある。Paper.jsでは分岐点に戻る際の処理が若干異なり、複雑な交差パターンで異なる結果を生成する可能性がある。