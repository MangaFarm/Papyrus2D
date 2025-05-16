/**
 * PathItem インターフェース
 * Paper.js の PathItem (src/path/PathItem.js) を参考にした基底インターフェース。
 * CompoundPath, Path の共通APIを定義する。
 * グローバル状態は持たず、イミュータブル設計を基本とする。
 */

import { Point } from '../basic/Point';
import { Matrix } from '../basic/Matrix';
import { Curve } from './Curve';
import { Segment } from './Segment';
import type { CurveLocation } from './CurveLocation';
import type { Path } from './Path';
import { Style } from './Style';
import * as PathSVG from './PathSVG';

export interface PathItem {
  _matrix: Matrix;
  _matrixDirty: boolean;
  _style: Style;
  readonly closed: boolean;
  readonly segmentCount: number;

  getLength(): number;
  getArea(): number;
  getSegments(): Segment[];
  getPointAt(t: number): Point;
  getTangentAt(t: number): Point;
  contains(point: Point): boolean;
  isEmpty(recursive: boolean): boolean;
  getCurves(): Curve[];
  getIntersections(
    targetPath: PathItem,
    include: (loc: CurveLocation) => boolean,
    _targetMatrix: Matrix | null,
    _returnFirst: boolean
  ): CurveLocation[];
  reduce(options: { simplify: boolean }): PathItem;
  clone(deep?: boolean): PathItem;
  resolveCrossings(): PathItem;
  reorient(nonZero: boolean, clockwise: boolean): PathItem;
  getFillRule(): string;

  getIndex(): number | null;
  getParent(): PathItem | null;
  isSibling(item: PathItem): boolean;
  insertBelow(path: PathItem): PathItem | null;
  insertAbove(path: PathItem): PathItem | null;
  copyAttributes(path: PathItem, excludeMatrix?: boolean): PathItem;
  transform(matrix: Matrix | null, applyRecursively?: boolean, setApplyMatrix?: boolean): PathItem;
  getPaths(): Path[];
  isClockwise(): boolean;

  moveTo(point: Point): PathItem;
  moveBy(point: Point): PathItem;
  lineTo(point: Point): PathItem;
  cubicCurveTo(handle1: Point, handle2: Point, to: Point): PathItem;
  quadraticCurveTo(handle: Point, to: Point): PathItem;
  curveTo(handle: Point, to: Point, t: number): PathItem;
  arcTo(handle: Point, to: Point): PathItem;
  lineBy(point: Point): PathItem;
  cubicCurveBy(handle1: Point, handle2: Point, to: Point): PathItem;
  quadraticCurveBy(handle: Point, to: Point): PathItem;
  curveBy(handle: Point, to: Point, t: number): PathItem;
  arcBy(handle: Point, to: Point): PathItem;

  reverse(): PathItem;
  flatten(flatness: number): PathItem;
  simplify(tolerance: number): PathItem;
  smooth(options?: {
    type?: 'asymmetric' | 'continuous';
    from?: number | Segment;
    to?: number | Segment;
  }): PathItem;

  getPathData(matrix: Matrix, precision: number): string;
}

export function fromPathData(val: string): PathItem {
  const compound = (val.match(/m/gi) || []).length > 1 || /z\s*\S+/i.test(val);
  if (compound) {
    return PathSVG.createCompoundPathFromPathData(val);
  } else {
    return PathSVG.createPathfromPathData(val);
  }
}
