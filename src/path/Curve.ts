/**
 * Curve: 2つのSegment（またはSegmentPoint）で定義される三次ベジェ曲線
 * paper.jsのCurveクラスAPIを参考に設計
 * ミュータブル設計
 */

import { Segment } from './Segment';
import { Line } from '../basic/Line';
import { Point } from '../basic/Point';
import { Matrix } from '../basic/Matrix';
import { Rectangle } from '../basic/Rectangle';
import { getIntersections } from './CurveIntersectionMain';
import { CurveCalculation } from './CurveCalculation';
import { CurveGeometry } from './CurveGeometry';
import { CurveSubdivision } from './CurveSubdivision';
import { CurveLocationUtils } from './CurveLocationUtils';
import { CurveLocation } from './CurveLocation';
import { Numerical } from '../util/Numerical';
import { Path } from './Path';
import { getSelfIntersection } from './CurveIntersectionBase';
import { getCurveIntersections } from './CurveIntersectionMain';

export class Curve {
  _segment1: Segment;
  _segment2: Segment;

  _path: Path | null;
  _length: number | undefined;
  _bounds: { getBounds?: Rectangle } | undefined;

  get point1(): Point {
    return this._segment1.getPoint();
  }
  get point2(): Point {
    return this._segment2.getPoint();
  }

  constructor(path: Path | null, segment1: Segment | null, segment2: Segment | null) {
    this._path = path;
    this._segment1 = segment1 || new Segment(new Point(0, 0));
    this._segment2 = segment2 || new Segment(new Point(0, 0));
  }

  getPrevious(): Curve | null {
    const curves = this._path && this._path._curves;
    return (
      (curves &&
        (curves[this._segment1._index! - 1] ||
          (this._path!._closed && curves[curves.length - 1]))) ||
      null
    );
  }

  getNext(): Curve | null {
    const curves = this._path && this._path._curves;
    return (
      (curves && (curves[this._segment1._index! + 1] || (this._path!._closed && curves[0]))) || null
    );
  }

  getPoint1(): Point {
    return this._segment1.getPoint();
  }
  getPoint2(): Point {
    return this._segment2.getPoint();
  }

  getIndex(): number {
    return this._segment1._index!;
  }

  hasHandles(): boolean {
    return !this._segment1._handleOut.isZero() || !this._segment2._handleIn.isZero();
  }

  getLength(): number {
    if (this._length == null) {
      this._length = Curve.getLength(this.getValues(), 0, 1);
    }
    return this._length;
  }

  getValues(matrix?: Matrix | null): number[] {
    return Curve.getValues(this._segment1, this._segment2, matrix ?? null, false);
  }

  getPointAtTime(t: number): Point {
    // tは0-1範囲で呼ばれる前提
    return Curve.getPoint(this.getValues(), t);
  }

  getTangentAtTime(t: number): Point {
    return CurveCalculation.getTangent(this.getValues(), t)!;
  }

  getNormalAtTime(t: number): Point {
    return CurveCalculation.getNormal(this.getValues(), t)!;
  }

  getWeightedTangentAtTime(t: number): Point {
    return CurveCalculation.getWeightedTangent(this.getValues(), t)!;
  }

  getWeightedNormalAtTime(t: number): Point {
    return CurveCalculation.getWeightedNormal(this.getValues(), t)!;
  }

  getCurvatureAtTime(t: number): number {
    return CurveCalculation.getCurvature(this.getValues(), t);
  }

  getTimesWithTangent(tangent: Point): number[] {
    return tangent.isZero() ? [] : CurveCalculation.getTimesWithTangent(this.getValues(), tangent);
  }

  getLocationAtTime(t: number): CurveLocation {
    // tは0-1範囲で呼ばれる前提
    return new CurveLocation(this, t);
  }

  getTimeOf(point: Point): number | null {
    return Curve.getTimeOf(this.getValues(), point);
  }

  getTimeAt(offset: number, start?: number): number | null {
    return Curve.getTimeAt(this.getValues(), offset, start);
  }

  getPartLength(from?: number, to?: number): number {
    return Curve.getLength(this.getValues(), from, to);
  }

  getOffsetAtTime(time: number): number {
    return this.getPartLength(0, time);
  }

  _changed(): void {
    // キャッシュをクリア
    this._length = undefined;
    this._bounds = undefined;
  }

  clearHandles(): void {
    if (this._segment1) this._segment1.clearHandles();
    if (this._segment2) this._segment2.clearHandles();
  }

  isStraight(epsilon?: number): boolean {
    // CurveGeometryのisStraightメソッドを使用
    return CurveGeometry.isStraight(this.getValues());
  }

  hasLength(epsilon?: number): boolean {
    // paper.js: (!this.getPoint1().equals(this.getPoint2()) || this.hasHandles()) && this.getLength() > (epsilon || 0)
    return (
      (!this.getPoint1().equals(this.getPoint2()) || this.hasHandles()) &&
      this.getLength() > (epsilon || 0)
    );
  }

  isLinear(epsilon?: number): boolean {
    // CurveGeometryのisLinearメソッドを使用
    return CurveGeometry.isLinear(this.getValues());
  }

  getBounds(matrix?: Matrix | null): Rectangle {
    if (!this._bounds) {
      this._bounds = {};
    }

    let bounds = this._bounds.getBounds;
    if (!bounds) {
      // 曲線の値を取得
      const values = this.getValues(matrix);
      // 境界ボックスを計算
      bounds = Curve.getBounds(values);
      this._bounds.getBounds = bounds;
    }

    return bounds.clone();
  }

  static isStraight(v: number[], epsilon?: number): boolean {
    return CurveGeometry.isStraight(v);
  }

  static getTimeOf(v: number[], point: Point): number | null {
    return CurveLocationUtils.getTimeOf(v, point);
  }

  static isLinear(v: number[]): boolean {
    return CurveGeometry.isLinear(v);
  }

  static getPoint(v: number[], t: number): Point {
    return CurveCalculation.evaluate(v, t, 0, false)!;
  }

  static getArea(v: number[]): number {
    return CurveGeometry.getArea(v);
  }

  static getLength(v: number[], a?: number, b?: number, ds?: (t: number) => number): number {
    return CurveGeometry.getLength(v, a, b, ds);
  }

  static getValues(
    segment1: Segment,
    segment2: Segment,
    matrix: Matrix | null,
    straight: boolean
  ): number[] {
    return CurveSubdivision.getValues(segment1, segment2, matrix, straight);
  }

  static subdivide(v: number[], t?: number): [number[], number[]] {
    return CurveSubdivision.subdivide(v, t !== undefined ? t : 0.5);
  }

  static isFlatEnough(v: number[], flatness: number): boolean {
    // 曲線の制御点
    const x0 = v[0],
      y0 = v[1];
    const x1 = v[2],
      y1 = v[3];
    const x2 = v[4],
      y2 = v[5];
    const x3 = v[6],
      y3 = v[7];

    // 曲線の端点を結ぶ直線からの最大距離を計算
    const ux = 3 * x1 - 2 * x0 - x3;
    const uy = 3 * y1 - 2 * y0 - y3;
    const vx = 3 * x2 - 2 * x3 - x0;
    const vy = 3 * y2 - 2 * y3 - y0;

    return Math.max(ux * ux, vx * vx) + Math.max(uy * uy, vy * vy) <= 16 * flatness * flatness;
  }

  static getTimeAt(v: number[], offset: number, start?: number): number | null {
    return CurveLocationUtils.getTimeAt(v, offset, start);
  }

  static getIntersections(
    curves1: Curve[],
    curves2: Curve[] | null = null,
    include: (loc: CurveLocation) => boolean,
    matrix1?: Matrix | null,
    matrix2?: Matrix | null,
    _returnFirst?: boolean
  ): CurveLocation[] {
    // CurveIntersectionMainモジュールの関数を使用
    return getIntersections(curves1, curves2, include, matrix1, matrix2, _returnFirst);
  }

  getNearestLocation(point: Point): CurveLocation {
    const values = this.getValues();
    const t = Curve.getNearestTime(values, point);
    const pt = Curve.getPoint(values, t);
    return new CurveLocation(this, t, pt, null, point.subtract(pt).getLength());
  }

  getNearestPoint(point: Point): Point {
    const loc = this.getNearestLocation(point);
    return loc.getPoint();
  }

  getIntersections(curve: Curve | null): CurveLocation[] {
    const v1 = this.getValues();
    const v2 = curve && curve !== this && curve.getValues();
    return v2
      ? getCurveIntersections(v1, v2, this, curve, [], c => true)
      : getSelfIntersection(v1, this, [], c => true);
  }

  static getNearestTime(v: number[], point: Point): number {
    if (Curve.isStraight(v)) {
      const x0 = v[0],
        y0 = v[1],
        x3 = v[6],
        y3 = v[7],
        vx = x3 - x0,
        vy = y3 - y0,
        det = vx * vx + vy * vy;
      // ゼロ除算を避ける
      if (det === 0) return 0;
      // 点を直線に投影し、線形パラメータuを計算: u = (point - p1).dot(v) / v.dot(v)
      const u = ((point.x - x0) * vx + (point.y - y0) * vy) / det;
      if (u < Numerical.EPSILON) return 0;
      if (u > 1 - Numerical.EPSILON) return 1;

      const timeOf = Curve.getTimeOf(v, new Point(x0 + u * vx, y0 + u * vy));
      return timeOf !== null ? timeOf : 0;
    }

    const count = 100;
    let minDist = Infinity;
    let minT = 0;

    function refine(t: number): boolean {
      if (t >= 0 && t <= 1) {
        const pt = Curve.getPoint(v, t);
        const dist = point.subtract(pt).getLength();
        const squaredDist = dist * dist;
        if (squaredDist < minDist) {
          minDist = squaredDist;
          minT = t;
          return true;
        }
      }
      return false;
    }

    for (let i = 0; i <= count; i++) refine(i / count);

    // 精度を上げるために反復的に解を改良
    let step = 1 / (count * 2);
    while (step > Numerical.CURVETIME_EPSILON) {
      if (!refine(minT - step) && !refine(minT + step)) step /= 2;
    }
    return minT;
  }

  static solveCubic(
    v: number[],
    coord: number,
    val: number,
    roots: number[],
    min: number,
    max: number
  ): number {
    // CurveLocationUtils.solveCubicを呼び出すだけ
    return CurveLocationUtils.solveCubic(v, coord, val, roots, { min, max });
  }

  static getTangent(v: number[], t: number): Point {
    return CurveCalculation.getTangent(v, t)!;
  }

  static getBounds(v: number[]): Rectangle {
    const min = v.slice(0, 2); // 始点の値をコピー
    const max = min.slice(); // クローン
    const roots = [0, 0];

    // x座標とy座標それぞれについて境界を計算
    for (let i = 0; i < 2; i++) {
      Curve._addBounds(v[i], v[i + 2], v[i + 4], v[i + 6], i, 0, min, max, roots);
    }

    return new Rectangle(min[0], min[1], max[0] - min[0], max[1] - min[1]);
  }

  static _addBounds(
    v0: number,
    v1: number,
    v2: number,
    v3: number,
    coord: number,
    padding: number,
    min: number[],
    max: number[],
    roots: number[]
  ): void {
    function add(value: number, padding: number): void {
      const left = value - padding;
      const right = value + padding;
      if (left < min[coord]) {
        min[coord] = left;
      }
      if (right > max[coord]) {
        max[coord] = right;
      }
    }

    padding /= 2; // strokePaddingは幅であり、半径ではない
    const minPad = min[coord] + padding;
    const maxPad = max[coord] - padding;

    if (
      v0 < minPad ||
      v1 < minPad ||
      v2 < minPad ||
      v3 < minPad ||
      v0 > maxPad ||
      v1 > maxPad ||
      v2 > maxPad ||
      v3 > maxPad
    ) {
      if (v1 < v0 != v1 < v3 && v2 < v0 != v2 < v3) {
        add(v0, 0);
        add(v3, 0);
      } else {
        const a = 3 * (v1 - v2) - v0 + v3;
        const b = 2 * (v0 + v2) - 4 * v1;
        const c = v1 - v0;
        const count = Numerical.solveQuadratic(a, b, c, roots);
        const tMin = Numerical.CURVETIME_EPSILON;
        const tMax = 1 - tMin;

        add(v3, 0);
        for (let i = 0; i < count; i++) {
          const t = roots[i];
          const u = 1 - t;
          if (tMin <= t && t <= tMax) {
            add(u * u * u * v0 + 3 * u * u * t * v1 + 3 * u * t * t * v2 + t * t * t * v3, padding);
          }
        }
      }
    }
  }

  static getPart(v: number[], from: number, to: number): number[] {
    return CurveSubdivision.getPart(v, from, to);
  }

  static getMonoCurves(v: number[], dir = false): number[][] {
    return CurveSubdivision.getMonoCurves(v, dir);
  }

  getLine(): Line {
    return new Line(this._segment1.getPoint(), this._segment2.getPoint());
  }

  remove(): boolean {
    let removed = false;
    if (this._path) {
      let segment2 = this._segment2;
      // paper.jsと同じく、常にcurve._segment2をremoveする
      const handleOut = segment2._handleOut;
      removed = segment2.remove();
      if (removed) {
        this._segment1._handleOut._set(handleOut._x, handleOut._y);
      }
    }
    return removed;
  }

  isCollinear(curve: Curve): boolean {
    // paper.js精密移植
    return (
      curve &&
      this.isStraight() &&
      curve.isStraight() &&
      this.getLine().isCollinear(curve.getLine())
    );
  }

  divideAtTime(time: number, _setHandles: boolean): Curve {
    // Only divide if not at the beginning or end.
    var tMin = /*#=*/ Numerical.CURVETIME_EPSILON,
      tMax = 1 - tMin,
      res: Curve | null = null;
    if (time >= tMin && time <= tMax) {
      var parts = Curve.subdivide(this.getValues(), time),
        left = parts[0],
        right = parts[1],
        setHandles = _setHandles || this.hasHandles(),
        seg1 = this._segment1,
        seg2 = this._segment2,
        path = this._path;
      if (setHandles) {
        // Adjust the handles on the existing segments. The new segment
        // will be inserted between the existing segment1 and segment2:
        // Convert absolute -> relative
        seg1._handleOut._set(left[2] - left[0], left[3] - left[1]);
        seg2._handleIn._set(right[4] - right[6], right[5] - right[7]);
      }
      // Create the new segment:
      const x: number = left[6],
        y: number = left[7];
      const handleOut: Point | null = setHandles ? new Point(left[4] - x, left[5] - y) : null;
      const handleIn: Point | null = setHandles ? new Point(right[2] - x, right[3] - y) : null;
      const segment: Segment = new Segment(new Point(x, y), handleOut, handleIn);

      // Insert it in the segments list, if needed:
      if (path) {
        // By inserting at seg1.index + 1, we make sure to insert at
        // the end if this curve is a closing curve of a closed path,
        // as with segment2.index it would be inserted at 0.
        path.insert(seg1._index! + 1, segment);
        // The newly inserted segment is the start of the next curve:
        res = this.getNext();
      } else {
        // otherwise create it from the result of split
        this._segment2 = segment;
        this._changed();
        res = new Curve(null, segment, seg2);
      }
    }
    return res!;
  }

  splitAtTime(time: number) {
    return this.splitAtTime(time);
  }
}
