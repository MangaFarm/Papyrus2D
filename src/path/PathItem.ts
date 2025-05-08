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
import type { CurveLocation } from './CurveLocation';
import type { Path } from './Path';

/**
 * Style型
 * 単純な描画スタイル定義。fillRuleのみをサポート。
 */
export type FillRule = 'nonzero' | 'evenodd';
export type Style = {
  fillRule: FillRule;
};

export interface PathItem {
  _matrix: Matrix;
  _matrixDirty: boolean;
  style: Style;
  readonly closed: boolean;
  readonly segmentCount: number;

  getLength(): number;
  getArea(): number;
  getBounds(matrix: Matrix | null): Rectangle;
  getSegments(): Segment[];
  getPointAt(t: number): Point;
  getTangentAt(t: number): Point;
  contains(point: Point): boolean;
  isEmpty(): boolean;
  getCurves(): Curve[];
  getIntersections(
    targetPath: PathItem, 
    include: (loc: CurveLocation) => boolean,
    _targetMatrix: Matrix | null, 
    _returnFirst: boolean): CurveLocation[];
  reduce(options: { simplify: boolean }): PathItem;
  clone(deep?: boolean): PathItem;
  resolveCrossings(): PathItem;
  reorient(nonZero: boolean, clockwise: boolean): PathItem;
  getFillRule(): string;

  getIndex(): number | null;
  getParent(): PathItem | null;
  isSibling(item: PathItem): boolean
  insertAbove(path: PathItem): PathItem | null;
  copyAttributes(path: PathItem, excludeMatrix?: boolean): PathItem;
  transform(matrix: Matrix | null, applyRecursively?: boolean, setApplyMatrix?: boolean): PathItem;
  getPaths(): Path[];
  isClockwise(): boolean;
  reverse(): PathItem;
}