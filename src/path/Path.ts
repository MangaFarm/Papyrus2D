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
import { PathItemBase, type BoundsEntry, type BoundsOptions } from './PathItemBase';
import { PathArc } from './PathArc';
import { ChangeFlag, Change } from './ChangeFlag';
import { computeBounds, contains, getArea } from './PathGeometry';
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

  _segments: Segment[];
  _closed: boolean;
  _curves: Curve[] | null;
  _length?: number;
  _area?: number;

  constructor(segments: Segment[] = [], closed: boolean = false) {
    super();
    this._segments = [];
    this._closed = closed;
    this._curves = null;
    this._analysis = new PathAnalysis();

    if (segments.length > 0) {
      this.setSegments(segments);
    }
  }

  get segmentCount(): number {
    return this._segments.length;
  }

  getSegments(): Segment[] {
    return this._segments;
  }

  setSegments(segments: Segment[]): void {
    this._curves = null;
    this._segments.length = 0;

    if (segments && segments.length) {
      this._add(segments);
    }
  }

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

  addSegments(segments: Segment[]): Segment[] {
    return this._add(segments);
  }

  getFirstSegment(): Segment | undefined {
    return this._segments[0];
  }

  getLastSegment(): Segment | undefined {
    return this._segments[this._segments.length - 1];
  }

  isClosed(): boolean {
    return this._closed;
  }

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

  getArea(): number {
    if (this._area == null) {
      this._area = getArea(this._segments, this._closed);
    }

    return this._area!;
  }

  isClockwise(): boolean {
    return this.getArea() >= 0;
  }

  _getBounds(matrix: Matrix | null, options: BoundsOptions): BoundsEntry {
      return { rect: this.getBounds(matrix, options) };
  }

  getBounds(matrix: Matrix | null, options: BoundsOptions): Rectangle {
    let bounds = this._computeBounds(0);
    if (matrix) {
      bounds = bounds.transform(matrix);
    }
    return bounds;
  }

  getStrokeBounds(strokeWidth: number, matrix?: Matrix | null): Rectangle {
    // strokeWidth/2をpaddingとしてAABB拡張
    let bounds = this._computeBounds(strokeWidth / 2);

    // 行列変換がある場合は適用
    if (matrix) {
      bounds = bounds.transform(matrix);
    }

    return bounds;
  }

  private _computeBounds(padding: number): Rectangle {
    return computeBounds(this._segments, this._closed, padding);
  }

  getPointAt(t: number): Point {
    const loc = this.getLocationAt(t);
    return loc ? loc.getPoint() : new Point(0, 0);
  }

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

  getOffsetOf(point: Point): number | null {
    const loc = this.getLocationOf(point);
    return loc ? loc.getOffset() : null;
  }

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

  contains(
    point: Point,
    options?: {
      rule?: 'evenodd' | 'nonzero';
    }
  ): boolean {
    return contains(this._segments, this._closed, this.getCurves(), point, options);
  }

  transform(matrix: Matrix): Path {
    this._matrix = matrix;
    this._matrixDirty = true;
    this._length = this._area = undefined;
    this._bounds = undefined;
    return this;
  }

  translate(dx: number, dy: number): Path {
    if (!this._matrix) {
      this._matrix = Matrix.identity();
    }
    this._matrix = this._matrix.translate(dx, dy);
    this._matrixDirty = true;
    this._length = this._area = undefined;
    this._bounds = undefined;
    return this;
  }

  rotate(angle: number, center?: Point): Path {
    if (!this._matrix) {
      this._matrix = Matrix.identity();
    }
    this._matrix = this._matrix.rotate(angle, center);
    this._matrixDirty = true;
    this._length = this._area = undefined;
    this._bounds = undefined;
    return this;
  }

  scale(sx: number, sy?: number, center?: Point): Path {
    if (!this._matrix) {
      this._matrix = Matrix.identity();
    }
    this._matrix = this._matrix.scale(sx, sy, center);
    this._matrixDirty = true;
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

  getFirstCurve(): Curve | undefined {
    const curves = this.getCurves();
    return curves.length > 0 ? curves[0] : undefined;
  }

  getLastCurve(): Curve | undefined {
    const curves = this.getCurves();
    return curves.length > 0 ? curves[curves.length - 1] : undefined;
  }

  add(...segments: Segment[]): Segment | Segment[] {
    if (segments.length > 1) {
      // 複数Segmentを追加
      return this._add(segments);
    } else {
      // 単一Segmentを追加
      return this._add(segments)[0];
    }
  }

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

  removeSegment(index: number): Segment | null {
    return this.removeSegments(index, index + 1)[0] || null;
  }

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

  clear(): void {
    this._curves = null;
    this.removeSegments();
  }

  moveTo(point: Point): Path {
    if (this._segments.length === 1)
      this.removeSegment(0);
    // Let's not be picky about calling moveTo() when not at the
    // beginning of a path, just bail out:
    if (!this._segments.length)
        this._add([ new Segment(point) ]);
    return this;
  }

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

  smooth(options?: {
    type?: 'asymmetric' | 'continuous';
    from?: number | Segment;
    to?: number | Segment;
  }): Path {
    // PathUtils.ts に切り出した smoothPath を呼び出す
    return smoothPath(this, options);
  }

  close(): Path {
    this._closed = true;
    this._changed(Change.SEGMENTS);
    return this;
  }

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

  arcTo(through: Point, to: Point): Path {
    PathArc.arcTo(this, through, to);
    return this;
  }

  hasHandles(): boolean {
    const segments = this._segments;
    for (let i = 0, l = segments.length; i < l; i++) {
      if (segments[i].hasHandles()) {
        return true;
      }
    }
    return false;
  }

  clearHandles(): Path {
    const segments = this._segments;
    for (let i = 0, l = segments.length; i < l; i++) {
      segments[i].clearHandles();
    }
    this._changed(Change.GEOMETRY);
    return this;
  }

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

  isStraight(): boolean {
    if (this._segments.length !== 2) {
      return false;
    }
    return !this.hasHandles();
  }

  splitAt(location: CurveLocation): Path | null {
    this._curves = null;
    const result = splitPathAt(this, location);
    this._changed(Change.GEOMETRY);
    return result;
  }

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

  clone(deep: boolean = false): Path {
    // 新しいパスを作成
    const segments = this.getSegments().map((segment) => segment.clone());
    const clonedPath = new Path(segments, this.closed);

    // 属性をコピー
    clonedPath.copyAttributes(this);

    return clonedPath;
  }

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

  simplify(tolerance?: number): boolean {
    // PathFitterを使用してパスを単純化
    const segments = new PathFitter(this).fit(tolerance || 2.5);

    // 単純化に成功した場合、新しいセグメントをパスに設定
    if (segments) {
      this.setSegments(segments);
    }

    return !!segments;
  }

  isEmpty(): boolean {
    // セグメントがない場合は空
    return this._segments.length === 0;
  }

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

  reduce(options?: { simplify?: boolean }): PathItem {
    return reducePath(this, options);
  }

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

  getPaths(): Path[] {
    return [this];
  }

  resolveCrossings(): PathItem {
    return resolveCrossings(this);
  }

  reorient(nonZero?: boolean, clockwise?: boolean): PathItem {
    if (clockwise !== undefined) {
      this.setClockwise(clockwise);
    }
    return this;
  }

  getPathData(): string {
    // PathSVG.tsに外注
    return toPathData(this, Matrix.identity(), 5);
  }

  compare(path: Path): boolean {
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

  setFirstSegment(seg: Segment): void {
    const segments = this.getSegments();
    const idx = segments.indexOf(seg);
    if (idx > 0) {
      const rotated = segments.slice(idx).concat(segments.slice(0, idx));
      this.setSegments(rotated);
    }
  }

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
