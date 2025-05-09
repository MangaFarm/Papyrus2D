/**
 * Path クラス
 * Paper.js の Path (src/path/Path.js) を参考にしたミュータブルなパス表現。
 * segments 配列と closed フラグを持ち、PathItemBase クラスを継承する。
 */

import type { PathItem } from './PathItem';
import { Point } from '../basic/Point';
import { Rectangle } from '../basic/Rectangle';
import { Matrix } from '../basic/Matrix';
import { Curve } from './Curve';
import { CurveLocation } from './CurveLocation';
import { Segment } from './Segment';
import { SegmentPoint } from './SegmentPoint';
import { Numerical } from '../util/Numerical';
import { PathItemBase, type BoundsEntry, type BoundsOptions } from './PathItemBase';
import { PathArc } from './PathArc';
import { ChangeFlag, Change } from './ChangeFlag';
import { computeBounds, getIntersections, contains } from './PathGeometry';
import { PathFlattener } from './PathFlattener';
import { PathFitter } from './PathFitter';
import { toPathData, fromPathData } from './PathSVG';
import { reducePath } from './PathReduce';
import { PathConstructors } from './PathConstructors';
import { smoothPath, splitPathAt } from './PathUtils';
import { resolveCrossings } from './PathBooleanResolveCrossings';

import { PathAnalysis } from './PathAnalysis';

// removeSegmentsが戻り値の配列にこっそり_curvesというフィールドを忍ばせるという
// 強烈に邪悪なことをしているので、それに対応
type SegmentsWithCurves = Array<Segment> & { _curves?: Curve[] };

export class Path extends PathItemBase {
    _analysis: PathAnalysis;
  // 静的メソッド
  static get Line() {
    return PathConstructors.Line;
  }
  static get Circle() {
    return PathConstructors.Circle;
  }
  static get Rectangle() {
    return PathConstructors.Rectangle;
  }
  static get Ellipse() {
    return PathConstructors.Ellipse;
  }
  static get Arc() {
    return PathConstructors.Arc;
  }
  static get RegularPolygon() {
    return PathConstructors.RegularPolygon;
  }
  static get Star() {
    return PathConstructors.Star;
  }
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
    this._analysis = new PathAnalysis();

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
  _add(segs: SegmentsWithCurves, index?: number): Segment[] {
    // Local short-cuts:
    var segments = this._segments,
      curves = this._curves,
      amount = segs.length,
      append = index == null,
      index = append ? segments.length : index;
    // Scan through segments to add first, convert if necessary and set
    // _path and _index references on them.
    for (var i = 0; i < amount; i++) {
      var segment = segs[i];
      // If the segments belong to another path already, clone them before
      // adding:
      if (segment._path) segment = segs[i] = segment.clone();
      segment._path = this;
      segment._index = index! + i;
    }
    if (append) {
      // Append them all at the end.
      segments.push(...segs);
    } else {
      // Insert somewhere else
      segments.splice(index!, 0, ...segs);
      // Adjust the indices of the segments above.
      for (var i = index! + amount, l = segments.length; i < l; i++) segments[i]._index = i;
    }
    // Keep the curves list in sync all the time in case it was requested
    // already.
    if (curves) {
      var total = this._countCurves(),
        // If we're adding a new segment to the end of an open path,
        // we need to step one index down to get its curve.
        start = index! > 0 && index! + amount - 1 === total ? index! - 1 : index,
        insert = start,
        end = Math.min(start! + amount, total);
      if (segs._curves) {
        // Reuse removed curves.
        curves.splice(start!, 0, ...segs._curves);
        insert! += segs._curves.length;
      }
      // Insert new curves, but do not initialize their segments yet,
      // since #_adjustCurves() handles all that for us.
      for (var i = insert!; i < end; i++) curves.splice(i, 0, new Curve(this, null, null));
      // Adjust segments for the curves before and after the removed ones
      this._adjustCurves(start!, end);
    }
    // Use SEGMENTS notification instead of GEOMETRY since curves are kept
    // up-to-date by _adjustCurves() and don't need notification.
    this._changed(/*#=*/ Change.SEGMENTS);
    return segs;
  }

  /**
   * カーブのセグメントを調整する内部メソッド
   */
  _adjustCurves(start: number, end: number): void {
    var segments = this._segments,
      curves = this._curves!,
      curve;
    for (var i = start; i < end; i++) {
      curve = curves[i];
      curve._path = this;
      curve._segment1 = segments[i];
      curve._segment2 = segments[i + 1] || segments[0];
      curve._changed();
    }
    // If it's the first segment, correct the last segment of closed
    // paths too:
    if ((curve = curves[this._closed && !start ? segments.length - 1 : start - 1])) {
      curve._segment2 = segments[start] || segments[0];
      curve._changed();
    }
    // Fix the segment after the modified range, if it exists
    if ((curve = curves[end])) {
      curve._segment1 = segments[end];
      curve._changed();
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
      this._changed(Change.SEGMENTS);
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

  _getBounds(matrix: Matrix | null, options: BoundsOptions): BoundsEntry {
      return { rect: this.getBounds(matrix, options) };
  }

  /**
   * パスの境界ボックスを取得
   * @param matrix 変換行列（オプション）
   * @returns 境界ボックス
   */
  getBounds(matrix: Matrix | null, options: BoundsOptions): Rectangle {
    let bounds = this._computeBounds(0);
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
      const t = curves[i].getTimeOf(point);
      if (t != null) {
        return curves[i].getLocationAtTime(t);
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
        const t = curve.getTimeAt(curveOffset)!;
        const loc = curve.getLocationAtTime(t);
        return loc;
      }
    }

    // 誤差により最後の曲線が見逃された場合、offsetが全長以下であれば最後の曲線の終点を返す
    if (curves.length > 0 && offset <= this.getLength()) {
      return new CurveLocation(curves[length - 1], 1, null, false, null);
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
    if (loc) {
      const curve = loc.getCurve();
      if (curve) {
        return curve.getTangentAtTime(loc.getTime()!);
      }
    }
    return new Point(0,0);
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
    var curves = this._curves,
      segments = this._segments;
    if (!curves) {
      var length = this._countCurves();
      curves = this._curves = new Array(length);
      for (var i = 0; i < length; i++)
        curves[i] = new Curve(
          this,
          segments[i],
          // Use first segment for segment2 of closing curve
          segments[i + 1] || segments[0]
        );
    }
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
  add(...segments: Segment[]): Segment | Segment[] {
    if (segments.length > 1) {
      // 複数Segmentを追加
      return this._add(segments);
    } else {
      // 単一Segmentを追加
      return this._add(segments)[0];
    }
  }

  /**
   * 指定位置にセグメントを挿入
   * @param index 挿入位置
   * @param segment 挿入するセグメント
   */
  insert(index: number, ...segments: Segment[]): Segment[] {
    if (segments.length > 1) {
      // 複数Segmentを挿入
      return this._add(segments, index);
    } else {
      // 単一Segmentを挿入
      return this._add([segments[0]], index);
    }
  }

  addSegment(segment: Segment): Segment {
    return this._add([segment])[0];
  }

  insertSegment(index: number, segment: Segment) {
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
  removeSegments(start: number = 0, end?: number, _includeCurves?: boolean): SegmentsWithCurves {
    start = start || 0;
    end = end !== undefined ? end : this._segments.length;
    var segments = this._segments,
      curves = this._curves,
      count = segments.length, // segment count before removal
      removed: SegmentsWithCurves = segments.splice(start, end! - start),
      amount = removed.length;
    if (!amount) return removed;
    // Update selection state accordingly
    for (var i = 0; i < amount; i++) {
      var segment = removed[i];
      // Clear the indices and path references of the removed segments
      segment._index = segment._path = null;
    }
    // Adjust the indices of the segments above.
    for (var i = start, l = segments.length; i < l; i++) segments[i]._index = i;
    // Keep curves in sync
    if (curves) {
      // If we're removing the last segment, remove the last curve (the
      // one to the left of the segment, not to the right, as normally).
      // Also take into account closed paths, which have one curve more
      // than segments.
      var index = start > 0 && end === count + (this._closed ? 1 : 0) ? start - 1 : start,
        splicedCurves = curves.splice(index, amount);
      // Unlink the removed curves from the path.
      for (var i = splicedCurves.length - 1; i >= 0; i--) splicedCurves[i]._path = null;
      // Return the removed curves as well, if we're asked to include
      // them, but exclude the first curve, since that's shared with the
      // previous segment and does not connect the returned segments.
      if (_includeCurves) removed._curves = curves.slice(1);
      // Adjust segments for the curves before and after the removed ones
      this._adjustCurves(index, index);
    }
    // Use SEGMENTS notification instead of GEOMETRY since curves are kept
    // up-to-date by _adjustCurves() and don't need notification.
    this._changed(/*#=*/ Change.SEGMENTS);
    return removed;
  }

  /**
   * すべてのセグメントを削除
   */
  clear(): void {
    this._curves = null;
    this.removeSegments();
  }

  // --- サブパス操作 ---

  /**
   * 新しい位置にパスを移動（既存のセグメントをクリアして新しいセグメントを追加）
   * @param point 移動先の点
   */
  moveTo(point: Point): Path {
    if (this._segments.length === 1)
      this.removeSegment(0);
    // Let's not be picky about calling moveTo() when not at the
    // beginning of a path, just bail out:
    if (!this._segments.length)
        this._add([ new Segment(point) ]);
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

  getCurrentSegment() {
    var segments = this._segments;
    if (!segments.length)
        throw new Error('Use a moveTo() command first');
    return segments[segments.length - 1];
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
    to: Point
  ): Path {
    // First modify the current segment:
    const current = this.getCurrentSegment();
    // Convert to relative values:
    current.setHandleOut(handle1.subtract(current._point.toPoint()));
    // And add the new segment, with handleIn set to c2
    this._add([new Segment(to, handle2.subtract(to))]);
    return this;
  }

  quadraticCurveTo(handle: Point, to: Point): Path {
    const current = this.getCurrentSegment()._point;
    // This is exact:
    // If we have the three quad points: A E D,
    // and the cubic is A B C D,
    // B = E + 1/3 (A - E)
    // C = E + 1/3 (D - E)
    this.cubicCurveTo(
      handle.add(current.subtract(SegmentPoint.fromPoint(handle)).multiply(1 / 3)),
      handle.add(to.subtract(handle).multiply(1 / 3)),
      to
    );
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
    this._changed(Change.SEGMENTS);
    return this;
  }

  /**
   * パスを閉じる（paper.js互換）
   * @param tolerance 許容誤差
   */
  closePath(tolerance: number): void {
    this.setClosed(true);
    this.join(this, tolerance);
  }

  join(path: Path, tolerance: number) {
    var epsilon = tolerance || 0;
    if (path && path !== this) {
        var segments = path._segments,
            last1 = this.getLastSegment(),
            last2 = path.getLastSegment();
        if (!last2) // an empty path?
            return this;
        if (last1 && last1._point.isClose(last2._point, epsilon))
            path.reverse();
        var first2 = path.getFirstSegment();
        if (last1 && last1._point.isClose(first2!._point, epsilon)) {
            last1.setHandleOut(first2!._handleOut.toPoint());
            this._add(segments.slice(1));
        } else {
            var first1 = this.getFirstSegment();
            if (first1 && first1._point.isClose(first2!._point, epsilon))
                path.reverse();
            last2 = path.getLastSegment();
            if (first1 && first1._point.isClose(last2!._point, epsilon)) {
                first1.setHandleIn(last2!._handleIn.toPoint());
                // Prepend all segments from path except the last one.
                this._add(segments.slice(0, segments.length - 1), 0);
            } else {
                this._add(segments.slice());
            }
        }
        if (path._closed)
            this._add([segments[0]]);
        path._remove(true, true);
    }
    // If the first and last segment touch, close the resulting path and
    // merge the end segments. Also do this if no path argument was provided
    // in which cases the path is joined with itself only if its ends touch.
    var first = this.getFirstSegment(),
        last = this.getLastSegment();
    if (first !== last && first!._point.isClose(last!._point, epsilon)) {
        first!.setHandleIn(last!._handleIn.toPoint());
        last!.remove();
        this.setClosed(true);
    }
    return this;
  }

  /**
   * 円弧を描画する
   * arcTo(through, to) - 現在の点から、指定された中間点を通って、指定された終点までの円弧を描画
   * @returns 円弧が追加されたパス（this）
   */
  /**
   * 円弧を描画する
   * @param through
   * @param to 終点
   * @returns 円弧が追加されたパス（this）
   */
  arcTo(through: Point, to: Point): Path {
    PathArc.arcTo(this, through, to);
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
    this._changed(Change.GEOMETRY);
    return this;
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
  splitAt(location: CurveLocation): Path | null {
    this._curves = null;
    const result = splitPathAt(this, location);
    this._changed(Change.GEOMETRY);
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
   * パスの内部点を取得する
   * paper.jsのgetInteriorPoint()メソッドを移植
   * @returns パス内部の点
   */
  getInteriorPoint(): Point {
    const bounds = this.getBounds(null, {});
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
   * パスの向きを反転させる
   * paper.jsのPath.reverse()を移植
   * @returns このパス
   */
  reverse(): Path {
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
    this._changed(Change.GEOMETRY);
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
    return toPathData(this, Matrix.identity(), 5);
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
    const bounds1 = this.getBounds(null, {});
    const bounds2 = path.getBounds(null, {});
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
    return toPathData(this, Matrix.identity(), 5);
  }

  set pathData(val: string) {
    const path = fromPathData(val);
    this.setSegments(path.getSegments());
    this.setClosed(path.closed);
  }

  static fromPathData(val: string): Path {
    return fromPathData(val);
  }

  /**
   * toString() でSVGパスデータを返す（paper.js互換）
   */
  toString(): string {
    return this.getPathData();
  }

  getChildren(): PathItemBase[] | null {
    return null;
  }

  _changed(flags) {
    super._changed(flags);
    if (flags & /*#=*/ChangeFlag.GEOMETRY) {
        this._length = this._area = undefined;
        if (flags & /*#=*/ChangeFlag.SEGMENTS) {
            this._version++; // See CurveLocation
        } else if (this._curves) {
            // Only notify all curves if we're not told that only segments
            // have changed and took already care of notifications.
           for (var i = 0, l = this._curves.length; i < l; i++)
                this._curves[i]._changed();
        }
    } else if (flags & /*#=*/ChangeFlag.STROKE) {
        // TODO: We could preserve the purely geometric bounds that are not
        // affected by stroke: _bounds.bounds and _bounds.handleBounds
        this._bounds = undefined;
    }
  }


}
