/**
 * Path クラス
 * Paper.js の Path (src/path/Path.js) を参考にしたミュータブルなパス表現。
 * segments 配列と closed フラグを持ち、PathItemBase クラスを継承する。
 */

import type { PathItem } from './PathItem';
import { Point } from '../basic/Point';
import { Rectangle } from '../basic/Rectangle';
import { Matrix } from '../basic/Matrix';
import { Line } from '../basic/Line';
import { Curve } from './Curve';
import { CurveLocation } from './CurveLocation';
import { Segment } from './Segment';
import { SegmentPoint } from './SegmentPoint';
import { PathItemBase, type BoundsEntry, type BoundsOptions } from './PathItemBase';
import { ChangeFlag, Change } from './ChangeFlag';
import { PathConstructors } from './PathConstructors';
import { PathAnalysis } from './PathAnalysis';
import type { StrokeJoin, StrokeCap } from './Style';
import * as PathGeometry from './PathGeometry';
import * as PathSVG from './PathSVG';
import * as PathReduce from './PathReduce';
import * as PathUtils from './PathUtils';
import * as PathBooleanResolveCrossings from './PathBooleanResolveCrossings';
import * as PathBoolean from './PathBoolean';
import * as PathComponents from './PathComponents';
import * as PathTransform from './PathTransform';
import * as PathArc from './PathArc';

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
    return PathComponents.insertSegments(this, segs, index);
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
      this._length = PathGeometry.getPathLength(this.getCurves());
    }
    return this._length!;
  }

  getArea(): number {
    if (this._area == null) {
      this._area = PathGeometry.getPathArea(this._segments, this._closed);
    }

    return this._area!;
  }

  isClockwise(): boolean {
    return this.getArea() >= 0;
  }

  _getBounds(matrix: Matrix | null, options: BoundsOptions): BoundsEntry {
    if (options.handle) {
      throw new Error('Path#getBounds: handle option is not supported');
    } else if (options.stroke) {
      return {
        rect: Path.getStrokeBounds(this._segments, this._closed, this, matrix, options)
      };
    } else {
      return {
        rect: Path.getBounds(this._segments, this._closed, this, matrix, options)
      };
    }
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
    // NOTICE: 外だしして挙動を完全に一致させるのは困難と判断(offsets, getLengthあたり)
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
    return new Point(0, 0);
  }

  contains(
    point: Point,
    options?: {
      rule?: 'evenodd' | 'nonzero';
    }
  ): boolean {
    return PathGeometry.contains(this._segments, this._closed, this.getCurves(), point, options);
  }

  transform(matrix: Matrix): Path {
    return PathTransform.transform(this, matrix);
  }

  translate(dx: number, dy: number): Path {
    return PathTransform.translate(this, dx, dy);
  }

  rotate(angle: number, center?: Point): Path {
    return PathTransform.rotate(this, angle, center);
  }

  scale(sx: number, sy?: number, center?: Point): Path {
    return PathTransform.scale(this, sx, sy, center);
  }

  _countCurves(): number {
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
    return PathComponents.removeSegments(this, start, end, _includeCurves);
  }

  clear(): void {
    this._curves = null;
    this.removeSegments();
  }

  moveTo(point: Point): Path {
    if (this._segments.length === 1) this.removeSegment(0);
    // Let's not be picky about calling moveTo() when not at the
    // beginning of a path, just bail out:
    if (!this._segments.length) this._add([new Segment(point)]);
    return this;
  }

  lineTo(point: Point): Path {
    this.add(new Segment(point));
    return this;
  }

  getCurrentSegment() {
    var segments = this._segments;
    if (!segments.length) throw new Error('Use a moveTo() command first');
    return segments[segments.length - 1];
  }

  cubicCurveTo(handle1: Point, handle2: Point, to: Point): Path {
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
    return PathUtils.smoothPath(this, options);
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
    PathBoolean.join(this, path, tolerance);
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
    const result = PathUtils.splitPathAt(this, location);
    this._changed(Change.GEOMETRY);
    return result;
  }

  equals(path: Path): boolean {
    return PathUtils.equalPath(this, path);
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
    return PathUtils.flattenPath(this, flatness);
  }

  simplify(tolerance: number = 2.5): boolean {
    return PathUtils.simplifyPath(this, tolerance);
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
    return PathReduce.reducePath(this, options);
  }

  reverse(): Path {
    return PathUtils.reversePath(this);
  }

  getPaths(): Path[] {
    return [this];
  }

  resolveCrossings(): PathItem {
    return PathBooleanResolveCrossings.resolveCrossings(this);
  }

  reorient(_nonZero?: boolean, clockwise?: boolean): PathItem {
    // paper.jsだとCompoundPathと一緒だったので分離
    if (clockwise !== undefined) {
      this.setClockwise(clockwise);
    }
    return this;
  }

  getPathData(matrix: Matrix = Matrix.identity(), precision: number = 5): string {
    // PathSVG.tsに外注
    return PathSVG.toPathData(this, matrix, precision);
  }

  compare(path: Path): boolean {
    return PathUtils.comparePath(this, path);
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
    return PathSVG.toPathData(this, Matrix.identity(), 5);
  }

  set pathData(val: string) {
    const path = PathSVG.fromPathData(val);
    this.setSegments(path.getSegments());
    this.setClosed(path.closed);
  }

  static fromPathData(val: string): Path {
    return PathSVG.fromPathData(val);
  }

  toString(): string {
    return this.getPathData();
  }

  getChildren(): null {
    return null;
  }

  _changed(flags) {
    super._changed(flags);
    if (flags & /*#=*/ ChangeFlag.GEOMETRY) {
      this._length = this._area = undefined;
      if (flags & /*#=*/ ChangeFlag.SEGMENTS) {
        this._version++; // See CurveLocation
      } else if (this._curves) {
        // Only notify all curves if we're not told that only segments
        // have changed and took already care of notifications.
        for (var i = 0, l = this._curves.length; i < l; i++) this._curves[i]._changed();
      }
    } else if (flags & /*#=*/ ChangeFlag.STROKE) {
      // TODO: We could preserve the purely geometric bounds that are not
      // affected by stroke: _bounds.bounds and _bounds.handleBounds
      this._bounds = undefined;
    }
  }

  static _getStrokePadding(radius: number, matrix: Matrix | null) {
    if (!matrix) return [radius, radius];

    // If a matrix is provided, we need to rotate the stroke circle
    // and calculate the bounding box of the resulting rotated ellipse:
    // Get rotated hor and ver vectors, and determine rotation angle
    // and ellipse values from them:
    var hor = new Point(radius, 0).transform(matrix),
      ver = new Point(0, radius).transform(matrix),
      phi = hor.getAngleInRadians(),
      a = hor.getLength(),
      b = ver.getLength();
    var sin = Math.sin(phi),
      cos = Math.cos(phi),
      tan = Math.tan(phi),
      tx = Math.atan2(b * tan, a),
      ty = Math.atan2(b, tan * a);
    // Due to symmetry, we don't need to cycle through pi * n solutions:
    return [
      Math.abs(a * Math.cos(tx) * cos + b * Math.sin(tx) * sin),
      Math.abs(b * Math.sin(ty) * cos + a * Math.cos(ty) * sin),
    ];
  }

  static getStrokeBounds(
    segments: Segment[],
    closed: boolean,
    path: Path,
    matrix: Matrix | null,
    options: BoundsOptions
  ) {
    var style = path.getStyle(),
      stroke = style.hasStroke(),
      strokeWidth = style.getStrokeWidth(),
      strokeMatrix: Matrix | null = stroke ? path._getStrokeMatrix(matrix, options) : null,
      strokePadding = stroke ? Path._getStrokePadding(strokeWidth, strokeMatrix) : undefined,
      // Start with normal path bounds with added stroke padding. Then we
      // only need to look at each segment and handle join / cap / miter.
      bounds = Path.getBounds(segments, closed, path, matrix, options, strokePadding);
    if (!stroke) return bounds;
    var strokeRadius = strokeWidth / 2,
      join = style.getStrokeJoin(),
      cap = style.getStrokeCap(),
      miterLimit = style.getMiterLimit(),
      // Create a rectangle of padding size, used for union with bounds
      // further down
      joinBounds = new Rectangle(0, 0, strokePadding![0], strokePadding![1]);

    // helper function that is passed to _addBevelJoin() and _addSquareCap()
    // to handle the point transformations.
    function addPoint(point: Point) {
      bounds = bounds.include(point);
    }

    function addRound(segment: Segment) {
      joinBounds = joinBounds.moveCenter(segment._point.toPoint().transform(matrix));
      bounds = bounds.unite(joinBounds);
    }

    function addJoin(segment: Segment, join: StrokeJoin) {
      // When both handles are set in a segment and they are collinear,
      // the join setting is ignored and round is always used.
      if (join === 'round' || segment.isSmooth()) {
        addRound(segment);
      } else {
        // _addBevelJoin() handles both 'bevel' and 'miter' joins.
        Path._addBevelJoin(segment, join, strokeRadius, miterLimit, matrix, strokeMatrix, addPoint, false);
      }
    }

    function addCap(segment, cap) {
      if (cap === 'round') {
        addRound(segment);
      } else {
        // _addSquareCap() handles both 'square' and 'butt' caps.
        Path._addSquareCap(segment, cap, strokeRadius, matrix, strokeMatrix, addPoint, false);
      }
    }

    var length = segments.length - (closed ? 0 : 1);
    if (length > 0) {
      for (var i = 1; i < length; i++) {
        addJoin(segments[i], join);
      }
      if (closed) {
        // Go back to the beginning
        addJoin(segments[0], join);
      } else {
        // Handle caps on open paths
        addCap(segments[0], cap);
        addCap(segments[segments.length - 1], cap);
      }
    }
    return bounds;
  }

  static _addBevelJoin(segment: Segment, join: StrokeJoin, radius: number, miterLimit: number, matrix: Matrix | null, strokeMatrix: Matrix | null, addPoint: (point: Point) => void, isArea: boolean) {
    // Handles both 'bevel' and 'miter' joins, as they share a lot of code,
    // using different matrices to transform segment points and stroke
    // vectors to support Style#strokeScaling.
    var curve2 = segment.getCurve()!,
      curve1 = curve2.getPrevious()!,
      point = curve2.getPoint1().transform(matrix),
      normal1 = curve1.getNormalAtTime(1).multiply(radius).transform(strokeMatrix),
      normal2 = curve2.getNormalAtTime(0).multiply(radius).transform(strokeMatrix),
      angle = normal1.getDirectedAngle(normal2);
    if (angle < 0 || angle >= 180) {
      normal1 = normal1.negate();
      normal2 = normal2.negate();
    }
    if (isArea) addPoint(point);
    addPoint(point.add(normal1));
    if (join === 'miter') {
      // Intersect the two lines
      var corner = new Line(point.add(normal1), new Point(-normal1.y, normal1.x), true).intersect(
        new Line(point.add(normal2), new Point(-normal2.y, normal2.x), true),
        true
      );
      // See if we actually get a bevel point and if its distance is below
      // the miterLimit. If not, make a normal bevel.
      if (corner && point.getDistance(corner) <= miterLimit * radius) {
        addPoint(corner);
      }
    }
    // Produce a normal bevel
    addPoint(point.add(normal2));
  }

  static _addSquareCap(segment: Segment, cap: StrokeCap, radius: number, matrix: Matrix | null, strokeMatrix: Matrix | null, addPoint: (point: Point) => void, isArea: boolean) {
    // Handles both 'square' and 'butt' caps, as they share a lot of code.
    // Calculate the corner points of butt and square caps, using different
    // matrices to transform segment points and stroke vectors to support
    // Style#strokeScaling.
    var point = segment._point.toPoint().transform(matrix),
      loc = segment.getLocation()!,
      // Checking loc.getTime() for 0 is to see whether this is the first
      // or the last segment of the open path, in order to determine in
      // which direction to flip the normal.
      normal = loc
        .getNormal()!
        .multiply(loc.getTime() === 0 ? radius : -radius)
        .transform(strokeMatrix);
    // For square caps, we need to step away from point in the direction of
    // the tangent, which is the rotated normal.
    if (cap === 'square') {
      if (isArea) {
        addPoint(point.subtract(normal));
        addPoint(point.add(normal));
      }
      point = point.add(normal.rotate(-90));
    }
    addPoint(point.add(normal));
    addPoint(point.subtract(normal));
  }

  static getBounds(
    segments: Segment[],
    closed: boolean,
    path: Path,
    matrix: Matrix | null,
    options?: any,
    strokePadding?: number[]
  ): Rectangle {
    var first = segments[0];
    // If there are no segments, return "empty" rectangle, just like groups,
    // since #bounds is assumed to never return null.
    if (!first) return new Rectangle(0, 0, 0, 0);
    var coords: number[] = new Array(6),
      // Make coordinates for first segment available in prevCoords.
      prevCoords: number[] = first._transformCoordinates(matrix, new Array(6), false),
      min: number[] = prevCoords.slice(0, 2), // Start with values of first point
      max: number[] = min.slice(), // clone
      roots: number[] = new Array(2);

    function processSegment(segment) {
      segment._transformCoordinates(matrix, coords);
      for (var i = 0; i < 2; i++) {
        Curve._addBounds(
          prevCoords[i], // prev.point
          prevCoords[i + 4], // prev.handleOut
          coords[i + 2], // segment.handleIn
          coords[i], // segment.point,
          i,
          strokePadding ? strokePadding[i] : 0,
          min,
          max,
          roots
        );
      }
      // Swap coordinate buffers.
      var tmp = prevCoords;
      prevCoords = coords;
      coords = tmp;
    }

    for (var i = 1, l = segments.length; i < l; i++) processSegment(segments[i]);
    if (closed) processSegment(first);
    return new Rectangle(min[0], min[1], max[0] - min[0], max[1] - min[1]);
  }
}
