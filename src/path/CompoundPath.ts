/**
 * CompoundPath クラス
 * Paper.js の CompoundPath (src/path/CompoundPath.js) を参考にした実装。
 * 複数のパスから構成される複合パスを表現し、PathItemBase クラスを継承する。
 * 名前付き子要素のようなシーン管理機能は削除されている
 */

import type { PathItem } from './PathItem';
import { Point } from '../basic/Point';
import { Matrix } from '../basic/Matrix';
import { Curve } from './Curve';
import { Path } from './Path';
import { Segment } from './Segment';
import { PathItemBase } from './PathItemBase';
import { CurveLocation } from './CurveLocation';
import { Change } from './ChangeFlag';
import { reorientPaths } from './PathBooleanReorient';
import { resolveCrossings } from './PathBooleanResolveCrossings';

export class CompoundPath extends PathItemBase {
  _name?: string;
  _children: Path[] = [];
  
  constructor(paths?: Path[]) {
    super();
    this._children = [];
    if (paths && Array.isArray(paths)) {
      this.addChildren(paths);
    }
  }

  getChildren(): Path[] | null {
    return this._children;    
  }

  isClosed(): boolean {
    const children = this._children;
    for (let i = 0, l = children.length; i < l; i++) {
      if (!children[i]._closed) {
        return false;
      }
    }
    return true;
  }

  setClosed(closed: boolean): void {
    const children = this._children;
    for (let i = 0, l = children.length; i < l; i++) {
      children[i].setClosed(closed);
    }
    this._changed(Change.GEOMETRY);
  }

  get closed(): boolean {
    return this.isClosed();
  }

  get segmentCount(): number {
    let count = 0;
    const children = this._children;
    for (let i = 0, l = children.length; i < l; i++) {
      count += children[i].segmentCount;
    }
    return count;
  }

  getFirstSegment(): Segment | undefined {
    const first = this.getFirstChild() as Path;
    return first ? first.getFirstSegment() : undefined;
  }

  getLastSegment(): Segment | undefined {
    const last = this.getLastChild() as Path;
    return last ? last.getLastSegment() : undefined;
  }

  getSegments(): Segment[] {
    const children = this._children;
    const segments: Segment[] = [];
    for (let i = 0, l = children.length; i < l; i++) {
      const childSegments = children[i].getSegments();
      segments.push(...childSegments);
    }
    return segments;
  }

  getCurves(): Curve[] {
    const children = this._children;
    const curves: Curve[] = [];
    for (let i = 0, l = children.length; i < l; i++) {
      const childCurves = children[i].getCurves();
      curves.push(...childCurves);
    }
    return curves;
  }

  getFirstCurve(): Curve | undefined {
    const first = this.getFirstChild() as Path;
    return first ? first.getFirstCurve() : undefined;
  }

  getLastCurve(): Curve | undefined {
    const last = this.getLastChild() as Path;
    return last ? last.getLastCurve() : undefined;
  }

  getArea(): number {
    const children = this._children;
    let area = 0;
    for (let i = 0, l = children.length; i < l; i++) {
      area += children[i].getArea();
    }
    return area;
  }

  getLength(): number {
    const children = this._children;
    let length = 0;
    for (let i = 0, l = children.length; i < l; i++) {
      length += children[i].getLength();
    }
    return length;
  }

  getPointAt(t: number): Point {
    // 全長に対する位置を計算
    const length = this.getLength();
    if (length === 0) {
      return new Point(0, 0);
    }
    
    const offset = t * length;
    let currentLength = 0;
    const children = this._children;
    
    for (let i = 0, l = children.length; i < l; i++) {
      const child = children[i];
      const childLength = child.getLength();
      if (currentLength + childLength > offset) {
        // この子パス内の位置を計算
        const childOffset = offset - currentLength;
        const childT = childOffset / childLength;
        return child.getPointAt(childT);
      }
      currentLength += childLength;
    }
    
    // 最後の子パスの終点を返す
    const lastChild = this.getLastChild();
    return lastChild ? lastChild.getPointAt(1) : new Point(0, 0);
  }

  getTangentAt(t: number): Point {
    // 全長に対する位置を計算
    const length = this.getLength();
    if (length === 0) {
      return new Point(0, 0);
    }
    
    const offset = t * length;
    let currentLength = 0;
    const children = this._children;
    
    for (let i = 0, l = children.length; i < l; i++) {
      const child = children[i];
      const childLength = child.getLength();
      if (currentLength + childLength > offset) {
        // この子パス内の位置を計算
        const childOffset = offset - currentLength;
        const childT = childOffset / childLength;
        return child.getTangentAt(childT);
      }
      currentLength += childLength;
    }
    
    // 最後の子パスの終点の接線を返す
    const lastChild = this.getLastChild();
    return lastChild ? lastChild.getTangentAt(1) : new Point(0, 0);
  }

  contains(point: Point): boolean {
    if (this._children.length === 0) {
      return false;
    }
    
    // 子パスを面積でソート（大きい順）
    const children = [...this._children].sort((a, b) =>
      Math.abs(b.getArea()) - Math.abs(a.getArea())
    );
    
    // paper.jsの実装に合わせて、外側から内側へ順に判定
    // 奇数番目のパスに含まれる場合は内部、偶数番目のパスに含まれる場合は外部
    let winding = 0;
    for (let i = 0; i < children.length; i++) {
      if (children[i].contains(point)) {
        winding += children[i].isClockwise() ? -1 : 1;
      }
    }
    
    // 巻き数が0でなければ内部
    return winding !== 0;
  }

  getIntersections(
    targetPath: PathItem,
    include: (loc: CurveLocation) => boolean,
    _targetMatrix: Matrix | null,
    _returnFirst: boolean
  ): CurveLocation[] {
    const children = this._children;
    let intersections: CurveLocation[] = [];

    // 自己交差の場合（this === targetPath）
    if (this === targetPath) {
      // 各子パスの自己交差＋子パス同士の交点
      for (let i = 0, l = children.length; i < l; i++) {
        // 子パスの自己交差
        const selfIntersections = children[i].getIntersections(
          children[i], include, null, _returnFirst
        );
        intersections = intersections.concat(selfIntersections);

        // 他の子パスとの交点
        for (let j = i + 1; j < l; j++) {
          const pathIntersections = children[i].getIntersections(
            children[j], include, null, _returnFirst
          );
          intersections = intersections.concat(pathIntersections);
        }

        // 最初の交点だけを返す場合は早期リターン
        if (_returnFirst && intersections.length > 0) {
          return intersections;
        }
      }
      return intersections;
    } else {
      // 他のパスとの交点
      for (let i = 0, l = children.length; i < l; i++) {
        const childIntersections = children[i].getIntersections(
          targetPath, include, _targetMatrix, _returnFirst
        );
        intersections = intersections.concat(childIntersections);

        // 最初の交点だけを返す場合は早期リターン
        if (_returnFirst && intersections.length > 0) {
          break;
        }
      }
      return intersections;
    }
  }

  reorient(nonZero?: boolean, clockwise?: boolean): CompoundPath {
    const children = this._children;
    if (children.length) {
      // 子パスを取り出し、reorientPathsで処理する
      const originalChildren = children.slice();
      const processed = reorientPaths(
        this.removeChildren(0) as Path[],
        (w) => {
          // 偶奇ルールと非ゼロルールの処理
          return !!(nonZero ? w : w & 1);
        },
        clockwise
      );
      
      // nullでないパスだけをフィルタリング
      const validPaths = processed.filter(path => path !== null) as Path[];
      
      // デバッグ: addChildren前の各子パスのセグメント順
      for (let i = 0; i < validPaths.length; i++) {
        // eslint-disable-next-line no-console
      }

      if (validPaths.length === 0) {
        // すべて除外された場合は元の子パスを復元
        this.addChildren(originalChildren);
      } else {
        // パスを面積の絶対値でソート（大きい順）
        validPaths.sort((a, b) => Math.abs(b.getArea()) - Math.abs(a.getArea()));
        // ソートされたパスを追加
        this.addChildren(validPaths);
      }

      // デバッグ: addChildren後の各子パスのセグメント順
      for (let i = 0; i < this._children.length; i++) {
        // eslint-disable-next-line no-console
      }
    } else if (clockwise !== undefined) {
      this.setClockwise(clockwise);
    }
    return this;
  }

  private getCurrentPath(check: boolean) {
    const children = this._children;
    if (check && !children.length) {
        throw new Error('Use a moveTo() command first');
    }
    return children[children.length - 1];
  }

  moveTo(point: Point): CompoundPath {
    // paper.jsと同様に、現在のパスが空かどうかをチェックして再利用
    const current = this.getCurrentPath(false);
    const path = current && current.isEmpty() ? current : new Path();
    if (path !== current) {
      this.addChild(path);
    }
    path.moveTo(point);
    return this;
  }
  
  moveBy(point: Point): CompoundPath {
    const current = this.getCurrentPath(false);
    const last = current?.getLastSegment();
    this.moveTo(last ? last.getPoint().add(point) : point);
    return this;
  }

  closePath(tolerance: number): CompoundPath {
    this.getCurrentPath(true).closePath(tolerance);
    return this;
  }

  lineTo(point: Point): CompoundPath {
    const path = this.getCurrentPath(true);
    path.lineTo(point);
    return this;
  }

  cubicCurveTo(handle1: Point, handle2: Point, to: Point): CompoundPath {
    const path = this.getCurrentPath(true);
    path.cubicCurveTo(handle1, handle2, to);
    return this;
  }

  quadraticCurveTo(handle: Point, to: Point): CompoundPath {
    const path = this.getCurrentPath(true);
    path.quadraticCurveTo(handle, to);
    return this;
  }

  curveTo(handle: Point, to: Point, t: number): CompoundPath {
    const path = this.getCurrentPath(true);
    path.curveTo(handle, to, t);
    return this;
  }

  arcTo(handle: Point, to: Point): CompoundPath {
    const path = this.getCurrentPath(true);
    path.arcTo(handle, to);
    return this;
  }

  lineBy(point: Point): CompoundPath {
    const path = this.getCurrentPath(true);
    path.lineBy(point);
    return this;
  }

  cubicCurveBy(handle1: Point, handle2: Point, to: Point): CompoundPath {
    const path = this.getCurrentPath(true);
    path.cubicCurveBy(handle1, handle2, to);
    return this;
  }

  quadraticCurveBy(handle: Point, to: Point): CompoundPath {
    const path = this.getCurrentPath(true);
    path.quadraticCurveBy(handle, to);
    return this;
  }

  curveBy(handle: Point, to: Point, t: number): CompoundPath {
    const path = this.getCurrentPath(true);
    path.curveBy(handle, to, t);
    return this;
  }

  arcBy(handle: Point, to: Point): CompoundPath {
    const path = this.getCurrentPath(true);
    path.arcBy(handle, to);
    return this;
  }

  reverse(): PathItem {
    const children = this._children;
    for (let i = 0, l = children.length; i < l; i++) {
      children[i].reverse();
    }
    return this;
  }

  flatten(flatness: number = 0.25): CompoundPath {
    const children = this._children;
    for (let i = 0, l = children.length; i < l; i++) {
      children[i].flatten(flatness);
    }
    return this;
  }

  simplify(tolerance: number = 2.5): CompoundPath {
    const children = this._children;
    for (let i = 0, l = children.length; i < l; i++) {
      children[i].simplify(tolerance);
    }
    return this;
  }

  smooth(options?: {
    type?: 'asymmetric' | 'continuous';
    from?: number | Segment;
    to?: number | Segment;
  }): CompoundPath {
    const children = this._children;
    for (let i = 0, l = children.length; i < l; i++) {
      children[i].smooth(options);
    }
    return this;
  }

  isClockwise(): boolean {
    return this._children.length > 0 ? this._children[0].isClockwise() : true;
  }

  reduce(options?: { simplify?: boolean }): PathItem {
    const children = this._children;
    // nullの要素をフィルタリング
    const validChildren = children.filter(child => child !== null);

    // 有効な子パスがない場合は空のパスを返す
    if (validChildren.length === 0) {
      const path = new Path();
      path.copyAttributes(this);
      path.insertAbove(this);
      this._remove(true, true);
      return path;
    }

    // 有効な子パスを処理
    for (let i = validChildren.length - 1; i >= 0; i--) {
      const path = validChildren[i].reduce(options) as Path;
      if (path && path.isEmpty()) {
        path._remove(true, true);
      }
    }

    // 処理後に残った子パスを再度フィルタリング
    const remainingChildren = this._children.filter(child => child !== null);

    if (remainingChildren.length === 0) {
      const path = new Path();
      path.copyAttributes(this);
      path.insertAbove(this);
      this._remove(true, true);
      return path;
    }

    // paper.jsと同じ: 子パスが1つならそれを返す、複数ならCompoundPathのまま返す
    if (remainingChildren.length === 1) {
      const child = remainingChildren[0];
      child.insertAbove(this);
      this._remove(true, true);
      return child;
    }
    if (remainingChildren.length !== children.length) {
      this._children = remainingChildren;
    }
    return this;
  }

  getPaths(): Path[] {
    return this._children;
  }

  clone(deep: boolean = false): PathItem {
    const copy = new CompoundPath();
    
    // 子パスをクローン
    for (const child of this._children) {
      copy.addChild(deep ? child.clone(true) as Path : child.clone(false) as Path);
    }
    
    // 属性をコピー
    copy.copyAttributes(this);
    
    return copy;
  }

  resolveCrossings(): PathItem {
    return resolveCrossings(this);
  }

  getPathData(): string {
    return this._children
      .map(child => (typeof child.getPathData === 'function' ? child.getPathData() : ''))
      .filter(str => str && str.length > 0)
      .join('');
  }

  toString(): string {
    return this.getPathData();
  }
}