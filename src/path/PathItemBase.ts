/**
 * PathItemBase クラス
 * PathItemインターフェースを実装する抽象基底クラス。
 * Path と CompoundPath の共通機能を提供する。
 */

import type { PathItem, Style, FillRule } from './PathItem';
import type { Point } from '../basic/Point';
import type { Rectangle } from '../basic/Rectangle';
import { Matrix } from '../basic/Matrix';
import type { Curve } from './Curve';
import type { Segment } from './Segment';
import type { CurveLocation } from './CurveLocation';
import { Change } from './ChangeFlag';

export abstract class PathItemBase implements PathItem {
  // PathItemインターフェースの実装
  _matrix: Matrix;
  _matrixDirty: boolean = false;
  _bounds?: Rectangle;
  _version: number = 0;
  static _idCount: number = 0;
  _id: number;
  _index: number | null;
  _parent: PathItemBase | null = null;

  constructor() {
    this._id = ++PathItemBase._idCount;
  }

  getIndex(): number | null {
    return this._index;
  }

  getParent(): PathItem | null {
    return this._parent;
  }

  isSibling(item: PathItem): boolean {
    if (!(item instanceof PathItemBase)) {
      return false;
    }
    return this._parent === item._parent;
  }

  insertAbove(item: PathItem): PathItem | null {
    return this._insertAt(item, 1);
  }

  _insertAt(item: PathItem, offset: number): PathItem | null {
    const parent = item?.getParent() as PathItemBase | null;
    // Only insert if the item is not the same as `this`, and if it
    // actually has an owner into which we can insert.
    const res: PathItemBase | null = parent && item !== this ? this : null;
    if (res) {
      // Notify parent of change. Don't notify item itself yet,
      // as we're doing so when adding it to the new owner below.
      res._remove(false, true);
      parent!._insertChild(item.getIndex()! + offset, res);
    }
    return res;
  }

  _remove(notifySelf: boolean, notifyParent: boolean) {
    const parent = this._parent;
    const index = this._index;

    if (parent) {
      if (index != null) {
        parent.getChildren()!.splice(index, 1);
      }
      if (notifySelf) this._changed(/*#=*/ Change.INSERTION);
      // Notify owner of changed children (this can be the project too).
      if (notifyParent) parent._changed(/*#=*/ Change.CHILDREN, this);
      this._parent = null;
      return true;
    }
    return false;
  }

  _insertChild(index: number, item: PathItemBase) {
    var res = item ? this.insertChildren(index, [item]) : null;
    return res && res[0];
  }

  insertChildren(index: number, items: PathItemBase[]) {
    var children = this.getChildren();
    if (children && items && items.length > 0) {
      // We need to clone items because it may be an Item#children array.
      // Also, we're removing elements if they don't match _type.
      // Use Base.slice() because items can be an arguments object.
      items = items.slice();
      // Remove the items from their parents first, since they might be
      // inserted into their own parents, affecting indices.
      // Use the loop also to filter invalid items.
      var inserted = {};
      for (var i = items.length - 1; i >= 0; i--) {
        var item = items[i],
          id = item && item._id;
        // If an item was inserted already, it must be included multiple
        // times in the items array. Only insert once.
        if (!item || inserted[id]) {
          items.splice(i, 1);
        } else {
          // Notify parent of change. Don't notify item itself yet,
          // as we're doing so when adding it to the new owner below.
          item._remove(false, true);
          inserted[id] = true;
        }
      }
      children.splice(index, 0, ...items);
      for (var i = 0, l = items.length; i < l; i++) {
        var item = items[i]
        item._parent = this;
      }
      this._changed(/*#=*/ Change.CHILDREN);
      return items;
    } else {
      return null;
    }
  }

  // スタイル設定
  style: Style = {
    fillRule: 'nonzero',
  };

  // 抽象プロパティ
  abstract get closed(): boolean;
  abstract get segmentCount(): number;

  // 抽象メソッド - サブクラスで実装する必要がある
  abstract getSegments(): Segment[];
  abstract getCurves(): Curve[];
  abstract getArea(): number;
  abstract reverse(): PathItemBase;
  abstract getPaths(): any[];
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
  setClockwise(clockwise: boolean): PathItem {
    if (this.isClockwise() !== !!clockwise) {
      this.reverse();
    }
    return this;
  }

  abstract getLength(): number;
  abstract getBounds(matrix?: Matrix | null): Rectangle;
  abstract getPointAt(t: number): Point;
  abstract getTangentAt(t: number): Point;
  abstract contains(point: Point): boolean;
  abstract getIntersections(
    targetPath: PathItem,
    include: (loc: CurveLocation) => boolean,
    _targetMatrix: Matrix | null,
    _returnFirst: boolean
  ): CurveLocation[];
  abstract isEmpty(): boolean;
  abstract reduce(options?: { simplify?: boolean }): PathItem;

  copyAttributes(path: PathItem, excludeMatrix?: boolean): PathItem {
    if (!excludeMatrix && path._matrix) {
      this._matrix = path._matrix.clone();
    }
    this.style = { ...path.style };
    return this;
  }

  resolveCrossings(): PathItem {
    throw new Error('Method resolveCrossings() not implemented yet');
  }

  abstract reorient(nonZero?: boolean, clockwise?: boolean): PathItem;

  getFillRule(): string {
    return this.style.fillRule;
  }

  setFillRule(rule: FillRule): PathItem {
    this.style.fillRule = rule;
    return this;
  }

  transform(matrix: Matrix | null, applyRecursively?: boolean, setApplyMatrix?: boolean): PathItem {
    const _matrix = this._matrix || Matrix.identity();
    const transformMatrix = matrix && !matrix.isIdentity();

    if (!transformMatrix && !applyRecursively) {
      return this;
    }

    if (transformMatrix) {
      if (this._matrix) {
        this._matrix = _matrix.prepend(matrix);
      } else {
        this._matrix = matrix.clone();
      }

      this._matrixDirty = true;
      this._bounds = undefined;
    }
    this._transformContent(matrix, applyRecursively);
    this._version++;

    return this;
  }

  protected _transformContent(matrix: Matrix | null, applyRecursively?: boolean): boolean {
    // PathItemBaseは抽象クラスなので、実装はサブクラスで行う
    // getPaths()は抽象メソッドなので、それを使って子パスに変換を適用
    const paths = this.getPaths();
    if (paths && paths.length > 0) {
      for (let i = 0, len = paths.length; i < len; i++) {
        // PathItemBaseを継承したオブジェクトのみtransformメソッドを呼び出せる
        if (paths[i] instanceof PathItemBase) {
          (paths[i] as PathItemBase).transform(matrix, applyRecursively);
        }
      }
      return true;
    }
    return false;
  }

  abstract getChildren(): PathItem[] | null;
  abstract _changed(flags: number, item?: PathItemBase): void;
}
