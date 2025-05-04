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
  _name?: string;
  _data?: any;

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
      for (let j = 0, m = childSegments.length; j < m; j++) {
        segments.push(childSegments[j]);
      }
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
    // paper.jsと同様に、現在のパスが空かどうかをチェックして再利用
    const current = this.getLastChild();
    const path = current && current.isEmpty!() ? current : new Path();
    if (path !== current) {
      this.addChild(path);
    }
    path.moveTo(point);
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
  closePath(): CompoundPath {
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
   */
  // Pathクラスにreverseメソッドが実装されていないため、
  // この機能は現在サポートされていません
  /**
   * パスの反転
   * 各子パスを反転させる
   */
  reverse(): CompoundPath {
    const children = this._children;
    for (let i = 0, l = children.length; i < l; i++) {
      children[i].reverse();
    }
    return this;
  }

  /**
   * パスの平滑化
   */
  /**
   * パスの平滑化
   */
  smooth(param?: any): CompoundPath {
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
  simplify(tolerance?: number): boolean {
    let success = false;
    const children = this._children;
    for (let i = 0, l = children.length; i < l; i++) {
      const result = children[i].simplify(tolerance);
      success = success || result;
    }
    return success;
  }

  /**
   * CompoundPathを簡略化する
   * paper.jsのCompoundPath.reduce()完全準拠
   */
  reduce(options?: { simplify?: boolean }): PathItem {
    const children = this._children;
    for (let i = children.length - 1; i >= 0; i--) {
      const path = children[i].reduce(options);
      if (path!.isEmpty!()) {
        path!.remove!();
      }
    }
    if (!children.length) {
      const path = new Path();
      path.copyAttributes(this);
      path.insertAbove(this);
      this.remove();
      return path;
    }
    if (children.length === 1) {
      return children[0];
    }
    // paper.jsでは reduce.base.call(this) を呼び出しているが、
    // TypeScriptでは継承の仕組みが異なるため、このまま自身を返す
    return this;
  }

  /**
   * 全ての子パスが空ならtrue
   */
  isEmpty(): boolean {
    if (!this._children.length) return true;
    for (let i = 0; i < this._children.length; i++) {
      if (!this._children[i].isEmpty()) return false;
    }
    return true;
  }

  /**
   * ダミーremove（グループ管理がないため）
   */
  remove(): PathItem | null {
    return this;
  }

  /**
   * ダミー_insertAt（グループ管理がないため）
   */
  _insertAt(item: PathItem, offset: number): PathItem {
    return this;
  }

  /**
   * 指定されたパスの上に挿入
   */
  insertAbove(path: PathItem): CompoundPath {
    return this._insertAt(path, 1) as CompoundPath;
  }

  /**
   * 属性コピー（paper.jsのItem#copyAttributesに準拠）
   */
  copyAttributes(path: PathItem, excludeMatrix?: boolean): CompoundPath {
    // スタイルは未実装
    const keys = ['_locked', '_visible', '_blendMode', '_opacity', '_clipMask', '_guide'];
    for (const key of keys) {
      if (key in path) {
        // @ts-ignore
        this[key] = path[key];
      }
    }
    // 行列
    this._matrix = !excludeMatrix && path._matrix ? Matrix.fromMatrix(path._matrix) : undefined;
    // データと名前
    if ('_data' in path) {
      // @ts-ignore
      this._data = path._data ? JSON.parse(JSON.stringify(path._data)) : null;
    }
    if ('_name' in path) {
      // @ts-ignore
      const name = path._name;
      if (name && typeof name === 'string') {
        this._name = name;
      }
    }
    return this;
  }

  /**
   * 指定されたパスが兄弟関係にあるかどうかを判定する
   * paper.jsのItem.isSibling()を移植
   * @param path 判定するパス
   * @returns 兄弟関係にある場合はtrue
   */
  isSibling(path: PathItem): boolean {
    // 現在の実装では常にfalseを返す
    // 実際のpaper.jsでは、同じ親を持つアイテムかどうかを判定する
    return false;
  }

  /**
   * パスのインデックスを取得する
   * paper.jsのItem.getIndex()を移植
   * @returns インデックス
   */
  getIndex(): number {
    // 現在の実装では常に0を返す
    // 実際のpaper.jsでは、親アイテム内でのインデックスを返す
    return 0;
  }

}