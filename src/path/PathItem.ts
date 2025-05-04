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
   * 他のPathとの交点列挙
   */
  getIntersections(other: Path): CurveLocation[];

  /**
   * パスを簡略化する
   * 単一のPathに変換できる場合は変換する
   * paper.jsのPathItem.reduce()を移植
   * @param options 簡略化オプション
   * @returns 簡略化されたPathItemオブジェクト
   */
  reduce?(options?: { simplify?: boolean }): PathItem;

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
  copyAttributes?(path: PathItem, excludeMatrix?: boolean): PathItem;
}