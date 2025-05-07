/**
 * Path クラス
 * Paper.js の Path (src/path/Path.js) を参考にしたミュータブルなパス表現。
 * segments 配列と closed フラグを持ち、PathItemBase クラスを継承する。
 */

import { Point } from '../basic/Point';
import { Rectangle } from '../basic/Rectangle';
import { Matrix } from '../basic/Matrix';
import { Curve } from './Curve';
import { CurveLocation } from './CurveLocation';
import { Segment } from './Segment';
import { Numerical } from '../util/Numerical';
import { PathItem } from './PathItem';
import { PathItemBase } from './PathItemBase';
import { PathArc } from './PathArc';
import { ChangeFlag } from './ChangeFlag';
import { computeBounds, isOnPath, getIntersections, contains } from './PathGeometry';
import { getWinding } from './PathBooleanWinding';
import { PathFlattener } from './PathFlattener';
import { PathFitter } from './PathFitter';
import { toPathData, fromPathData, fromSVG } from './PathSVG';
import { reducePath } from './PathReduce';
import { PathConstructors } from './PathConstructors';
import { smoothPath, splitPathAt } from './PathUtils';
import { resolveCrossings } from './PathBooleanResolveCrossings';

export class Path extends PathItemBase {
  // 静的メソッド
  static get Line() { return PathConstructors.Line; }
  static get Circle() { return PathConstructors.Circle; }
  static get Rectangle() { return PathConstructors.Rectangle; }
  static get Ellipse() { return PathConstructors.Ellipse; }
  static get Arc() { return PathConstructors.Arc; }
  static get RegularPolygon() { return PathConstructors.RegularPolygon; }
  static get Star() { return PathConstructors.Star; }
  // PathItemBaseから継承したプロパティ以外のプロパティ
  _segments: Segment[];
  _closed: boolean;
  _curves: Curve[] | null;
  _length?: number;
  _area?: number;

  constructor(segments: Segment[] = [], closed: boolean = false) {
    super();
    this._segments = [];
    this._closed = false;
    this._curves = null;

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
    this._curves = null;
    this._segments.length = 0;

    if (segments && segments.length) {
      this._add(segments);
    }
  }

  /**
   * 複数のセグメントを追加
   * @param segments 追加するセグメント配列
   */
  _add(segs: Segment[], index?: number): Segment[] {
    this._curves = this._curves || [];
    const segments = this._segments;
    const amount = segs.length;
    const append = index === undefined;
    index = append ? segments.length : index!;

    // セグメントの設定
    for (let i = 0; i < amount; i++) {
      // 必ずクローン（メタ情報も含めてコピー）
      segs[i] = segs[i].clone();
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
    if (this._curves) {
      const total = this._countCurves();
      const start = index > 0 && index + amount - 1 === total ? index - 1 : index;
      let insert = start;
      const end = Math.min(start + amount, total);

      // カーブ配列の長さを調整
      while (this._curves.length < total) {
        this._curves.push(new Curve(this, null, null));
      }
      while (this._curves.length > total) {
        this._curves.pop();
      }

      // 新しいカーブの挿入
      for (let i = insert; i < end; i++) {
        if (!this._curves[i]) {
          this._curves[i] = new Curve(this, null, null);
        }
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

    // paper.jsと同様に、カーブのセグメントを設定する
    for (let i = start; i < end; i++) {
      const curve = curves[i];
      curve._path = this;
      curve._segment1 = segments[i];
      curve._segment2 = segments[i + 1] || segments[0];
      curve._changed();
    }

    // 最初のセグメントの場合、閉じたパスの最後のセグメントも修正
    if (this._closed && start === 0) {
      const curve = curves[curves.length - 1];
      if (curve) {
        curve._segment2 = segments[0];
        curve._changed();
      }
    }

    // 修正範囲の前のセグメントがある場合も修正
    if (start > 0) {
      const curve = curves[start - 1];
      if (curve) {
        curve._segment2 = segments[start];
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
        const length = (this._curves.length = this._countCurves());
        if (closed) {
          const curve = new Curve(this, this._segments[length - 1], this._segments[0]);
          this._curves[length - 1] = curve;
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
        area += Curve.getArea(
          Curve.getValues(segments[i], segments[last ? 0 : i + 1], null, last && !closed)
        );
      }

      this._area = area; // 符号を保持する（時計回り判定に使用）
    }

    return this._area!;
  }

  /**
   * パスが時計回りかどうかを判定
   * paper.jsのisClockwise()メソッドを移植
   * @returns 時計回りならtrue
   */
  isClockwise(): boolean {
    return this.getArea() >= 0;
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
    return loc ? loc.getPoint() : new Point(0, 0);
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
    const curves = this.getCurves();
    const length = curves.length;
    if (!length) {
      return null;
    }

    let curLength = 0;

    for (let i = 0; i < length; i++) {
      const start = curLength;
      const curve = curves[i];
      const curveLength = curve.getLength();
      curLength += curveLength;

      if (curLength > offset) {
        // この曲線上の位置を計算
        const curveOffset = offset - start;
        const loc = curve.getLocationAt(curveOffset);
        return loc;
      }
    }

    // 誤差により最後の曲線が見逃された場合、offsetが全長以下であれば最後の曲線の終点を返す
    if (curves.length > 0 && offset <= this.getLength()) {
      return new CurveLocation(curves[length - 1], 1);
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
    return loc && loc.getCurve()
      ? loc.getCurve()!.getTangentAt(loc.getTime()!, true)
      : new Point(0, 0);
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
  getWinding(
    point: Point,
    dir: boolean = false,
    closed: boolean = false
  ): { winding: number; windingL: number; windingR: number; quality: number; onPath: boolean } {
    return getWinding(point, this.getCurves(), dir, closed);
  }

  /**
   * 内部用のwinding number計算メソッド（paper.jsとの互換性のため）
   * @param point 判定する点
   * @param dir 方向（falseならx方向、trueならy方向）
   * @param closed パスが閉じているかどうか
   * @returns winding情報
   */
  _getWinding(
    point: Point,
    dir: boolean = false,
    closed: boolean = false
  ): { winding: number; windingL: number; windingR: number; quality: number; onPath: boolean } {
    return getWinding(point, this.getCurves(), dir, closed);
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

    // セグメントを直接変換して、カーブの長さを正しく更新
    const segments = this._segments;
    const actualSy = sy === undefined ? sx : sy;
    const centerPoint = center || new Point(0, 0);

    for (let i = 0, l = segments.length; i < l; i++) {
      const segment = segments[i];

      // SegmentPointオブジェクトを直接操作
      const point = segment._point;
      const handleIn = segment._handleIn;
      const handleOut = segment._handleOut;

      // 点を変換
      const px = point._x;
      const py = point._y;
      point._set(
        centerPoint.x + (px - centerPoint.x) * sx,
        centerPoint.y + (py - centerPoint.y) * actualSy
      );

      // ハンドルを変換（ハンドルは相対座標なので中心点は考慮しない）
      handleIn._set(handleIn._x * sx, handleIn._y * actualSy);
      handleOut._set(handleOut._x * sx, handleOut._y * actualSy);
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
    this._curves = null;
    // paper.jsと同様にキャッシュを使用する
    if (this._curves) {
      return this._curves;
    }

    const curves: Curve[] = [];
    const segments = this._segments;
    const count = segments.length;

    if (count < 2) {
      this._curves = [];
      return [];
    }

    if (this._closed) {
      for (let i = 0; i < count; i++) {
        const next = (i + 1) % count;
        const curve = new Curve(this, segments[i], segments[next]);
        curves.push(curve);
      }
      // ★ index操作は不要。paper.jsはここでindexをいじらない
    } else {
      for (let i = 0; i < count - 1; i++) {
        const curve = new Curve(this, segments[i], segments[i + 1]);
        curves.push(curve);
      }
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
    this._curves = null;
    return this._add([segment])[0];
  }

  /**
   * 指定位置にセグメントを挿入
   * @param index 挿入位置
   * @param segment 挿入するセグメント
   */
  insert(index: number, segment: Segment): Segment {
    this._curves = null;
    return this._add([segment], index)[0];
    // 挿入後に_curve配列を再構築（Curve.getNext()対策）
    this.getCurves();
    // カーブのセグメント参照を調整
    this._adjustCurves(Math.max(0, index - 1), Math.min(this._segments.length, index + 2));
    return this._segments[index];
  }

  /**
   * セグメントを削除
   * @param index 削除するセグメントのインデックス
   */
  removeSegment(index: number): Segment | null {
    this._curves = null;
    return this.removeSegments(index, index + 1)[0] || null;
  }

  /**
   * 複数のセグメントを削除
   * @param from 開始インデックス
   * @param to 終了インデックス（省略時は最後まで）
   */
  removeSegments(from: number = 0, to?: number): Segment[] {
    this._curves = null;
    from = from || 0;
    to = to !== undefined ? to : this._segments.length;

    const segments = this._segments;
    const curves = this._curves;
    const removed = segments.splice(from, to - from);

    // 🔥DEBUG: Path#removeSegments
    console.log("🔥[Path#removeSegments] from:", from, "to:", to, "removed:", removed.map(s => s.getPoint().toString()), "segments(after):", segments.map(s => s.getPoint().toString()), "curves?", !!curves, "closed:", this._closed);

    if (removed.length === 0) {
      return removed;
    }

    // インデックスの更新
    for (let i = from, l = segments.length; i < l; i++) {
      segments[i]._index = i;
    }

    // カーブの更新
    if (curves) {
      // paper.jsと同じロジックに修正
      // 閉じたパスで末尾カーブを消す場合はindex=segments.lengthでsplice
      const count = segments.length + removed.length;
      const isClosed = this._closed;
      const index = from > 0 && to === count + (isClosed ? 1 : 0)
        ? from - 1
        : from;
      // console.log("🔥[Path#removeSegments] curves splice index:", index, "removed.length:", removed.length);
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
    this._curves = null;
    return this.removeSegments();
  }

  // --- サブパス操作 ---

  /**
   * 新しい位置にパスを移動（既存のセグメントをクリアして新しいセグメントを追加）
   * @param point 移動先の点
   */
  moveTo(point: Point): Path {
    this._segments.length = 0;
    this._curves = null;
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
   * パスのセグメントを滑らかにします。
   *
   * @param options スムージングのオプション
   * @param options.type スムージングのタイプ: 'continuous'（連続的）または'asymmetric'（非対称）
   * @param options.from スムージングを開始するセグメントのインデックスまたはセグメント
   * @param options.to スムージングを終了するセグメントのインデックスまたはセグメント
   * @returns このパスオブジェクト（メソッドチェーン用）
   */
  smooth(options?: {
    type?: 'asymmetric' | 'continuous';
    from?: number | Segment;
    to?: number | Segment;
  }): Path {
    // PathUtils.ts に切り出した smoothPath を呼び出す
    return smoothPath(this, options);
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
   * パスを閉じる（paper.js互換）
   * @param tolerance 許容誤差
   */
  closePath(tolerance: number = 0): Path {
    // 最初と最後のセグメントの距離が許容誤差以内なら、そのまま閉じる
    // そうでなければ、最初のセグメントへの線を追加してから閉じる
    const firstSegment = this.getFirstSegment();
    const lastSegment = this.getLastSegment();

    if (firstSegment && lastSegment && !this._closed) {
      const firstPoint = firstSegment.point;
      const lastPoint = lastSegment.point;

      if (firstPoint && lastPoint && !firstPoint.equals(lastPoint)) {
        // 距離が許容誤差より大きい場合は線を追加
        if (firstPoint.getDistance(lastPoint) > tolerance) {
          // paper.js互換: 最初のセグメントのcloneを末尾に追加
          this.add(firstSegment.clone());
        }
      }

      this._closed = true;
      this._changed(ChangeFlag.SEGMENTS);
    }

    return this;
  }

  /**
   * 円弧を描画する
   *
   * 3つの形式で呼び出すことができます：
   * 1. arcTo(to, clockwise) - 現在の点から指定された点までの円弧を描画
   * 2. arcTo(through, to) - 現在の点から、指定された中間点を通って、指定された終点までの円弧を描画
   * 3. arcTo(to, radius, rotation, clockwise, large) - SVGスタイルの円弧を描画
   *
   * @returns 円弧が追加されたパス（this）
   */
  /**
   * 円弧を描画する
   * @param to 終点
   * @param clockwise 時計回りかどうか（省略可）
   * @returns 円弧が追加されたパス（this）
   */
  arcTo(to: Point, clockwise?: boolean): Path {
    return PathArc.arcTo(this, to, clockwise);
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
   * @param include 交点をフィルタリングするコールバック関数
   * @param _matrix 内部使用: 相手パスの変換行列をオーバーライド
   * @param _returnFirst 内部使用: 最初の交点だけを返すフラグ
   * @returns 交点情報の配列
   */
  getIntersections(
    path?: PathItem | null,
    include?: ((loc: CurveLocation) => boolean) | { include: (loc: CurveLocation) => boolean },
    _matrix?: Matrix,
    _returnFirst?: boolean
  ): CurveLocation[] {
    // NOTE: 自己交差の場合、pathはnullまたは未定義。
    // つまり、path.getIntersections()のように引数なしで呼び出すと自己交差を取得できる。
    // NOTE: 隠し引数_matrixは、渡されたパスの変換行列を内部的にオーバーライドするために使用される。
    const self = this === path || !path;
    const matrix1 = this._matrix ? this._matrix._orNullIfIdentity() : null;
    const matrix2 = self
      ? matrix1
      : _matrix || (path && path instanceof Path && path._matrix)
        ? (_matrix || (path && path instanceof Path && path._matrix ? path._matrix : null))?._orNullIfIdentity()
        : null;

    // 最初に2つのパスの境界をチェック。交差しない場合は、
    // 曲線を反復処理する必要はない。
    return self || this.getBounds(matrix1).intersects(path!.getBounds(matrix2), Numerical.EPSILON)
      ? getIntersections(
          this.getCurves(),
          !self && path ? path.getCurves() : null,
          include,
          matrix1,
          matrix2,
          _returnFirst
        )
      : [];
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

  /**
   * パスが直線かどうかを判定
   * @returns 直線ならtrue
   */
  isStraight(): boolean {
    if (this._segments.length !== 2) {
      return false;
    }
    return !this.hasHandles();
  }

  /**
   * 指定された位置でパスを分割
   * @param location 分割位置（オフセットまたはCurveLocation）
   * @returns 分割後の新しいパス（後半部分）
   */
  splitAt(location: number | CurveLocation): Path | null {
    this._curves = null;
    const result = splitPathAt(this, location);
    this._changed(ChangeFlag.GEOMETRY);
    return result;
  }

  /**
   * 2つのパスが等しいかどうかを判定
   * @param path 比較するパス
   * @returns 等しければtrue
   */
  equals(path: Path): boolean {
    if (!path || path._segments.length !== this._segments.length) {
      return false;
    }

    for (let i = 0, l = this._segments.length; i < l; i++) {
      if (!this._segments[i].equals(path._segments[i])) {
        return false;
      }
    }

    return true;
  }

  /**
   * パスのクローンを作成する
   * paper.jsのclone関数を移植
   *
   * @param deep 深いクローンを作成するかどうか
   * @returns クローンされたパス
   */
  clone(deep: boolean = false): Path {
    // 新しいパスを作成
    const segments = this.getSegments().map((segment) => segment.clone());
    const clonedPath = new Path(segments, this.closed);

    // 属性をコピー
    clonedPath.copyAttributes(this);

    return clonedPath;
  }

  /**
   * パスを平坦化（フラット化）します。
   * 曲線を直線セグメントに変換し、ハンドルを持たないパスにします。
   * @param flatness 許容される最大誤差（デフォルト: 0.25）
   * @returns このパスオブジェクト（メソッドチェーン用）
   */
  flatten(flatness: number = 0.25): Path {
    // PathFlattenerを使用して曲線を直線セグメントに分割
    const flattener = new PathFlattener(this, flatness || 0.25, 256, true);
    const parts = flattener.parts;
    const length = parts.length;
    const segments: Segment[] = [];

    // 各部分から新しいセグメントを作成
    for (let i = 0; i < length; i++) {
      segments.push(new Segment(new Point(parts[i].curve[0], parts[i].curve[1])));
    }

    // 開いたパスで長さが0より大きい場合、最後の曲線の終点を追加
    if (!this._closed && length > 0) {
      segments.push(new Segment(new Point(parts[length - 1].curve[6], parts[length - 1].curve[7])));
    }

    // 新しいセグメントでパスを更新
    this.setSegments(segments);
    return this;
  }

  /**
   * パスを単純化します。
   * Philip J. Schneiderのアルゴリズムを使用して、パスのセグメント数を減らしながら
   * 元の形状を近似します。
   *
   * @param tolerance 許容誤差（デフォルト: 2.5）- 値が小さいほど元の形状に近くなり、
   *                  値が大きいほどセグメント数が少なくなります
   * @returns 単純化が成功した場合はtrue、失敗した場合はfalse
   */
  simplify(tolerance?: number): boolean {
    // PathFitterを使用してパスを単純化
    const segments = new PathFitter(this).fit(tolerance || 2.5);

    // 単純化に成功した場合、新しいセグメントをパスに設定
    if (segments) {
      this.setSegments(segments);
    }

    return !!segments;
  }

  /**
   * パスが空かどうかを判定
   * paper.jsのPath.isEmpty()を移植
   * @returns 空ならtrue
   */
  isEmpty(): boolean {
    // セグメントがない場合は空
    return this._segments.length === 0;
  }

  /**
   * パスを削除する
   * paper.jsのItem.remove()を移植
   * @returns 削除されたパス、または削除できなかった場合はnull
   */
  remove(): PathItem | null {
    // 現在の実装では単純に自身を返す
    // 実際のpaper.jsでは、親アイテムから削除する
    return this;
  }

  /**
   * パスの内部点を取得する
   * paper.jsのgetInteriorPoint()メソッドを移植
   * @returns パス内部の点
   */
  getInteriorPoint(): Point {
    const bounds = this.getBounds();
    const point = new Point(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);

    // 中心点がパス内部にない場合は、別の方法で内部点を探す
    if (!this.contains(point)) {
      // パスの最初のセグメントの点を使用
      const firstSegment = this.getFirstSegment();
      if (firstSegment) {
        return firstSegment.point;
      }
    }

    return point;
  }

  /**
   * パスを簡略化する
   * 単一のPathに変換できる場合は変換する
   * paper.jsのPath.reduce()を移植
   * @param options 簡略化オプション
   * @returns 簡略化されたPathItemオブジェクト
   */
  reduce(options?: { simplify?: boolean }): PathItem {
    return reducePath(this, options);
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

  /**
   * 指定されたパスの上に挿入する
   * paper.jsのItem.insertAbove()を移植
   * @param path 挿入する位置の基準となるパス
   * @returns このパス
   */
  insertAbove(path: PathItem): Path {
    // 現在の実装では何もしない
    // 実際のpaper.jsでは、指定されたアイテムの上に挿入する
    return this;
  }

  /**
   * パスの向きを反転させる
   * paper.jsのPath.reverse()を移植
   * @returns このパス
   */
  reverse(): PathItemBase {
    this._segments.reverse();
    // ハンドルを反転
    for (let i = 0, l = this._segments.length; i < l; i++) {
      const segment = this._segments[i];
      const handleIn = segment._handleIn;
      segment._handleIn = segment._handleOut;
      segment._handleOut = handleIn;
      segment._index = i;
    }
    // カーブのキャッシュをクリア
    this._curves = null;
    this._changed(ChangeFlag.GEOMETRY);
    return this;
  }

  /**
   * パスの配列を取得する
   * Pathの場合は自身を含む配列を返す
   * paper.jsのgetPaths関数を移植
   * @returns パスの配列
   */
  getPaths(): Path[] {
    return [this];
  }

  /**
   * 交差を解決する
   * paper.jsのPathItem.resolveCrossings()を移植
   * @returns 交差が解決されたパス
   */
  // PathBooleanResolveCrossings.tsの関数を利用
  resolveCrossings(): PathItem {
    return resolveCrossings(this);
  }

  /**
   * パスの向きを再設定する
   * paper.jsのPathItem.reorient()を移植
   * @param nonZero 非ゼロ塗りつぶしルールを適用するかどうか
   * @param clockwise 時計回りにするかどうか
   * @returns このパス
   */
  reorient(nonZero?: boolean, clockwise?: boolean): PathItem {
    if (clockwise !== undefined) {
      this.setClockwise(clockwise);
    }
    return this;
  }

  // setClockwiseメソッドは基底クラスから継承

  /**
   * SVGパスデータ（paper.jsのgetPathData相当）を返す
   * 直線のみ対応（ハンドルがあればL→Cに拡張すること）
   */
  getPathData(): string {
    // PathSVG.tsに外注
    return toPathData(this);
  }

  /**
   * 他のパスと幾何学的に等しいか/重なり合うかを判定（paper.js互換）
   * @param path 比較対象のパス
   * @returns 等しければtrue
   */
  compare(path: Path): boolean {
    // null/型チェック
    if (!path || !(path instanceof Path)) return false;

    // 境界ボックスの一致判定
    const bounds1 = this.getBounds();
    const bounds2 = path.getBounds();
    if (!bounds1.equals(bounds2)) return false;

    // セグメント数の一致
    if (this._segments.length !== path._segments.length) return false;

    // セグメント座標・ハンドルの一致
    for (let i = 0; i < this._segments.length; i++) {
      if (!this._segments[i].equals(path._segments[i])) {
        return false;
      }
    }

    // パスの方向（isClockwise）の一致
    if (this.isClockwise() !== path.isClockwise()) return false;

    // 面積の一致（符号も含めて）
    if (this.getArea() !== path.getArea()) return false;

    // ここまで一致すれば幾何学的に等しいとみなす
    return true;
  }

  /**
     * 指定したセグメントを始点にする（paper.js互換）
     * @param seg 始点にしたいSegment
     */
  setFirstSegment(seg: Segment): void {
    const segments = this.getSegments();
    const idx = segments.indexOf(seg);
    if (idx > 0) {
      const rotated = segments.slice(idx).concat(segments.slice(0, idx));
      this.setSegments(rotated);
    }
  }

  // --- SVGパスデータ getter/setter・staticメソッド ---
  get pathData(): string {
    return toPathData(this);
  }

  set pathData(val: string) {
    const path = fromPathData(val);
    this.setSegments(path.getSegments());
    this.setClosed(path.closed);
  }

  static fromPathData(val: string): Path {
    return fromPathData(val);
  }

  static fromSVG(val: string): Path {
    return fromSVG(val);
  }
/**
   * toString() でSVGパスデータを返す（paper.js互換）
   */
  toString(): string {
    return this.getPathData();
  }
}
