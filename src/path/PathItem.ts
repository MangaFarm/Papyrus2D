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
   * パスの全Curveを取得
   */
  getCurves(): Curve[];
  /**
   * 他のPathとの交点列挙
   */
  getIntersections(other: Path): CurveLocation[];
}