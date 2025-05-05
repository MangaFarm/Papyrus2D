/**
 * PathItem インターフェース
 * Paper.js の PathItem (src/path/PathItem.js) を参考にした基底インターフェース。
 * CompoundPath, Path の共通APIを定義する。
 * グローバル状態は持たず、イミュータブル設計を基本とする。
 */

import { Point } from '../basic/Point';
import { Rectangle } from '../basic/Rectangle';
import { Matrix } from '../basic/Matrix';
import { Curve } from './Curve';
import { Segment } from './Segment';
import type { Path } from './Path';
import type { CurveLocation } from './CurveLocation';

/**
 * Style型
 * 単純な描画スタイル定義。fillRuleのみをサポート。
 */
export type FillRule = 'nonzero' | 'evenodd';
export type Style = {
  fillRule: FillRule;
};

export interface PathItem {
  /**
   * 変換行列（paper.js互換）
   * 内部キャッシュとして使用
   */
  _matrix?: Matrix;
  
  /**
   * 行列が変更されたかどうかのフラグ
   */
  _matrixDirty?: boolean;
  
  /**
   * スタイル設定
   */
  style: Style;
  /**
   * パスが閉じているかどうか
   */
  readonly closed: boolean;

  /**
   * パスの全セグメント数
   */
  readonly segmentCount: number;

  /**
   * パスの全長
   */
  getLength(): number;

  /**
   * パスの面積
   */
  getArea(): number;

  /**
   * パスの外接矩形
   */
  getBounds(): Rectangle;

  /**
   * パスのセグメントを取得
   */
  getSegments(): Segment[];

  /**
   * 指定位置の点を取得
   * @param t 0〜1のパラメータ
   */
  getPointAt(t: number): Point;

  /**
   * 指定位置の接線ベクトルを取得
   * @param t 0〜1のパラメータ
   */
  getTangentAt(t: number): Point;

  /**
   * パスが点を含むか判定
   */
  contains(point: Point): boolean;

  /**
   * パスが空かどうかを判定
   */
  isEmpty?(): boolean;

  /**
   * パスを削除する
   */
  remove?(): PathItem | null;

  /**
   * パスの全Curveを取得
   */
  getCurves(): Curve[];
  /**
   * 他のPathItemとの交点列挙
   */
  getIntersections(other: PathItem): CurveLocation[];

  /**
   * パスを簡略化する
   * 単一のPathに変換できる場合は変換する
   * paper.jsのPathItem.reduce()を移植
   * @param options 簡略化オプション
   * @returns 簡略化されたPathItemオブジェクト
   */
  reduce(options?: { simplify?: boolean }): PathItem;

  /**
   * パスのクローンを作成する
   * paper.jsのItem.clone()を移植
   * @param deep 深いクローンを作成するかどうか
   * @returns クローンされたパス
   */
  clone(deep?: boolean): PathItem;

  /**
   * 交差を解決する
   * paper.jsのPathItem.resolveCrossings()を移植
   * @returns 交差が解決されたパス
   */
  resolveCrossings(): PathItem;

  /**
   * パスの向きを再設定する
   * paper.jsのPathItem.reorient()を移植
   * @param nonZero 非ゼロ塗りつぶしルールを適用するかどうか
   * @param clockwise 時計回りにするかどうか
   * @returns このパス
   */
  reorient(nonZero?: boolean, clockwise?: boolean): PathItem;

  /**
   * 塗りつぶしルールを取得する
   * paper.jsのItem.getFillRule()を移植
   * @returns 塗りつぶしルール
   */
  getFillRule(): string;

  /**
   * 指定されたパスが兄弟関係にあるかどうかを判定する
   * paper.jsのItem.isSibling()を移植
   * @param path 判定するパス
   * @returns 兄弟関係にある場合はtrue
   */
  isSibling?(path: PathItem): boolean;

  /**
   * パスのインデックスを取得する
   * paper.jsのItem.getIndex()を移植
   * @returns インデックス
   */
  getIndex?(): number;

  /**
   * 指定されたパスの上に挿入する
   * paper.jsのItem.insertAbove()を移植
   * @param path 挿入する位置の基準となるパス
   * @returns このパス
   */
  insertAbove?(path: PathItem): PathItem;

  /**
   * 指定されたパスの属性をコピーする
   * paper.jsのItem.copyAttributes()を移植
   * @param path コピー元のパス
   * @param excludeMatrix 行列を除外するかどうか
   * @returns このパス
   */
  copyAttributes(path: PathItem, excludeMatrix?: boolean): PathItem;

  /**
   * 変換行列を適用する
   * paper.jsのItem.transform()を移植
   * @param matrix 変換行列
   * @param applyRecursively 再帰的に適用するかどうか
   * @param setApplyMatrix 行列を適用するかどうか
   * @returns このパス
   */
  transform(matrix: Matrix | null, applyRecursively?: boolean, setApplyMatrix?: boolean): PathItem;

  /**
   * パスの配列を取得する
   * CompoundPathの場合は子パスの配列、Pathの場合は自身を含む配列を返す
   * paper.jsのgetPaths関数を移植
   * @returns パスの配列
   */
  getPaths(): Path[];
}