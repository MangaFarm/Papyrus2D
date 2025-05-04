/**
 * PathItemBase クラス
 * PathItemインターフェースを実装する抽象基底クラス。
 * Path と CompoundPath の共通機能を提供する。
 */

import { Point } from '../basic/Point';
import { Rectangle } from '../basic/Rectangle';
import { Matrix } from '../basic/Matrix';
import { Curve } from './Curve';
import { Segment } from './Segment';
import { CurveLocation } from './CurveLocation';
import { PathItem } from './PathItem';
import type { Path } from './Path';

export abstract class PathItemBase implements PathItem {
  // PathItemインターフェースの実装
  _matrix?: Matrix;
  _matrixDirty: boolean = false;
  _bounds?: Rectangle;
  _version: number = 0;
  _id: string = Math.random().toString(36).substring(2, 15);

  // 抽象プロパティ
  abstract get closed(): boolean;
  abstract get segmentCount(): number;

  // 抽象メソッド - サブクラスで実装する必要がある
  abstract getSegments(): Segment[];
  abstract getCurves(): Curve[];
  abstract getArea(): number;
  abstract reverse(): PathItemBase;
  abstract getPaths(): Path[];
  abstract clone(deep?: boolean): PathItem;

  /**
   * パスが時計回りかどうかを判定
   * paper.jsのisClockwise()メソッドを移植
   * @returns 時計回りならtrue
   */
  isClockwise(): boolean {
    return this.getArea() >= 0;
  }

  /**
   * パスの方向を時計回りまたは反時計回りに設定します
   * paper.jsのsetClockwise()メソッドを移植
   * @param clockwise 時計回りにする場合はtrue、反時計回りにする場合はfalse
   * @returns このパス
   */
  setClockwise(clockwise: boolean): PathItemBase {
    if (this.isClockwise() !== !!clockwise) {
      this.reverse();
    }
    return this;
  }

  /**
   * パスの長さを取得
   */
  abstract getLength(): number;

  /**
   * パスの境界ボックスを取得
   */
  abstract getBounds(matrix?: Matrix | null): Rectangle;

  /**
   * 指定されたパラメータ位置のパス上の点を取得
   */
  abstract getPointAt(t: number): Point;

  /**
   * 指定されたパラメータ位置のパス上の接線ベクトルを取得
   */
  abstract getTangentAt(t: number): Point;

  /**
   * 点がパス内部にあるかどうかを判定
   */
  abstract contains(point: Point): boolean;

  /**
   * 他のパスとの交点を取得
   */
  abstract getIntersections(path: PathItem): CurveLocation[];

  /**
   * パスが空かどうかを判定
   */
  abstract isEmpty(): boolean;

  /**
   * パスを削除する
   */
  abstract remove(): PathItem | null;

  /**
   * パスを簡略化する
   */
  abstract reduce(options?: { simplify?: boolean }): PathItem;

  /**
   * 指定されたパスが兄弟関係にあるかどうかを判定する
   */
  abstract isSibling(path: PathItem): boolean;

  /**
   * パスのインデックスを取得する
   */
  abstract getIndex(): number;

  /**
   * 指定されたパスの上に挿入する
   */
  abstract insertAbove(path: PathItem): PathItem;

  /**
   * 指定されたパスの属性をコピーする
   */
  abstract copyAttributes(path: PathItem, excludeMatrix?: boolean): PathItem;
}