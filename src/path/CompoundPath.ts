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
  // 追加のプロパティ
  _name?: string;
  // _dataは未使用のため削除

  // 子パスの配列
  _children: Path[] = [];
  
  /**
   * CompoundPathコンストラクタ
   * @param paths 子パスの配列または引数
   */
  constructor(paths?: Path[]) {
    super();
    this._children = [];
    if (paths && Array.isArray(paths)) {
      this.addChildren(paths);
    }
  }

  getChildren(): PathItemBase[] | null {
    return this._children;    
  }


  /**
   * パスが閉じているかどうかを取得
   * すべての子パスが閉じている場合にtrueを返す
   */
  isClosed(): boolean {
    const children = this._children;
    for (let i = 0, l = children.length; i < l; i++) {
      if (!children[i]._closed) {
        return false;
      }
    }
    return true;
  }

  /**
   * パスを閉じるかどうかを設定
   * すべての子パスに適用される
   */
  setClosed(closed: boolean): void {
    const children = this._children;
    for (let i = 0, l = children.length; i < l; i++) {
      children[i].setClosed(closed);
    }
    this._changed(Change.GEOMETRY);
  }

  /**
   * PathItemインターフェースの実装のためのgetter
   */
  get closed(): boolean {
    return this.isClosed();
  }

  /**
   * パスの全セグメント数
   */
  get segmentCount(): number {
    let count = 0;
    const children = this._children;
    for (let i = 0, l = children.length; i < l; i++) {
      count += children[i].segmentCount;
    }
    return count;
  }

  /**
   * 最初のセグメントを取得
   */
  getFirstSegment(): Segment | undefined {
    const first = this.getFirstChild();
    return first ? first.getFirstSegment() : undefined;
  }

  /**
   * 最後のセグメントを取得
   */
  getLastSegment(): Segment | undefined {
    const last = this.getLastChild();
    return last ? last.getLastSegment() : undefined;
  }

  /**
   * すべてのセグメントを取得
   */
  getSegments(): Segment[] {
    const children = this._children;
    const segments: Segment[] = [];
    for (let i = 0, l = children.length; i < l; i++) {
      const childSegments = children[i].getSegments();
      segments.push(...childSegments);
    }
    return segments;
  }

  /**
   * すべての曲線を取得
   */
  getCurves(): Curve[] {
    const children = this._children;
    const curves: Curve[] = [];
    for (let i = 0, l = children.length; i < l; i++) {
      const childCurves = children[i].getCurves();
      curves.push(...childCurves);
    }
    return curves;
  }

  /**
   * 最初の曲線を取得
   */
  getFirstCurve(): Curve | undefined {
    const first = this.getFirstChild();
    return first ? first.getFirstCurve() : undefined;
  }

  /**
   * 最後の曲線を取得
   */
  getLastCurve(): Curve | undefined {
    const last = this.getLastChild();
    return last ? last.getLastCurve() : undefined;
  }

  /**
   * パスの面積を取得
   * すべての子パスの面積の合計
   */
  getArea(): number {
    const children = this._children;
    let area = 0;
    for (let i = 0, l = children.length; i < l; i++) {
      area += children[i].getArea();
    }
    return area;
  }

  /**
   * パスの長さを取得
   * すべての子パスの長さの合計
   */
  getLength(): number {
    const children = this._children;
    let length = 0;
    for (let i = 0, l = children.length; i < l; i++) {
      length += children[i].getLength();
    }
    return length;
  }

  /**
   * 指定されたパラメータ位置のパス上の点を取得
   * @param t パラメータ位置（0〜1）
   */
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

  /**
   * 指定されたパラメータ位置のパス上の接線ベクトルを取得
   * @param t パラメータ位置（0〜1）
   */
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

  /**
   * 点がパス内部にあるかどうかを判定
   * @param point 判定する点
   */
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

  /**
   * 他のパスとの交点を取得
   * @param other 交点を求める相手のパス
   */
  /**
   * 他のパスとの交点を取得
   * paper.jsのPathItem.getIntersectionsメソッドに相当
   * @param path 交点を求める相手のパス（未指定の場合は自己交差を検出）
   * @param include 交点をフィルタリングするコールバック関数
   * @param _matrix 内部使用: 相手パスの変換行列をオーバーライド
   * @param _returnFirst 内部使用: 最初の交点だけを返すフラグ
   * @returns 交点情報の配列
   */
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

  /**
   * パスの方向を再設定
   * 最も外側のパスは時計回り、内側のパスは反時計回りに設定
   * @param nonZero 非ゼロ塗りつぶしルールを適用するかどうか
   * @param clockwise 指定された場合、ルートパスの向きを設定
   */
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

  /**
   * パスの移動
   * @param point 移動先の点
   */
  moveTo(point: Point): CompoundPath {
    // paper.jsと同様に、現在のパスが空かどうかをチェックして再利用
    const current = this.getLastChild();
    const path = current && current.isEmpty(false) ? current : new Path();
    if (path !== current) {
      this.addChild(path);
    }
    path.moveTo(point);
    return this;
  }
  
  moveBy(point: Point): CompoundPath {
    const current = this.getLastChild();
    if (!current) {
      throw new Error('Use a moveTo() command first');
    }
    const last = current.getLastSegment();
    this.moveTo(last ? point.add(last.getPoint()) : point);
    return this;
  }

  /**
   * 直線セグメントを追加
   * @param point 線の終点
   */
  lineTo(point: Point): CompoundPath {
    // 最後の子パスがない場合は新しいパスを作成
    let current = this.getLastChild();
    if (!current) {
      throw new Error('Use a moveTo() command first');
    }
    current.lineTo(point);
    return this;
  }

  /**
   * 3次ベジェ曲線セグメントを追加
   * @param handle1 制御点1
   * @param handle2 制御点2
   * @param to 終点
   */
  cubicCurveTo(handle1: Point, handle2: Point, to: Point): CompoundPath {
    // 最後の子パスがない場合はエラー
    let current = this.getLastChild();
    if (!current) {
      throw new Error('Use a moveTo() command first');
    }
    current.cubicCurveTo(handle1, handle2, to);
    return this;
  }

  /**
   * パスを閉じる
   */
  closePath(tolerance?: number): CompoundPath {
    // 最後の子パスを閉じる
    const current = this.getLastChild();
    if (!current) {
      throw new Error('Use a moveTo() command first');
    }
    current.close();
    return this;
  }

  /**
   * パスの反転
   * 各子パスを反転させる
   */
  reverse(): PathItemBase {
    const children = this._children;
    for (let i = 0, l = children.length; i < l; i++) {
      children[i].reverse();
    }
    return this;
  }

  // setClockwiseメソッドは基底クラスから継承

  /**
   * パスが時計回りかどうかを判定
   * 最初の子パスの方向を返す
   * @returns 時計回りならtrue
   */
  isClockwise(): boolean {
    return this._children.length > 0 ? this._children[0].isClockwise() : true;
  }

  /**
   * パスの平滑化
   */
  smooth(param?: { type?: "asymmetric" | "continuous"; from?: number | Segment; to?: number | Segment }): CompoundPath {
    const children = this._children;
    let res;
    for (let i = 0, l = children.length; i < l; i++) {
      res = children[i].smooth(param) || res;
    }
    return res ? this : this;
  }

  /**
   * パスを平坦化（フラット化）します。
   * 各子パスを平坦化します。
   * @param flatness 許容される最大誤差（デフォルト: 0.25）
   * @returns このパスオブジェクト（メソッドチェーン用）
   */
  flatten(flatness?: number): CompoundPath {
    const children = this._children;
    let res;
    for (let i = 0, l = children.length; i < l; i++) {
      res = children[i].flatten(flatness) || res;
    }
    return res ? this : this;
  }

  /**
   * パスを単純化します。
   * 各子パスを単純化します。
   * @param tolerance 許容誤差（デフォルト: 2.5）
   * @returns 単純化が成功した場合はtrue、失敗した場合はfalse
   */
  simplify(tolerance?: number): CompoundPath {
    let res;
    const children = this._children;
    for (let i = 0, l = children.length; i < l; i++) {
      res = children[i].simplify(tolerance) || res;
    }
    return res ? this : this;
  }

  /**
   * CompoundPathを簡略化する
   * paper.jsのCompoundPath.reduce()完全準拠
   */
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

  /**
   * パスの配列を取得する
   * CompoundPathの場合は子パスの配列を返す
   * paper.jsのgetPaths関数を移植
   * @returns パスの配列
   */
  getPaths(): Path[] {
    return this._children;
  }

  /**
   * パスのクローンを作成する
   * paper.jsのItem.clone()を移植
   * @param deep 深いクローンを作成するかどうか
   * @returns クローンされたパス
   */
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
  /**
   * 交差を解決する
   * paper.jsのPathItem.resolveCrossings()を移植
   * @returns 交差が解決されたパス
   */
  resolveCrossings(): PathItem {
    return resolveCrossings(this);
  }

  /**
   * SVGパスデータ（paper.jsのgetPathData相当）を返す
   * 各子パスのgetPathData()を連結
   */
  getPathData(): string {
    return this._children
      .map(child => (typeof child.getPathData === 'function' ? child.getPathData() : ''))
      .filter(str => str && str.length > 0)
      .join('');
  }
/**
   * toString() でSVGパスデータを返す（paper.js互換）
   */
  toString(): string {
    return this.getPathData();
  }
}