/**
 * CompoundPath クラス
 * Paper.js の CompoundPath (src/path/CompoundPath.js) を参考にした実装。
 * 複数のパスから構成される複合パスを表現し、PathItem インターフェースを実装する。
 */

import { Point } from '../basic/Point';
import { Rectangle } from '../basic/Rectangle';
import { Matrix } from '../basic/Matrix';
import { Curve } from './Curve';
import { Path } from './Path';
import { Segment } from './Segment';
import { PathItem } from './PathItem';
import { CurveLocation } from './CurveLocation';
import { ChangeFlag } from './ChangeFlag';

export class CompoundPath implements PathItem {
  // PathItemインターフェースの実装
  _matrix?: Matrix;
  _matrixDirty: boolean = false;
  _bounds?: Rectangle;
  _version: number = 0;

  // 子パスの配列
  _children: Path[] = [];
  
  /**
   * CompoundPathコンストラクタ
   * @param paths 子パスの配列または引数
   */
  constructor(paths?: Path[] | any) {
    this._children = [];
    
    if (paths) {
      if (Array.isArray(paths)) {
        this.addChildren(paths);
      } else if (typeof paths === 'string') {
        // SVGパスデータからの作成はサポート外
        console.warn('SVG path data is not supported in Papyrus2D');
      } else if (paths.children) {
        this.addChildren(paths.children);
      } else {
        // 引数が配列でない場合は引数リストとして扱う
        this.addChildren(Array.prototype.slice.call(arguments));
      }
    }
  }

  /**
   * 子パスを追加
   * @param paths 追加するパスの配列
   */
  addChildren(paths: Path[]): void {
    for (let i = 0; i < paths.length; i++) {
      this.addChild(paths[i]);
    }
  }

  /**
   * 子パスを追加
   * @param path 追加するパス
   */
  addChild(path: Path): void {
    this._children.push(path);
  }

  /**
   * 子パスを削除
   * @returns 削除された子パスの配列
   */
  removeChildren(): Path[] {
    const children = this._children;
    this._children = [];
    return children;
  }

  /**
   * 最初の子パスを取得
   */
  getFirstChild(): Path | null {
    return this._children.length > 0 ? this._children[0] : null;
  }

  /**
   * 最後の子パスを取得
   */
  getLastChild(): Path | null {
    return this._children.length > 0 ? this._children[this._children.length - 1] : null;
  }

  /**
   * パスが閉じているかどうかを取得
   * すべての子パスが閉じている場合にtrueを返す
   */
  isClosed(): boolean {
    const children = this._children;
    for (let i = 0, l = children.length; i < l; i++) {
      if (!children[i].isClosed()) {
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
   * すべての曲線を取得
   */
  getCurves(): Curve[] {
    const children = this._children;
    const curves: Curve[] = [];
    for (let i = 0, l = children.length; i < l; i++) {
      const childCurves = children[i].getCurves();
      for (let j = 0, m = childCurves.length; j < m; j++) {
        curves.push(childCurves[j]);
      }
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
   * パスの境界ボックスを取得
   * @param matrix 変換行列（オプション）
   */
  getBounds(matrix?: Matrix | null): Rectangle {
    if (!this._children.length) {
      return new Rectangle(0, 0, 0, 0);
    }
    
    let bounds = this._children[0].getBounds(matrix);
    for (let i = 1, l = this._children.length; i < l; i++) {
      bounds = bounds.unite(this._children[i].getBounds(matrix));
    }
    return bounds;
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
    // paper.jsの実装に近い方法で判定
    // 最も外側のパスに含まれ、内側のパスに含まれない場合に内部と判定
    
    if (this._children.length === 0) {
      return false;
    }
    
    // 子パスを面積でソート（大きい順）
    const sortedChildren = [...this._children].sort((a, b) => b.getArea() - a.getArea());
    
    // 最も外側のパス（面積最大）に含まれるかチェック
    if (!sortedChildren[0].contains(point)) {
      return false;
    }
    
    // 内側のパス（穴）に含まれるかチェック
    for (let i = 1; i < sortedChildren.length; i++) {
      if (sortedChildren[i].contains(point)) {
        return false; // 穴の中にある場合は外部
      }
    }
    
    return true; // 外側のパスに含まれ、どの穴にも含まれない
  }

  /**
   * 他のパスとの交点を取得
   * @param other 交点を求める相手のパス
   */
  getIntersections(other: Path): CurveLocation[] {
    const children = this._children;
    let intersections: CurveLocation[] = [];
    
    for (let i = 0, l = children.length; i < l; i++) {
      const childIntersections = children[i].getIntersections(other);
      intersections = intersections.concat(childIntersections);
    }
    
    return intersections;
  }

  /**
   * パスの方向を再設定
   * 最も外側のパスは時計回り、内側のパスは反時計回りに設定
   */
  reorient(): CompoundPath {
    const children = this._children;
    if (children.length === 0) {
      return this;
    }
    
    // 面積でソート（大きい順）
    children.sort((a, b) => b.getArea() - a.getArea());
    
    // 最も外側のパスは時計回りに
    const outermostChild = children[0];
    if (!outermostChild.isClosed()) {
      outermostChild.setClosed(true);
    }
    
    // 内側のパスは反時計回りに
    for (let i = 1, l = children.length; i < l; i++) {
      const child = children[i];
      if (!child.isClosed()) {
        child.setClosed(true);
      }
      // 外側と内側で方向を逆にする
      if (child.isClosed() === outermostChild.isClosed()) {
        child.setClosed(!child.isClosed());
        child.setClosed(!child.isClosed());
      }
    }
    
    return this;
  }

  /**
   * パスの移動
   * @param point 移動先の点
   */
  moveTo(point: Point): CompoundPath {
    // 新しいパスを作成
    const path = new Path();
    path.moveTo(point);
    this.addChild(path);
    return this;
  }

  /**
   * 直線セグメントを追加
   * @param point 線の終点
   */
  lineTo(point: Point): CompoundPath {
    // 最後の子パスがない場合は新しいパスを作成
    let current = this.getLastChild();
    if (!current || current.segmentCount === 0) {
      current = new Path();
      this.addChild(current);
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
    // 最後の子パスがない場合は新しいパスを作成
    let current = this.getLastChild();
    if (!current) {
      current = new Path();
      this.addChild(current);
    }
    current.cubicCurveTo(handle1, handle2, to);
    return this;
  }

  /**
   * パスを閉じる
   */
  closePath(): CompoundPath {
    // 最後の子パスを閉じる
    const current = this.getLastChild();
    if (current) {
      current.close();
    }
    return this;
  }

  /**
   * パスの反転
   */
  // Pathクラスにreverseメソッドが実装されていないため、
  // この機能は現在サポートされていません
  // reverse(): CompoundPath {
  //   const children = this._children;
  //   for (let i = 0, l = children.length; i < l; i++) {
  //     children[i].reverse();
  //   }
  //   return this;
  // }

  /**
   * パスの平滑化
   */
  smooth(): CompoundPath {
    const children = this._children;
    for (let i = 0, l = children.length; i < l; i++) {
      children[i].smooth();
    }
    return this;
  }
}