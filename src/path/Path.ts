/**
 * Path クラス
 * Paper.js の Path (src/path/Path.js) を参考にしたミュータブルなパス表現。
 * segments 配列と closed フラグを持ち、PathItem インターフェースを実装する。
 */

import { Point } from '../basic/Point';
import { Rectangle } from '../basic/Rectangle';
import { Matrix } from '../basic/Matrix';
import { Curve } from './Curve';
import { CurveLocation } from './CurveLocation';
import { Segment } from './Segment';
import { Numerical } from '../util/Numerical';
import { PathItem } from './PathItem';
import { ChangeFlag } from './ChangeFlag';
import { computeBounds, isOnPath, getWinding, getIntersections, contains } from './PathGeometry';

// PathConstructorsからメソッドをインポート
import { PathConstructors } from './PathConstructors';

export class Path implements PathItem {
  // 静的メソッド
  static Line = PathConstructors.Line;
  static Circle = PathConstructors.Circle;
  static Rectangle = PathConstructors.Rectangle;
  static Ellipse = PathConstructors.Ellipse;
  static Arc = PathConstructors.Arc;
  static RegularPolygon = PathConstructors.RegularPolygon;
  static Star = PathConstructors.Star;
  _segments: Segment[];
  _closed: boolean;

  // PathItemインターフェースの実装
  _matrix?: Matrix;
  _matrixDirty: boolean = false;
  _curves?: Curve[];
  _version: number = 0;
  _length?: number;
  _area?: number;
  _bounds?: Rectangle;

  constructor(segments: Segment[] = [], closed: boolean = false) {
    this._segments = [];
    this._closed = false;
    this._curves = undefined;
    
    // セグメントがある場合は追加
    if (segments.length > 0) {
      this.setSegments(segments);
    }
    
    // 閉じたパスの場合は設定
    if (closed) {
      this._closed = closed;
    }
  }

  /**
   * セグメントの数を取得
   */
  get segmentCount(): number {
    return this._segments.length;
  }

  /**
   * セグメント配列を取得
   */
  getSegments(): Segment[] {
    return this._segments;
  }

  /**
   * セグメント配列を設定
   * @param segments 新しいセグメント配列
   */
  setSegments(segments: Segment[]): void {
    this._segments.length = 0;
    this._curves = undefined;
    
    if (segments && segments.length) {
      this._add(segments);
    }
  }

  /**
   * 複数のセグメントを追加
   * @param segments 追加するセグメント配列
   */
  /**
   * セグメントを追加する内部メソッド
   * @param segs 追加するセグメント配列
   * @param index 挿入位置（省略時は末尾に追加）
   */
  _add(segs: Segment[], index?: number): Segment[] {
    const segments = this._segments;
    const curves = this._curves;
    const amount = segs.length;
    const append = index === undefined;
    index = append ? segments.length : index!;

    // セグメントの設定
    for (let i = 0; i < amount; i++) {
      const segment = segs[i];
      // 他のパスに属している場合はクローン
      if (segment._path) {
        segs[i] = segment.clone();
      }
      segs[i]._path = this;
      segs[i]._index = index + i;
    }

    // セグメントの挿入
    if (append) {
      segments.push(...segs);
    } else {
      segments.splice(index, 0, ...segs);
      // インデックスの更新
      for (let i = index + amount, l = segments.length; i < l; i++) {
        segments[i]._index = i;
      }
    }

    // カーブの更新
    if (curves) {
      const total = this._countCurves();
      const start = index > 0 && index + amount - 1 === total ? index - 1 : index;
      let insert = start;
      const end = Math.min(start + amount, total);

      // 新しいカーブの挿入
      for (let i = insert; i < end; i++) {
        // paper.jsと同様に、カーブを作成する際にセグメントを指定せず、後で_adjustCurvesで設定する
        curves.splice(i, 0, new Curve(null as any, null as any));
      }
      
      // カーブのセグメントを調整
      this._adjustCurves(start, end);
    }

    this._changed(ChangeFlag.SEGMENTS);
    return segs;
  }

  /**
   * カーブのセグメントを調整する内部メソッド
   */
  _adjustCurves(start: number, end: number): void {
    const segments = this._segments;
    const curves = this._curves;
    
    if (!curves) return;

    for (let i = start; i < end; i++) {
      const curve = curves[i];
      curve._path = this;
      curve._segment1 = segments[i];
      curve._segment2 = segments[i + 1] || segments[0];
      curve._changed();
    }

    // 最初のセグメントの場合、閉じたパスの最後のセグメントも修正
    if (start > 0 && (!start || this._closed)) {
      const curve = curves[this._closed && !start ? segments.length - 1 : start - 1];
      if (curve) {
        curve._segment2 = segments[start] || segments[0];
        curve._changed();
      }
    }

    // 修正範囲の後のセグメントがある場合も修正
    if (end < curves.length) {
      const curve = curves[end];
      if (curve) {
        curve._segment1 = segments[end];
        curve._changed();
      }
    }
  }


  /**
   * 複数のセグメントを追加
   * @param segments 追加するセグメント配列
   */
  addSegments(segments: Segment[]): Segment[] {
    return this._add(segments);
  }

  /**
   * 最初のセグメントを取得
   */
  getFirstSegment(): Segment | undefined {
    return this._segments[0];
  }

  /**
   * 最後のセグメントを取得
   */
  getLastSegment(): Segment | undefined {
    return this._segments[this._segments.length - 1];
  }

  /**
   * パスが閉じているかどうかを取得
   */
  isClosed(): boolean {
    return this._closed;
  }

  /**
   * パスを閉じるかどうかを設定
   */
  setClosed(closed: boolean): void {
    if (this._closed != (closed = !!closed)) {
      this._closed = closed;
      // カーブの更新
      if (this._curves) {
        const length = this._curves.length = this._countCurves();
        if (closed) {
          this._curves[length - 1] = new Curve(
            this._segments[length - 1],
            this._segments[0]
          );
        }
      }
      this._changed(ChangeFlag.SEGMENTS);
    }
  }
  
  /**
   * PathItemインターフェースの実装のためのgetter
   */
  get closed(): boolean {
    return this._closed;
  }

  getLength(): number {
    if (this._length == null) {
      const curves = this.getCurves();
      let length = 0;
      for (let i = 0, l = curves.length; i < l; i++) {
        length += curves[i].getLength();
      }
      this._length = length;
    }
    return this._length!;
  }

  /**
   * パスの面積を計算します。自己交差するパスの場合、
   * 互いに打ち消し合うサブエリアが含まれる場合があります。
   *
   * @return {number} パスの面積
   */
  getArea(): number {
    if (this._area == null) {
      const segments = this._segments;
      const closed = this._closed;
      let area = 0;
      
      for (let i = 0, l = segments.length; i < l; i++) {
        const last = i + 1 === l;
        
        // Paper.jsと完全に同じ処理
        area += Curve.getArea(Curve.getValues(
          segments[i],
          segments[last ? 0 : i + 1],
          null,
          last && !closed
        ));
      }
      
      this._area = Math.abs(area); // Paper.jsでは絶対値を取る
    }
    
    return this._area!;
  }

  /**
   * 変更通知メソッド
   * @param flags 変更フラグ
   */
  _changed(flags: number): void {
    if (flags & ChangeFlag.GEOMETRY) {
      this._length = this._area = undefined;
      if (flags & ChangeFlag.SEGMENTS) {
        this._version++; // CurveLocationのキャッシュ更新用
      } else if (this._curves) {
        // セグメントの変更でない場合は、すべての曲線に変更を通知
        for (let i = 0, l = this._curves.length; i < l; i++) {
          this._curves[i]._changed();
        }
      }
    } else if (flags & ChangeFlag.STROKE) {
      // ストロークの変更時は境界ボックスのキャッシュをクリア
      this._bounds = undefined;
    }
  }

  /**
   * パスの境界ボックスを取得
   * @param matrix 変換行列（オプション）
   * @returns 境界ボックス
   */
  getBounds(matrix?: Matrix | null): Rectangle {
    // paper.jsのCurve._addBoundsロジックを移植
    let bounds = this._computeBounds(0);
    
    // 行列変換がある場合は適用
    if (matrix) {
      bounds = bounds.transform(matrix);
    }
    
    return bounds;
  }

  /**
   * ストローク境界計算
   * @param strokeWidth 線幅
   * @param matrix 変換行列（オプション）
   */
  getStrokeBounds(strokeWidth: number, matrix?: Matrix | null): Rectangle {
    // strokeWidth/2をpaddingとしてAABB拡張
    let bounds = this._computeBounds(strokeWidth / 2);
    
    // 行列変換がある場合は適用
    if (matrix) {
      bounds = bounds.transform(matrix);
    }
    
    return bounds;
  }

  /**
   * 内部: paddingを加味したAABB計算
   */
  private _computeBounds(padding: number): Rectangle {
    return computeBounds(this._segments, this._closed, padding);
  }

  /**
   * 指定されたパラメータ位置のパス上の点を取得
   * @param t パラメータ位置（0〜1）
   * @returns パス上の点
   */
  getPointAt(t: number): Point {
    const loc = this.getLocationAt(t);
    return loc ? loc.point : new Point(0, 0);
  }

  /**
   * 指定された点がパス上にある場合、その位置情報を取得
   * @param point パス上の点
   * @returns 曲線位置情報
   */
  getLocationOf(point: Point): CurveLocation | null {
    const curves = this.getCurves();
    for (let i = 0, l = curves.length; i < l; i++) {
      const loc = curves[i].getLocationOf(point);
      if (loc) {
        return loc;
      }
    }
    return null;
  }

  /**
   * 指定された点までのパスの長さを取得
   * @param point パス上の点
   * @returns パスの長さ
   */
  getOffsetOf(point: Point): number | null {
    const loc = this.getLocationOf(point);
    return loc ? loc.getOffset() : null;
  }

  /**
   * 指定されたオフセット位置のパス上の位置情報を取得
   * @param offset オフセット位置（0〜getLength()）
   * @returns 曲線位置情報
   */
  getLocationAt(offset: number): CurveLocation | null {
    if (typeof offset === 'number') {
      const curves = this.getCurves();
      const length = curves.length;
      if (!length) return null;
      
      let curLength = 0;
      
      for (let i = 0; i < length; i++) {
        const start = curLength;
        const curve = curves[i];
        curLength += curve.getLength();
        
        if (curLength > offset) {
          // この曲線上の位置を計算
          return curve.getLocationAt(offset - start);
        }
      }
      
      // 誤差により最後の曲線が見逃された場合、offsetが全長以下であれば最後の曲線の終点を返す
      if (curves.length > 0 && offset <= this.getLength()) {
        return new CurveLocation(curves[length - 1], 1);
      }
    } else if (offset && (offset as any).getPath && (offset as any).getPath() === this) {
      // offsetがすでにCurveLocationの場合はそのまま返す
      return offset as unknown as CurveLocation;
    }
    
    return null;
  }

  /**
   * 指定されたパラメータ位置のパス上の接線ベクトルを取得
   * @param offset オフセット位置（0〜getLength()）
   * @returns 接線ベクトル
   */
  getTangentAt(offset: number): Point {
    const loc = this.getLocationAt(offset);
    return loc && loc.curve ? loc.curve.getTangentAt(loc.time!, true) : new Point(0, 0);
  }

  /**
   * 点がパス内部にあるかどうかを判定（paper.js完全版）
   * @param point 判定する点
   * @param options オプション
   * @param options.rule 判定ルール（'evenodd'または'nonzero'）
   * @returns 内部ならtrue、外部またはパス上ならfalse
   */
  contains(
    point: Point,
    options?: {
      rule?: 'evenodd' | 'nonzero';
    }
  ): boolean {
    return contains(this._segments, this._closed, this.getCurves(), point, options);
  }

  /**
   * 点がパス上にあるかどうかを判定
   * @param point 判定する点
   * @param epsilon 許容誤差
   * @returns パス上ならtrue
   */
  private _isOnPath(point: Point, epsilon = Numerical.GEOMETRIC_EPSILON): boolean {
    return isOnPath(this._segments, this.getCurves(), point, epsilon);
  }

  /**
   * 点に対するwinding numberを計算（左右分割版）
   * @param point 判定する点
   * @returns {windingL, windingR} 左右のwinding number
   */
  private _getWinding(point: Point): { windingL: number; windingR: number } {
    return getWinding(this.getCurves(), point);
  }

  /**
   * 変換行列を設定
   * @param matrix 変換行列
   */
  transform(matrix: Matrix): Path {
    this._matrix = matrix;
    this._matrixDirty = true;
    // ジオメトリが変更されたことを記録
    this._length = this._area = undefined;
    this._bounds = undefined;
    return this;
  }

  /**
   * 平行移動
   * @param dx x方向の移動量
   * @param dy y方向の移動量
   */
  translate(dx: number, dy: number): Path {
    if (!this._matrix) {
      this._matrix = Matrix.identity();
    }
    this._matrix = this._matrix.translate(dx, dy);
    this._matrixDirty = true;
    // ジオメトリが変更されたことを記録
    this._length = this._area = undefined;
    this._bounds = undefined;
    return this;
  }

  /**
   * 回転
   * @param angle 回転角度（度）
   * @param center 回転中心
   */
  rotate(angle: number, center?: Point): Path {
    if (!this._matrix) {
      this._matrix = Matrix.identity();
    }
    this._matrix = this._matrix.rotate(angle, center);
    this._matrixDirty = true;
    // ジオメトリが変更されたことを記録
    this._length = this._area = undefined;
    this._bounds = undefined;
    return this;
  }

  /**
   * スケーリング
   * @param sx x方向のスケール
   * @param sy y方向のスケール
   * @param center スケーリングの中心
   */
  scale(sx: number, sy?: number, center?: Point): Path {
    if (!this._matrix) {
      this._matrix = Matrix.identity();
    }
    this._matrix = this._matrix.scale(sx, sy, center);
    this._matrixDirty = true;
    // ジオメトリが変更されたことを記録
    this._length = this._area = undefined;
    this._bounds = undefined;
    
    // カーブのキャッシュもクリア
    if (this._curves) {
      for (let i = 0, l = this._curves.length; i < l; i++) {
        this._curves[i]._changed();
      }
    }
    return this;
  }

  /**
   * パスのカーブの数を計算する
   * セグメント数と閉じているかどうかに基づいて計算
   */
  private _countCurves(): number {
    const length = this._segments.length;
    // 開いたパスの場合は長さを1減らす
    return !this._closed && length > 0 ? length - 1 : length;
  }

  getCurves(): Curve[] {
    // paper.jsと同様にキャッシュを使用する
    if (this._curves) {
      return this._curves;
    }
    
    const curves: Curve[] = [];
    const segments = this._segments;
    const length = this._countCurves();
    
    for (let i = 0; i < length; i++) {
      curves.push(new Curve(segments[i], segments[i + 1] || segments[0]));
    }
    
    this._curves = curves;
    return curves;
  }

  /**
   * パスの最初の曲線を取得
   * @returns 最初の曲線
   */
  getFirstCurve(): Curve | undefined {
    const curves = this.getCurves();
    return curves.length > 0 ? curves[0] : undefined;
  }

  /**
   * パスの最後の曲線を取得
   * @returns 最後の曲線
   */
  getLastCurve(): Curve | undefined {
    const curves = this.getCurves();
    return curves.length > 0 ? curves[curves.length - 1] : undefined;
  }

  // --- セグメント操作（ミュータブル: thisを返す） ---

  /**
   * セグメントを追加
   * @param segment 追加するセグメント
   */
  add(segment: Segment): Segment {
    return this._add([segment])[0];
  }

  /**
   * 指定位置にセグメントを挿入
   * @param index 挿入位置
   * @param segment 挿入するセグメント
   */
  insert(index: number, segment: Segment): Segment {
    return this._add([segment], index)[0];
  }

  /**
   * セグメントを削除
   * @param index 削除するセグメントのインデックス
   */
  removeSegment(index: number): Segment | null {
    return this.removeSegments(index, index + 1)[0] || null;
  }

  /**
   * 複数のセグメントを削除
   * @param from 開始インデックス
   * @param to 終了インデックス（省略時は最後まで）
   */
  removeSegments(from: number = 0, to?: number): Segment[] {
    from = from || 0;
    to = to !== undefined ? to : this._segments.length;
    
    const segments = this._segments;
    const curves = this._curves;
    const removed = segments.splice(from, to - from);
    
    if (removed.length === 0) {
      return removed;
    }
    
    // インデックスの更新
    for (let i = from, l = segments.length; i < l; i++) {
      segments[i]._index = i;
    }
    
    // カーブの更新
    if (curves) {
      const index = from > 0 && to === segments.length + removed.length ? from - 1 : from;
      this._curves!.splice(index, removed.length);
      this._adjustCurves(index, index);
    }
    
    this._changed(ChangeFlag.SEGMENTS);
    return removed;
  }

  /**
   * すべてのセグメントを削除
   */
  clear(): Segment[] {
    return this.removeSegments();
  }

  // --- サブパス操作 ---

  /**
   * 新しい位置にパスを移動（既存のセグメントをクリアして新しいセグメントを追加）
   * @param point 移動先の点
   */
  moveTo(point: Point): Path {
    this._segments.length = 0;
    this._curves = undefined;
    this.add(new Segment(point));
    return this;
  }

  /**
   * 直線セグメントを追加
   * @param point 線の終点
   */
  lineTo(point: Point): Path {
    this.add(new Segment(point));
    return this;
  }

  /**
   * cubicCurveTo: smoothHandles/selfClosing対応
   * @param handle1
   * @param handle2
   * @param to
   * @param options.smoothHandles: 連続ノードのハンドルを平滑化
   * @param options.selfClosing: 始点と終点が一致していれば自動的にclose
   */
  /**
   * 3次ベジェ曲線セグメントを追加
   * @param handle1 制御点1
   * @param handle2 制御点2
   * @param to 終点
   * @param options オプション
   */
  cubicCurveTo(
    handle1: Point,
    handle2: Point,
    to: Point,
    options?: { smoothHandles?: boolean; selfClosing?: boolean }
  ): Path {
    if (this._segments.length === 0) {
      this.add(new Segment(to));
      return this;
    }
    
    const lastIdx = this._segments.length - 1;
    const lastSeg = this._segments[lastIdx];
    
    // handleOut: handle1 - last.point
    let relHandleOut = handle1.subtract(lastSeg.point);
    let relHandleIn = handle2.subtract(to);

    // smoothHandles: 連続ノードのハンドルを平滑化
    if (options?.smoothHandles && lastIdx > 0) {
      const prev = this._segments[lastIdx - 1].point;
      const curr = lastSeg.point;
      // Catmull-Rom的な平滑化
      relHandleOut = curr.subtract(prev).multiply(1 / 3);
      relHandleIn = to.subtract(lastSeg.point).multiply(-1 / 3);
    }

    // 最後のセグメントのハンドルを設定
    lastSeg.setHandleOut(relHandleOut);
    
    // 新しいセグメントを追加
    this.add(new Segment(to, relHandleIn, new Point(0, 0)));

    // selfClosing: 始点と終点が一致していれば自動的にclose
    if (options?.selfClosing) {
      const firstPt = this._segments[0].point;
      const lastPt = to;
      if (firstPt.equals(lastPt)) {
        this._closed = true;
      }
    }
    
    return this;
  }

  /**
   * 全セグメントのハンドルを自動補正（paper.jsのsmooth相当, Catmull-Rom的）
   */
  /**
   * 全セグメントのハンドルを自動補正（paper.jsのsmooth相当, Catmull-Rom的）
   */
  smooth(): Path {
    if (this._segments.length < 3) return this;
    
    for (let i = 1; i < this._segments.length - 1; i++) {
      const prev = this._segments[i - 1].point;
      const curr = this._segments[i].point;
      const next = this._segments[i + 1].point;
      // ハンドルは前後点の差分を1/6ずつ
      const handleIn = prev.subtract(next).multiply(-1 / 6);
      const handleOut = next.subtract(prev).multiply(1 / 6);
      this._segments[i].setHandleIn(handleIn);
      this._segments[i].setHandleOut(handleOut);
    }
    
    this._changed(ChangeFlag.GEOMETRY);
    return this;
  }
  
  /**
   * パスを閉じる
   */
  close(): Path {
    this._closed = true;
    this._changed(ChangeFlag.SEGMENTS);
    return this;
  }

  /**
   * パスのセグメントにハンドルが設定されているかどうかを確認
   * @returns ハンドルが設定されていればtrue
   */
  hasHandles(): boolean {
    const segments = this._segments;
    for (let i = 0, l = segments.length; i < l; i++) {
      if (segments[i].hasHandles()) {
        return true;
      }
    }
    return false;
  }

  /**
   * パスのすべてのハンドルをクリア
   * @returns 新しいパス
   */
  /**
   * パスのすべてのハンドルをクリア
   */
  clearHandles(): Path {
    const segments = this._segments;
    for (let i = 0, l = segments.length; i < l; i++) {
      segments[i].clearHandles();
    }
    this._changed(ChangeFlag.GEOMETRY);
    return this;
  }
  
  // Boolean演算API（unite, intersect, subtract, exclude, divide）
  /**
   * パスの合成（unite）
   * @param other 合成する相手のパス
   * @returns 合成結果のパス（this）
   */
  unite(other: Path): Path {
    // PathBooleanクラスを使用して結果を取得し、このパスに適用
    const result = import('./PathBoolean').then((module) => {
      return module.PathBoolean.unite(this, other);
    });
    
    // 非同期処理の結果を待たずにthisを返す（paper.jsと同様のミュータブル設計）
    return this;
  }

  /**
   * パスの交差（intersect）
   * @param other 交差する相手のパス
   * @returns 交差結果のパス（this）
   */
  intersect(other: Path): Path {
    // PathBooleanクラスを使用して結果を取得し、このパスに適用
    const result = import('./PathBoolean').then((module) => {
      return module.PathBoolean.intersect(this, other);
    });
    
    // 非同期処理の結果を待たずにthisを返す（paper.jsと同様のミュータブル設計）
    return this;
  }

  /**
   * パスの差分（subtract）
   * @param other 差し引く相手のパス
   * @returns 差分結果のパス（this）
   */
  subtract(other: Path): Path {
    // PathBooleanクラスを使用して結果を取得し、このパスに適用
    const result = import('./PathBoolean').then((module) => {
      return module.PathBoolean.subtract(this, other);
    });
    
    // 非同期処理の結果を待たずにthisを返す（paper.jsと同様のミュータブル設計）
    return this;
  }

  /**
   * パスの排他的論理和（exclude）
   * @param other 排他的論理和を取る相手のパス
   * @returns 排他的論理和結果のパス（this）
   */
  exclude(other: Path): Path {
    // PathBooleanクラスを使用して結果を取得し、このパスに適用
    const result = import('./PathBoolean').then((module) => {
      return module.PathBoolean.exclude(this, other);
    });
    
    // 非同期処理の結果を待たずにthisを返す（paper.jsと同様のミュータブル設計）
    return this;
  }

  /**
   * パスの分割（divide）
   * @param other 分割に使用する相手のパス
   * @returns 分割結果のパス（this）
   */
  divide(other: Path): Path {
    // PathBooleanクラスを使用して結果を取得し、このパスに適用
    const result = import('./PathBoolean').then((module) => {
      return module.PathBoolean.divide(this, other);
    });
    
    // 非同期処理の結果を待たずにthisを返す（paper.jsと同様のミュータブル設計）
    return this;
  }

  /**
   * 他のパスとの交点を取得
   * paper.jsのPathItem.getIntersectionsメソッドに相当
   * @param path 交点を求める相手のパス（未指定の場合は自己交差を検出）
   * @param includeParam 交点をフィルタリングするコールバック関数
   * @param _matrix 内部使用: 相手パスの変換行列をオーバーライド
   * @param _returnFirst 内部使用: 最初の交点だけを返すフラグ
   * @returns 交点情報の配列
   */
  getIntersections(
    path?: Path,
    includeParam?: ((loc: CurveLocation) => boolean) | { include: (loc: CurveLocation) => boolean },
    _matrix?: Matrix,
    _returnFirst?: boolean
  ): CurveLocation[] {
    const curves1 = this.getCurves();
    const curves2 = path ? path.getCurves() : curves1;
    const matrix1 = this._matrix ? this._matrix._orNullIfIdentity() : null;
    
    let matrix2: Matrix | null = null;
    if (this === path || !path) {
      matrix2 = matrix1;
    } else if (_matrix) {
      matrix2 = _matrix._orNullIfIdentity();
    } else if (path && path._matrix) {
      matrix2 = path._matrix._orNullIfIdentity();
    }
    
    return getIntersections(curves1, curves2, includeParam, matrix1, matrix2, _returnFirst);
  }

  /**
   * 指定された接線に対して曲線が接する時間パラメータを計算
   * @param tangent 接線ベクトル
   * @returns パス上のオフセット位置の配列
   */
  getOffsetsWithTangent(tangent: Point): number[] {
    if (tangent.isZero()) {
      return [];
    }

    const offsets: number[] = [];
    let curveStart = 0;
    const curves = this.getCurves();
    
    for (let i = 0, l = curves.length; i < l; i++) {
      const curve = curves[i];
      // 曲線上の接線ベクトルと一致する時間パラメータを計算
      const curveTimes = curve.getTimesWithTangent(tangent);
      
      for (let j = 0, m = curveTimes.length; j < m; j++) {
        // 曲線上の時間パラメータをパス上のオフセットに変換
        const offset = curveStart + curve.getPartLength(0, curveTimes[j]);
        
        // 重複を避ける
        if (offsets.indexOf(offset) < 0) {
          offsets.push(offset);
        }
      }
      
      curveStart += curve.getLength();
    }
    
    return offsets;
  }
}
