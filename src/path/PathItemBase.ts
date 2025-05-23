/**
 * PathItemBase クラス
 * PathItemインターフェースを実装する抽象基底クラス。
 * Path と CompoundPath の共通機能を提供する。
 */

import type { PathItem } from './PathItem';
import type { Point } from '../basic/Point';
import { Rectangle } from '../basic/Rectangle';
import { Matrix } from '../basic/Matrix';
import { Curve } from './Curve';
import type { Segment } from './Segment';
import type { CurveLocation } from './CurveLocation';
import { ChangeFlag, Change } from './ChangeFlag';
import { Numerical } from '../util/Numerical';
import { Style, FillRule } from './Style';

// _boundsCacheの型
export type BoundsCache = {
  ids: { [id: string]: any };
  list: any[];
};

// _boundsの型
export type BoundsEntry = {
  rect: Rectangle;
};

export type Bounds = {
  [key: string]: BoundsEntry;
};

export type BoundsOptions = { 
  // internal?: boolean,  // viewMatrix, globalMatrixがないので無意味
  cacheItem?: PathItemBase ,
  stroke?: boolean,
  handle?: boolean,
};

export abstract class PathItemBase implements PathItem {
  // PathItemインターフェースの実装
  _matrix: Matrix;
  _matrixDirty: boolean = false;
  _boundsCache?: BoundsCache;
  _bounds?: Bounds;
  _version: number = 0;
  static _idCount: number = 0;
  _id: number;
  _index: number | null;
  _parent: PathItemBase | null = null;
  _style: Style;

  constructor() {
    this._matrix = Matrix.identity();
    this._style = new Style();
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

  replaceWith(item: PathItem): PathItem | null {
    var ok = item && item.insertBelow(this);
    if (ok)
        this._remove(true, true);
    return ok;
  }

  insertBelow(item: PathItem): PathItem | null {
    return this._insertAt(item, 0);
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

  addChild(item: PathItemBase) {
    const children = this.getChildren()!;
    return this._insertChild(children.length, item);
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
        var item = items[i];
        item._parent = this;
      }
      this._changed(/*#=*/ Change.CHILDREN);
      return items;
    } else {
      return null;
    }
  }

  setChildren(items: PathItemBase[]) {
    this.removeChildren(0);
    this.addChildren(items);
  }

  removeChildren(start: number, end?: number) {
    const children = this.getChildren();
    if (!children)
        return null;
    start = start || 0;
    end = end ?? children.length;
    // Use Base.splice(), which adjusts #_index for the items above, and
    // deletes it for the removed items. Calling #_remove() afterwards is
    // fine, since it only calls Base.splice() if #_index is set.
    const removed = children.splice(start, end - start);
    for (var i = removed.length - 1; i >= 0; i--) {
        // Don't notify parent each time, notify it separately after.
        removed[i]._remove(true, false);
    }
    if (removed.length > 0)
        this._changed(/*#=*/Change.CHILDREN);
    return removed;
  }

  addChildren(items) {
    const children = this.getChildren()!;
    return this.insertChildren(children.length, items);
  }

  getFirstChild(): PathItemBase | null {
    const children = this.getChildren()!;
    return children.length > 0 ? children[0] : null;
  }

  getLastChild(): PathItemBase | null {
    const children = this.getChildren()!;
    return children.length > 0 ? children[children.length - 1] : null;
  }

  // 抽象プロパティ
  abstract get closed(): boolean;
  abstract get segmentCount(): number;

  // 抽象メソッド - サブクラスで実装する必要がある
  abstract getSegments(): Segment[];
  abstract getCurves(): Curve[];
  abstract getArea(): number;
  abstract getPaths(): any[];
  abstract clone(deep?: boolean): PathItem;

  isClockwise(): boolean {
    return this.getArea() >= 0;
  }

  setClockwise(clockwise: boolean): PathItem {
    if (this.isClockwise() !== !!clockwise) {
      this.reverse();
    }
    return this;
  }

  abstract getLength(): number;
  abstract getPointAt(t: number): Point;
  abstract getTangentAt(t: number): Point;
  abstract contains(point: Point): boolean;

  getIntersections(
    targetPath: PathItem,
    include: (loc: CurveLocation) => boolean,
    _targetMatrix: Matrix | null,
    _returnFirst: boolean
  ): CurveLocation[] {
    const self = this === targetPath; // 自己交差
    const matrix1 = this._matrix ? this._matrix._orNullIfIdentity() : null;
    const matrix2 = self ? matrix1
      : (_targetMatrix ?? targetPath._matrix)._orNullIfIdentity();

    const curves1 = this.getCurves();
    const curves2 = self ? null : targetPath.getCurves();

    return self || this.getBounds(matrix1, {}).intersects(
      (targetPath as PathItemBase).getBounds(matrix2, {}), /*#=*/Numerical.EPSILON)
      ? Curve.getIntersections(
          curves1, curves2, include,
          matrix1, matrix2, _returnFirst)
      : [];
  }


  abstract reduce(options?: { simplify?: boolean }): PathItem;

  copyAttributes(path: PathItem, excludeMatrix?: boolean): PathItem {
    if (!excludeMatrix && path._matrix) {
      this._matrix = path._matrix.clone();
    }
    this._style = path._style.clone();
    return this;
  }

  resolveCrossings(): PathItem {
    throw new Error('Method resolveCrossings() not implemented yet');
  }

  abstract reorient(nonZero?: boolean, clockwise?: boolean): PathItem;

  getStyle(): Style {
    return this._style;
  }

  getFillRule(): string {
    return this._style.fillRule;
  }

  setFillRule(rule: FillRule): PathItem {
    this._style.fillRule = rule;
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

  abstract getChildren(): PathItemBase[] | null;

  _changed(flags: ChangeFlag, option?: any) {
    var cacheParent = this._parent;
    if (flags & /*#=*/ ChangeFlag.GEOMETRY) {
      // Clear cached bounds, position and decomposed matrix whenever
      // geometry changes.
      this._bounds = undefined;
    }
    if (cacheParent && flags & /*#=*/ (ChangeFlag.GEOMETRY | ChangeFlag.STROKE)) {
      // Clear cached bounds of all items that this item contributes to.
      // We call this on the parent, since the information is cached on
      // the parent, see getBounds().
      cacheParent._clearBoundsCache();
    }
    if (flags & /*#=*/ ChangeFlag.CHILDREN) {
      // Clear cached bounds of all items that this item contributes to.
      // Here we don't call this on the parent, since adding / removing a
      // child triggers this notification on the parent.
      this._clearBoundsCache();
    }
  }

  _updateBoundsCache(child: PathItemBase | null) {
    if (!child) {
      return;
    }

    // Set-up the parent's boundsCache structure if it does not
    // exist yet and add the item to it.
    const id = child._id;
    this._boundsCache ??= {
      ids: {},
      list: [],
    };
    const ref = this._boundsCache;
    if (!ref.ids[id]) {
      ref.list.push(child);
      ref.ids[id] = child;
    }
  }

  _clearBoundsCache() {
    var cache = this._boundsCache;
    if (!cache) {
      return;
    }

    // Erase cache before looping, to prevent circular recursion.
    this._bounds = this._boundsCache = undefined;
    for (var i = 0, list = cache.list, l = list.length; i < l; i++) {
      var other = list[i];
      if (other !== this) {
        other._bounds = other._position = undefined;
        // We need to recursively call _clearBoundsCache, as
        // when the cache for the other item's children is not
        // valid anymore, that propagates up the scene graph.
        if (other._boundsCache) other._clearBoundsCache();
      }
    }
  }

  getBoundsOptions(): BoundsOptions {
    return {};
  }

  // paper.jsの実装がとてもわかりづらいが、要するに
  // 1.getBounds(options)の形で呼び出し可能
  // 2.this._boundsOptionsがある場合はそれを優先
  // ということのようである。なので現代的に書き直す。
  // なお、_boundsOptionsはサブクラスごとに決まるそうで、
  // PathやCompoundPathでは{}と決まっているようなので、一旦{}を返す関数としておく。
  // LinkedRectangleは操作できるようになるものらしい。完全に削除。
  getBounds(matrix: Matrix | null, options: BoundsOptions): Rectangle {
    const opts = {...options, ...this.getBoundsOptions()};
    
    // We can only cache the bounds if the path uses stroke-scaling, or if
    // no stroke is involved in the calculation of the bounds.
    // When strokeScaling is false, the bounds are affected by the zoom
    // level of the view, hence we can't cache.
    // TODO: Look more into handling of stroke-scaling, e.g. on groups with
    // some children that have strokeScaling, as well as SymbolItem with
    // SymbolDefinition that have strokeScaling!
    // TODO: Once that is resolved, we should be able to turn off
    // opts.stroke if a resolved item definition does not have a stroke,
    // allowing the code to share caches between #strokeBounds and #bounds.
    if (!opts.stroke || this.getStrokeScaling())
        opts.cacheItem = this;
    // If we're caching bounds, pass on this item as cacheItem, so
    // the children can setup _boundsCache structures for it.
    var rect = this._getCachedBounds(matrix, opts, false).rect;
    // If we're returning '#bounds', create a LinkedRectangle that uses
    // the setBounds() setter to update the Item whenever the bounds are
    // changed:
    return rect;  
  }

  _getCachedBounds(matrix: Matrix | null, options: BoundsOptions, noInternal: boolean): BoundsEntry {
    // options.internalは常にtrueとして最適化
    // したがってinternalは常にtrue
    const cacheItem = options.cacheItem;
    const _matrix = this._matrix._orNullIfIdentity();
    const cacheKey =
      cacheItem &&
      (!matrix || matrix.equals(_matrix!)) &&
      this._getBoundsCacheKey(options, true);
    let bounds = this._bounds;
    // NOTE: This needs to happen before returning cached values, since even
    // then, _boundsCache needs to be kept up-to-date.
    this._parent?._updateBoundsCache(cacheItem ?? null);
    if (cacheKey && bounds && cacheKey in bounds) {
      const cached = bounds[cacheKey];
      return {
        rect: cached.rect.clone(),
      };
    }
    const res = this._getBounds(matrix || _matrix, options);
    const rect = res.rect || res;
    // If we can cache the result, update the _bounds cache structure
    // before returning
    if (cacheKey) {
      if (!bounds) {
        this._bounds = bounds = {};
      }
      bounds[cacheKey] = {
        rect: rect.clone(),
      };
    }
    return {
      rect: rect,
    };
  }

  _getBounds(matrix: Matrix | null, options: BoundsOptions): BoundsEntry {
    // NOTE: We cannot cache these results here, since we do not get
    // _changed() notifications here for changing geometry in children.
    // But cacheName is used in sub-classes such as SymbolItem and Raster.
    var children = this.getChildren();
    // TODO: What to return if nothing is defined, e.g. empty Groups?
    // Scriptographer behaves weirdly then too.
    if (!children || !children.length)
        return { rect: new Rectangle(0, 0, 0, 0) };
    // Call _updateBoundsCache() even when the group only holds empty /
    // invisible items), so future changes in these items will cause right
    // handling of _boundsCache.
    this._updateBoundsCache(options.cacheItem ?? null);
    return PathItemBase._getBounds(children, matrix, options);
  }

  _getBoundsCacheKey(options: BoundsOptions, internal: boolean) {
    return [
        options.stroke ? 1 : 0,
        options.handle ? 1 : 0,
        internal ? 1 : 0
    ].join('');
  }

  isEmpty(recursively: boolean) {
    var children = this.getChildren();
    var numChildren = children ? children.length : 0;
    if (recursively) {
        // In recursive check, item is empty if all its children are empty.
        for (var i = 0; i < numChildren; i++) {
            if (!children![i].isEmpty(recursively)) {
                return false;
            }
        }
        return true;
    }
    return !numChildren;
  }

  static _getBounds(items: PathItem[], matrix: Matrix | null, options: BoundsOptions): BoundsEntry {
    var x1 = Infinity,
        x2 = -x1,
        y1 = x1,
        y2 = x2;
    // NOTE: As soon as one child-item has non-scaling strokes, the full
    // bounds need to be considered non-scaling for caching purposes.
    options = options || {};
    for (var i = 0, l = items.length; i < l; i++) {
        var item = items[i] as PathItemBase;
        // Item is handled if it is visible and not recursively empty.
        // This avoid errors with nested empty groups (#1467).
        if (!item.isEmpty(true)) {
            // Pass true for noInternal, since even when getting
            // internal bounds for this item, we need to apply the
            // matrices to its children.
            var bounds = item._getCachedBounds(
                matrix && matrix.appended(item._matrix), options, true),
                rect = bounds.rect;
            x1 = Math.min(rect.x, x1);
            y1 = Math.min(rect.y, y1);
            x2 = Math.max(rect.x + rect.width, x2);
            y2 = Math.max(rect.y + rect.height, y2);
        }
    }
    return {
        rect: isFinite(x1)
            ? new Rectangle(x1, y1, x2 - x1, y2 - y1)
            : new Rectangle(0, 0, 0, 0),
    };
  }

  _getStrokeMatrix(matrix: Matrix | null, options: BoundsOptions) {
    // globalMatrix, viewMatrixがないのでシンプル
    if (this.getStrokeScaling()) {
        return matrix;
    } else {
        return Matrix.identity();
    }
}
  getStrokeScaling(): boolean {
    return this._style.getStrokeScaling();
  }

  abstract moveTo(point: Point): PathItem;
  abstract moveBy(point: Point): PathItem;
  abstract lineTo(point: Point): PathItem;
  abstract cubicCurveTo(handle1: Point, handle2: Point, to: Point): PathItem;
  abstract quadraticCurveTo(handle: Point, to: Point): PathItem;
  abstract curveTo(handle: Point, to: Point, t: number): PathItem;
  abstract arcTo(handle: Point, to: Point): PathItem;
  abstract lineBy(point: Point): PathItem;
  abstract cubicCurveBy(handle1: Point, handle2: Point, to: Point): PathItem;
  abstract quadraticCurveBy(handle: Point, to: Point): PathItem;
  abstract curveBy(handle: Point, to: Point, t: number): PathItem;
  abstract arcBy(handle: Point, to: Point): PathItem;
  abstract closePath(tolerance: number): PathItem;

  abstract reverse(): PathItem;
  abstract flatten(flatness: number): void;
  abstract simplify(tolerance: number): boolean;
  abstract smooth(options?: {
    type?: 'asymmetric' | 'continuous';
    from?: number | Segment;
    to?: number | Segment;
  }): void;

  abstract getPathData(matrix: Matrix, precision: number): string;
}
