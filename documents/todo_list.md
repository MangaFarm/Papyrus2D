# Papyrus2D プロジェクト実装TODOリスト

## フェーズ1: 基本計画と環境構築
- [ ] 1.1 プロジェクトのディレクトリ構造を作成する
  - [ ] 1.1.1 src/ ディレクトリと基本モジュールディレクトリ（basic, path, boolean, util）を作成
  - [ ] 1.1.2 test/ ディレクトリを作成
  - [ ] 1.1.3 examples/ ディレクトリを作成
- [x] 1.2 開発環境のセットアップ
  - [x] 1.2.1 package.jsonの作成（ESモジュールサポート設定）
  - [x] 1.2.2 ビルドツールの設定（Viteを使用、ES/UMDフォーマットのビルド設定済み）
  - [x] 1.2.3 ESLintとPrettierの設定（コード品質とフォーマット設定済み）
  - [x] 1.2.4 テスト環境のセットアップ（Vitestで実装、JSDOM環境設定済み）
- [ ] 1.3 CI/CDパイプラインのセットアップ
  - [ ] 1.3.1 GitHub Actionsの設定
  - [ ] 1.3.2 テスト自動化の設定

## フェーズ2: 基本クラスの実装
- [ ] 2.1 基本的な幾何学クラスの実装
  - [x] 2.1.1 Point クラス（イミュータブル設計）
    - [x] コンストラクタと基本プロパティ
    - [x] ベクトル操作メソッド（add, subtract, multiply, divide）
    - [x] ベクトル情報メソッド（getLength, getAngle）
    - [x] 変換メソッド（rotate, normalize）
  - [x] 2.1.2 Size クラス（イミュータブル設計）
  - [x] 2.1.3 Rectangle クラス（イミュータブル設計）
    - [x] 複数のコンストラクタ形式サポート
    - [x] 計算プロパティ（center, topLeft, width など）
    - [x] 操作メソッド（contains, intersects, unite）
  - [x] 2.1.4 Matrix クラス（イミュータブル設計）
    - [x] 基本的な行列表現と変換
    - [x] 変換操作（translate, rotate, scale）
    - [x] 行列演算（append, prepend, invert）
- [ ] 2.2 ユーティリティの実装
  - [x] 2.2.1 Numerical ユーティリティ関数
    - [x] 数値計算定数（EPSILON, MACHINE_EPSILON, CURVETIME_EPSILON など）
    - [x] ヘルパー関数（clamp, isZero）
    - [x] 方程式ソルバー（solveQuadratic, solveCubic）
    - [x] その他のヘルパー関数（getNormalizationFactor など）
- [ ] 2.3 基本クラスのテスト作成
  - [x] 2.3.1 すべての基本クラスのユニットテスト（Point.test.ts, Size.test.ts 実装完了、残りを実装中）
  - [x] 2.3.2 エッジケースのテスト
- [x] Lineクラスのユニットテスト（Line.test.ts 実装完了、paper.jsからテスト移植済み）

## フェーズ3: パス関連クラスの実装
- [ ] 3.1 パスの基本構造の実装
  - [x] 3.1.1 Segment クラス（イミュータブル設計）
    - [x] point, handleIn, handleOut プロパティ
    - [x] セグメント操作メソッド（translate, rotate, scale, withSmoothHandles など）
  - [x] 3.1.2 SegmentPoint クラスの実装（SegmentPoint.ts, SegmentPoint.test.ts 完了）
  - [x] 3.1.3 Curve クラスの実装
    - [x] getLength, [x] getPointAt, [x] getTangentAt
    - [x] 曲線操作メソッド（divide, split）
    - [x] Curveコンストラクタの修正（pathを引数として取るように）
- [ ] 3.2 パスクラスの実装
  - [x] 3.2.1 PathItem 基底クラスの実装（インターフェース定義）
  - [x] 3.2.2 Path クラスの実装
  - [x] segments 配列と closed フラグ
  - [x] セグメント操作（add, insert, removeSegment）
  - [x] サブパス操作（moveTo, lineTo, cubicCurveTo）
  - [x] 情報取得メソッド（getLength, getBounds）
  - [x] パス操作メソッド（splitAt, equals）の修正
  - [x] 3.2.3 CompoundPath クラスの実装
- [x] Path/CompoundPathのcopyAttributesをPathItemBaseに集約（2025/05/05 完了）
- [x] PathItemBase, Path, CompoundPathでStyle型(fillRule)を統一利用（2025/05/05 完了）
- [ ] 3.3 パス操作メソッドの実装
  - [ ] 3.3.1 パス生成ファクトリメソッド（Circle, Rectangle, Star など）
  - [ ] 3.3.2 パス変換メソッド
  - [x] 3.3.3 arcToメソッドの実装（円弧描画）
  - [x] 3.3.4 flattenメソッドの実装（曲線を直線セグメントに変換）
  - [x] 3.3.5 flattenメソッドのテスト実装（Path.test.tsに追加）
  - [x] 3.3.6 smoothメソッドの実装（曲線を滑らかにする）
  - [x] 3.3.7 PathFitterクラスの実装（パスの単純化アルゴリズム）
  - [x] 3.3.8 simplifyメソッドの実装（パスの単純化）
- [x] 3.3.9 PathItem.resolveCrossingsのpaper.js準拠実装（Path/CompoundPath両方）【2025/05/05 完了】
- [ ] 3.4 パスクラスのテスト作成
  - [x] 3.4.1 Segmentのユニットテスト（Segment.test.ts の実装完了）
  - [x] 3.4.2 Curveのユニットテスト（Curve.test.ts の実装完了）
  - [x] 3.4.3 Pathのユニットテスト（Path.test.ts の実装完了）
  - [x] 3.4.4 その他のパスクラスのユニットテスト（SegmentPointのテスト完了）

## フェーズ4: ブーリアン演算の実装
- [ ] 4.1 衝突検出の実装
  - [ ] 4.1.1 CollisionDetection ユーティリティ
  - [ ] 4.1.2 曲線と形状の衝突検出関数
- [ ] 4.2 PathTracer の実装
  - [ ] 4.2.1 ウィンディング計算の実装
  - [ ] 4.2.2 パストレースアルゴリズムの実装
- [ ] 4.3 ブーリアン演算関数の実装
  - [ ] 4.3.1 unite (合体) 操作
  - [x] 4.3.2 intersect (交差) 操作の基本実装
  - [ ] 4.3.3 subtract (差分) 操作
  - [ ] 4.3.4 exclude (排他的論理和) 操作
  - [ ] 4.3.5 divide (分割) 操作
- [x] 4.3.6 resolveCrossingsのAPI実装（Path/CompoundPath両方）【2025/05/05 完了】
- [ ] 4.4 ブーリアン演算のテスト作成
  - [x] 4.4.1 intersect操作の基本テスト（paper.jsからテスト移植済み）
  - [x] 4.4.2 その他の演算の基本テスト（unite, subtract, exclude操作のテスト追加）
  - [x] 4.4.3 複雑なケースとエッジケースのテスト（文字列表現による厳密な検証を追加）

## フェーズ5: ビジュアライザーとテストツールの実装
- [ ] 5.1 基本ビジュアライザーの実装
  - [ ] 5.1.1 HTMLキャンバスを使用したシンプルなレンダラー
  - [ ] 5.1.2 パス描画機能の実装
- [ ] 5.2 テスト用ビジュアライザーの実装
  - [ ] 5.2.1 テスト結果の視覚的検証ツール
  - [ ] 5.2.2 Paper.jsとの結果比較ツール
- [ ] 5.3 対話型テストアプリケーションの実装
  - [ ] 5.3.1 インタラクティブなパラメータ調整UI
  - [ ] 5.3.2 リアルタイムでの結果表示

## フェーズ6: パフォーマンス最適化とリファクタリング
- [ ] 6.1 パフォーマンスのベンチマーク
  - [ ] 6.1.1 パフォーマンス測定フレームワークのセットアップ
  - [ ] 6.1.2 主要操作のベンチマーク作成
- [ ] 6.2 パフォーマンス最適化
  - [ ] 6.2.1 計算コストの高いアルゴリズムの最適化
  - [ ] 6.2.2 メモリ使用量の最適化
- [ ] 6.3 APIの改善
  - [ ] 6.3.1 一貫性のあるAPIデザインの見直し
  - [ ] 6.3.2 使いやすさ向上のためのリファクタリング

## フェーズ7: ドキュメント作成と公開準備
- [ ] 7.1 APIドキュメントの作成
  - [ ] 7.1.1 JSDocによるコードドキュメント化
  - [ ] 7.1.2 APIリファレンスサイトの生成
- [ ] 7.2 使用例とチュートリアルの作成
  - [ ] 7.2.1 基本的な使用例
  - [ ] 7.2.2 より高度な使用例とサンプル
- [ ] 7.3 公開準備
  - [ ] 7.3.1 npmパッケージの設定
  - [ ] 7.3.2 リリースプロセスの整備

## 次のステップ（優先度順）
- [x] MangaFarm Organizationへのリモートリポジトリ移行（2025/05/02 完了）
- [ ] PathBoolean.tsの実装改善
  - [x] PathBoolean.tsの機能を複数のファイルに分割
    - [x] winding number関連の処理をPathBooleanWinding.tsに移動
    - [x] 交点計算関連の処理をPathBooleanIntersections.tsに移動
  - [ ] 非交差矩形のunite操作の修正（バウンディングボックス計算の問題）
    - [x] paper.jsのreorientPaths関数の移植または同等機能の実装
    - [ ] tracePaths関数の交点がない場合の処理を修正
    - [ ] 詳細は documents/pathboolean_unite_issue.md を参照
  - [ ] subtract操作の修正
  - [x] PathBooleanWinding.tsのpaper.jsとの挙動の違いを修正
  - [x] PathBooleanWinding.tsとpaper.jsのアルゴリズム上の違いを分析し文書化（documents/paper_js_vs_papyrus2d_winding.md）
- [x] Path.getIntersectionsのインターフェースをpaper.jsと完全に一致させる（2025/05/05 完了）

## 実装方針
- バグを減らすため、まずpaper.jsの既存コードを流用する
- グローバル状態や不透明な依存関係を検出したら、透明性を高めるために書き換える
- 各クラスがイミュータブルな設計となるよう注意する
- レンダリングやDOM関連のコードは除去する