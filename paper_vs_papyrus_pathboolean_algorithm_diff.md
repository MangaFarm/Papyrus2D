# paper.js vs Papyrus2D: PathBooleanIntersections アルゴリズム差異分析

## 概要

Papyrus2DのPathBooleanIntersections.tsは、paper.jsのPathItem.Boolean.jsの交点計算部分を移植したものですが、いくつかの実装上の違いがあります。以下では、挙動に差が出うる主要な違いを分析します。

## 1. 交点計算と処理の違い

### getIntersections関数

- **paper.js**: 
  - CurveLocation.expand()を使用して交点情報を拡張
  - 交点情報はCurveLocationオブジェクトとして扱われる

- **Papyrus2D**: 
  - 独自のIntersectionインターフェースを定義
  - CurveLocationから必要な情報を抽出して独自の形式に変換
  - 交点をcurve1Index, t1の順でソートする処理が追加されている

この違いにより、交点の処理順序が異なる可能性があり、複雑な交差パターンでは結果に差が出る可能性があります。

## 2. パス分割処理の違い

### dividePathAtIntersections vs divideLocations

- **paper.js**: 
  - divideLocations関数を使用
  - 交点の時間パラメータに基づいて曲線を分割
  - 複雑なリンクリスト構造を構築して交点間の関係を管理
  - 曲線分割時に新しいセグメントを自動的に作成

- **Papyrus2D**: 
  - 独自のdividePathAtIntersections関数を実装
  - 各カーブごとに交点をソートしてから分割
  - 交点でカーブを分割し、新しいセグメントを作成
  - 交点情報にセグメントを関連付ける処理が明示的

paper.jsでは交点処理が一元化されていますが、Papyrus2Dでは交点計算と分割処理が分離されています。これにより、複雑な交差パターンや自己交差するパスの処理で挙動の違いが生じる可能性があります。

## 3. 交点のリンク処理

### linkIntersections関数

- **paper.js**: 
  - 交点間のリンクを構築する際に、既存のチェーンを考慮
  - 循環参照を防ぐためのチェックが含まれている

- **Papyrus2D**: 
  - 基本的な機能は同じだが、実装の詳細が異なる
  - 循環参照チェックの実装が若干異なる（prev vs _previous）

この違いは、複雑な交差パターンでのリンクリスト構造の構築に影響を与える可能性があります。

## 4. カーブハンドル処理

### clearCurveHandles関数

- **paper.js**: 
  - 各カーブのclearHandlesメソッドを呼び出す

- **Papyrus2D**: 
  - 各カーブのセグメントのclearHandlesメソッドを直接呼び出す

この違いは、カーブのハンドルクリア処理の詳細実装の違いであり、結果に大きな差は生じないと考えられます。

## 結論

Papyrus2DのPathBooleanIntersections.tsは、paper.jsのアルゴリズムを基本的に踏襲していますが、交点の表現方法や処理順序、パス分割の実装に違いがあります。これらの違いは、特に複雑な交差パターンや自己交差するパスの処理において、挙動の違いを生じさせる可能性があります。

最も重要な違いは、交点情報の表現と管理方法、およびパス分割処理の実装の違いです。これらは、Boolean演算の結果の精度や安定性に影響を与える可能性があります。