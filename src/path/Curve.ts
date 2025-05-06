/**
 * Curve: 2つのSegment（またはSegmentPoint）で定義される三次ベジェ曲線
 * paper.jsのCurveクラスAPIを参考に設計
 * ミュータブル設計
 */

import { strict as assert } from 'assert';
import { Segment } from './Segment';
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

export class Curve {
  _segment1: Segment;
  _segment2: Segment;
  
  // Path.tsとの互換性のためのプロパティ
  _path: Path | null;
  
  // キャッシュ用プロパティ
  _length: number | undefined;
  _bounds: { getBounds?: Rectangle } | undefined;
  
  // paper.jsとの互換性のためのプロパティ
  get point1(): Point { return this._segment1.getPoint(); }
  get point2(): Point { return this._segment2.getPoint(); }

  /**
   * 曲線のコンストラクタ
   * @param path 曲線が属するパス（オプション）
   * @param segment1 最初のセグメント
   * @param segment2 2番目のセグメント
   */
  /**
   * 曲線のコンストラクタ
   * @param path 曲線が属するパス
   * @param segment1 最初のセグメント
   * @param segment2 2番目のセグメント
   */
  constructor(path: Path | null, segment1: Segment | null, segment2: Segment | null) {
    this._path = path;
    this._segment1 = segment1 || new Segment(new Point(0, 0));
    this._segment2 = segment2 || new Segment(new Point(0, 0));
  }

  getPrevious(): Curve | null {
    const curves = this._path && this._path._curves;
    return curves && (curves[this._segment1._index - 1]
            || this._path!._closed && curves[curves.length - 1]) || null;
  }

  getNext(): Curve | null {
    const curves = this._path && this._path._curves;
    return curves && (curves[this._segment1._index + 1]
            || this._path!._closed && curves[0]) || null;
  }

  /**
   * 曲線の始点を取得
   */
  getPoint1(): Point {
    return this._segment1.getPoint();
  }

  /**
   * 曲線の終点を取得
   */
  getPoint2(): Point {
    return this._segment2.getPoint();
  }

  /**
   * パス内でのこのカーブの位置を返す
   */
  getIndex(): number {
    return this._segment1._index;
  }

  /**
   * 曲線がハンドルを持っているかチェック
   */
  hasHandles(): boolean {
    return !this._segment1._handleOut.isZero() || !this._segment2._handleIn.isZero();
  }

  /**
   * 曲線長を返す
   */
  getLength(): number {
    if (this._length == null) {
      this._length = Curve.getLength(this.getValues(), 0, 1);
    }
    return this._length;
  }

  /**
   * ベジェ制御点配列 [x1, y1, h1x, h1y, h2x, h2y, x2, y2] を返す
   */
  getValues(matrix?: Matrix | null): number[] {
    return Curve.getValues(this._segment1, this._segment2, matrix ?? null, false);
  }

  /**
   * t(0-1)で指定した位置のPointを返す
   */
  getPointAt(t: number, _isTime?: boolean): Point {
    const values = this.getValues();
    const time = _isTime ? t : this.getTimeAt(t);
    return Curve.getPoint(values, time!);
  }

  /**
   * t(0-1)で指定した位置の接線ベクトルを返す
   */
  getTangentAt(t: number, _isTime?: boolean): Point {
    const values = this.getValues();
    return CurveCalculation.getTangent(values, _isTime ? t : this.getTimeAt(t)!)!;
  }
  
  /**
   * t(0-1)で指定した位置の法線ベクトルを返す
   */
  getNormalAt(t: number, _isTime?: boolean): Point {
    const values = this.getValues();
    const time = _isTime ? t : this.getTimeAt(t);
    return CurveCalculation.getNormal(values, time!)!;
  }
  
  /**
   * t(0-1)で指定した位置の重み付き接線ベクトルを返す
   */
  getWeightedTangentAt(t: number, _isTime?: boolean): Point {
    const values = this.getValues();
    const time = _isTime ? t : this.getTimeAt(t);
    return CurveCalculation.getWeightedTangent(values, time!)!;
  }
  
  /**
   * t(0-1)で指定した位置の重み付き法線ベクトルを返す
   */
  getWeightedNormalAt(t: number, _isTime?: boolean): Point {
    const values = this.getValues();
    const time = _isTime ? t : this.getTimeAt(t);
    return CurveCalculation.getWeightedNormal(values, time!)!;
  }
  
  /**
   * t(0-1)で指定した位置の曲率を返す
   */
  getCurvatureAt(t: number, _isTime?: boolean): number {
    const values = this.getValues();
    const time = _isTime ? t : this.getTimeAt(t);
    return CurveCalculation.getCurvature(values, time!);
  }

  /**
   * t(0-1)で指定した位置のPointを返す（時間パラメータ指定）
   */
  getPointAtTime(t: number): Point {
    if (t == null || isNaN(t) || t < 0 || t > 1) return new Point(0, 0);
    const values = this.getValues();
    const pt = Curve.getPoint(values, t);
    console.log(`🔥 getPointAtTime: t=${t} values=${JSON.stringify(values)} pt=${pt ? `(${pt.x},${pt.y})` : 'null'}`);
    return pt;
  }

  /**
   * t(0-1)で指定した位置の接線ベクトルを返す（時間パラメータ指定）
   */
  getTangentAtTime(t: number): Point {
    return CurveCalculation.getTangent(this.getValues(), t)!;
  }
  
  /**
   * t(0-1)で指定した位置の法線ベクトルを返す（時間パラメータ指定）
   */
  getNormalAtTime(t: number): Point {
    return CurveCalculation.getNormal(this.getValues(), t)!;
  }
  
  /**
   * t(0-1)で指定した位置の重み付き接線ベクトルを返す（時間パラメータ指定）
   */
  getWeightedTangentAtTime(t: number): Point {
    return CurveCalculation.getWeightedTangent(this.getValues(), t)!;
  }
  
  /**
   * t(0-1)で指定した位置の重み付き法線ベクトルを返す（時間パラメータ指定）
   */
  getWeightedNormalAtTime(t: number): Point {
    return CurveCalculation.getWeightedNormal(this.getValues(), t)!;
  }
  
  /**
   * t(0-1)で指定した位置の曲率を返す（時間パラメータ指定）
   */
  getCurvatureAtTime(t: number): number {
    return CurveCalculation.getCurvature(this.getValues(), t);
  }
  
  /**
   * 指定された接線に対して曲線が接する時間パラメータを計算
   */
  getTimesWithTangent(tangent: Point): number[] {
    return tangent.isZero()
      ? []
      : CurveCalculation.getTimesWithTangent(this.getValues(), tangent);
  }

  /**
   * 曲線をtで分割し、2つのCurveに分ける
   */
  divide(t?: number, isTime?: boolean): Curve | null {
    const time = t === undefined ? 0.5 : isTime ? t : this.getTimeAt(t);
    return this.divideAtTime(time!);
  }

  /**
   * tで分割し、前半部分のCurveを返す
   */
  split(t?: number, isTime?: boolean): Curve | null {
    const time = t === undefined ? 0.5 : isTime ? t : this.getTimeAt(t);
    return this.splitAtTime(time!);
  }

  /**
   * tで分割し、前半部分のCurveを返す（paper.jsとの互換性のため）
   */
  splitAt(location: number | CurveLocation): Curve | null {
    const path = this._path;
    // paper.jsのCurve#splitAtはCurveを返す。Path#splitAtではない。
    return path ? this.splitAtTime((location as CurveLocation).getTime()!) : null;
  }

  /**
   * tで分割し、前半部分のCurveを返す（paper.jsとの互換性のため）
   */
  splitAtTime(t: number): Curve | null {
    const loc = this.getLocationAtTime(t);
    return loc ? this.splitAt(loc) : null;
  }
  
  /**
   * 指定されたオフセット位置で曲線を分割する
   * paper.jsのdivideAtメソッドに相当
   * @param offset 分割位置のオフセット
   * @returns 分割後の右側の曲線
   */
  divideAt(location: number | CurveLocation): Curve | null {
    // オフセットとCurveLocationオブジェクトを受け付ける
    return this.divideAtTime(location && typeof location !== 'number' && location.getCurve() === this
            ? location.getTime()! : this.getTimeAt(location as number)!);
  }

  /**
   * 曲線をtで分割し、セグメントを追加する
   * paper.jsのdivideAtTimeメソッドに相当
   * @param t 分割位置（0-1）
   * @param _setHandles ハンドルを設定するかどうか（paper.jsとの互換性のため）
   * @returns 新しい曲線オブジェクト（Paper.jsと同様）
   */
  divideAtTime(t: number, _setHandles?: boolean): Curve | null {
      // 最小・最大値の定義
      const tMin = Numerical.CURVETIME_EPSILON;
      const tMax = 1 - tMin;
      let res: Curve | null = null;
      
      // 有効な範囲内かチェック
      if (t >= tMin && t <= tMax) {
          // 曲線を分割
          const parts = CurveSubdivision.subdivide(this.getValues(), t);
          assert(parts && parts[0] && parts[1], `[Papyrus2D AssertionError] CurveSubdivision.subdivide returned invalid parts: t=${t}, parts=${JSON.stringify(parts)}`);
          const left = parts[0];
          const right = parts[1];
          assert(left && right && left.length === 8 && right.length === 8, `[Papyrus2D AssertionError] subdivide result invalid: left=${left}, right=${right}`);
          
          // ハンドルを設定するかどうか
          const setHandles = _setHandles !== undefined ? _setHandles : this.hasHandles();
          
          const seg1 = this._segment1;
          const seg2 = this._segment2;
          assert(seg1 && seg2, `[Papyrus2D AssertionError] seg1 or seg2 is null: seg1=${seg1}, seg2=${seg2}`);
          
          if (setHandles) {
              // ハンドルを調整
              seg1._handleOut._set(left[2] - left[0], left[3] - left[1]);
              seg2._handleIn._set(right[4] - right[6], right[5] - right[7]);
          }
          
          // 新しいセグメントを作成
          const x = left[6], y = left[7];
          const segment = new Segment(
              new Point(x, y),
              setHandles ? new Point(left[4] - x, left[5] - y) : null,
              setHandles ? new Point(right[2] - x, right[3] - y) : null
          );
          assert(segment, `[Papyrus2D AssertionError] failed to create new Segment at t=${t}`);
          // 新しいセグメントの_pathを設定（paper.jsと同じ）
          segment._path = this._path!;
          
          // パスが設定されている場合
          if (this._path) {
              // セグメントを挿入
              this._path.insert(seg1._index + 1, segment);
              // 新しく挿入されたセグメントは次のカーブの開始点
              res = this.getNext();
          } else {
              // パスがない場合は、分割結果から新しいカーブを作成
              this._segment2 = segment;
              this._changed();
              res = new Curve(null, segment, seg2);
              assert(res, `[Papyrus2D AssertionError] failed to create new Curve(null, segment, seg2) at t=${t}`);
          }
      }
      return res;
  }

  /**
   * 曲線上の点の位置情報を取得
   * @param point 曲線上の点
   * @returns 曲線位置情報
   */
  getLocationOf(point: Point): CurveLocation | null {
    const t = this.getTimeOf(point);
    return t !== null ? this.getLocationAtTime(t) : null;
  }

  /**
   * 曲線上の指定されたオフセット位置の位置情報を取得
   */
  getLocationAt(offset: number, _isTime?: boolean): CurveLocation | null {
    const time = _isTime ? offset : this.getTimeAt(offset);
    return this.getLocationAtTime(time!);
  }

  /**
   * 曲線上の指定されたtパラメータ位置の位置情報を取得
   */
  getLocationAtTime(t: number): CurveLocation | null {
    if (t != null && t >= 0 && t <= 1) {
      return new CurveLocation(this, t);
    } else {
      return null;
    }
  }

  /**
   * 曲線上の点のtパラメータを取得
   */
  getTimeOf(point: Point): number | null {
    return Curve.getTimeOf(this.getValues(), point);
  }
  
  /**
   * 曲線上の指定されたオフセット位置のパラメータを取得
   */
  getTimeAt(offset: number, start?: number): number | null {
    return Curve.getTimeAt(this.getValues(), offset, start);
  }
  
  /**
   * 曲線の一部の長さを計算
   */
  getPartLength(from?: number, to?: number): number {
    return Curve.getLength(this.getValues(), from, to);
  }

  /**
   * 変更通知メソッド
   */
  _changed(): void {
    // キャッシュをクリア
    this._length = undefined;
    this._bounds = undefined;
  }

  /**
   * カーブのハンドルをクリア
   * paper.jsのCurve.clearHandlesメソッドと同等の実装
   */
  clearHandles(): void {
    if (this._segment1) this._segment1.clearHandles();
    if (this._segment2) this._segment2.clearHandles();
  }

  /**
   * この曲線が直線かどうかを判定
   * @returns 直線ならtrue
   */
  isStraight(epsilon?: number): boolean {
    // CurveGeometryのisStraightメソッドを使用
    return CurveGeometry.isStraight(this.getValues());
  }

  /**
   * カーブの長さが0でないか判定（paper.jsのhasLength実装）
   * @returns {boolean}
   */
  hasLength(): boolean {
    // paper.js: return !!this.getLength();
    return !!this.getLength();
  }

  isLinear(epsilon?: number): boolean {
    // CurveGeometryのisLinearメソッドを使用
    return CurveGeometry.isLinear(this.getValues());
  }

  /**
   * 曲線の境界ボックスを取得
   * paper.jsのCurve.getBoundsメソッドの実装
   */
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

  /**
   * 直線判定
   */
  static isStraight(v: number[], epsilon?: number): boolean {
    // CurveGeometryのisStraightメソッドを使用
    return CurveGeometry.isStraight(v);
  }

  static getTimeOf(v: number[], point: Point): number | null {
    // CurveLocationUtilsのgetTimeOfメソッドを使用
    return CurveLocationUtils.getTimeOf(v, point);
  }

  static isLinear(v: number[]): boolean {
    // CurveGeometryのisLinearメソッドを使用
    return CurveGeometry.isLinear(v);
  }

  /**
   * 三次ベジェ曲線のt位置の点を返す
   */
  static getPoint(v: number[], t: number): Point {
    return CurveCalculation.evaluate(v, t, 0, false)!;
  }

  /**
   * ベジェ曲線の面積を計算
   */
  static getArea(v: number[]): number {
    return CurveGeometry.getArea(v);
  }

  /**
   * 曲線の長さを計算
   */
  static getLength(v: number[], a?: number, b?: number, ds?: (t: number) => number): number {
    return CurveGeometry.getLength(v, a, b, ds);
  }

  /**
   * 静的なgetValues関数 - 制御点を配列として返す
   */
  static getValues(
    segment1: Segment, segment2: Segment,
    matrix: Matrix | null, straight: boolean
  ): number[] {
    return CurveSubdivision.getValues(segment1, segment2, matrix, straight);
  }

  /**
   * 曲線をtで分割する（paper.jsとの互換性のため）
   * @param v 制御点配列
   * @param t 分割位置（0-1）
   * @returns 左右の曲線の制御点配列のペア
   */
  static subdivide(v: number[], t?: number): [number[], number[]] {
    return CurveSubdivision.subdivide(v, t !== undefined ? t : 0.5);
  }

  /**
   * 曲線が指定された平坦さの基準を満たしているかどうかを判定
   * paper.jsのCurve.isFlatEnoughメソッドの実装
   * @param v 制御点配列 [x1,y1,h1x,h1y,h2x,h2y,x2,y2]
   * @param flatness 許容される最大誤差
   * @returns 平坦と判断できる場合はtrue
   */
  static isFlatEnough(v: number[], flatness: number): boolean {
    // 曲線の制御点
    const x0 = v[0], y0 = v[1];
    const x1 = v[2], y1 = v[3];
    const x2 = v[4], y2 = v[5];
    const x3 = v[6], y3 = v[7];
    
    // 曲線の端点を結ぶ直線からの最大距離を計算
    const ux = 3 * x1 - 2 * x0 - x3;
    const uy = 3 * y1 - 2 * y0 - y3;
    const vx = 3 * x2 - 2 * x3 - x0;
    const vy = 3 * y2 - 2 * y3 - y0;
    
    return Math.max(ux * ux, vx * vx) + Math.max(uy * uy, vy * vy) <= 16 * flatness * flatness;
  }

  /**
   * 指定されたオフセットでの曲線のtパラメータを計算
   */
  static getTimeAt(v: number[], offset: number, start?: number): number | null {
    return CurveLocationUtils.getTimeAt(v, offset, start);
  }

  /**
   * 2つの曲線の交点を計算
   */
  static getIntersections(
    curves1: Curve[] | number[],
    curves2: Curve[] | number[] | null = null,
    include?: (loc: CurveLocation) => boolean,
    matrix1?: Matrix | null | undefined,
    matrix2?: Matrix | null | undefined,
    _returnFirst?: boolean
  ): CurveLocation[] {
    // CurveIntersectionMainモジュールの関数を使用
    return getIntersections(curves1, curves2, include, matrix1, matrix2, _returnFirst);
  }

  /**
   * 指定された点に最も近い曲線上の位置を返す
   * @param point 点
   * @returns 曲線上の位置
   */
  getNearestLocation(point: Point): CurveLocation {
    const values = this.getValues();
    const t = Curve.getNearestTime(values, point);
    const pt = Curve.getPoint(values, t);
    return new CurveLocation(this, t, pt,null, point.subtract(pt).getLength());
  }

  /**
   * 指定された点に最も近い曲線上の点を返す
   * @param point 点
   * @returns 曲線上の点
   */
  getNearestPoint(point: Point): Point {
    const loc = this.getNearestLocation(point);
    return loc.getPoint();
  }

  getIntersections(curve: Curve | null): CurveLocation[] {
    const v1 = this.getValues();
    const v2 = curve && curve !== this && curve.getValues();
    return v2 ? Curve.getIntersections([this], [curve], undefined, null, null, false)
              : Curve.getIntersections([this], null, undefined, null, null, false);
  }

  /**
   * 指定された点に最も近い曲線上の時間パラメータを計算
   * paper.jsのCurve.getNearestTimeメソッドの実装
   */
  static getNearestTime(v: number[], point: Point): number {
    if (Curve.isStraight(v)) {
      const x0 = v[0], y0 = v[1],
            x3 = v[6], y3 = v[7],
            vx = x3 - x0, vy = y3 - y0,
            det = vx * vx + vy * vy;
      // ゼロ除算を避ける
      if (det === 0)
        return 0;
      // 点を直線に投影し、線形パラメータuを計算: u = (point - p1).dot(v) / v.dot(v)
      const u = ((point.x - x0) * vx + (point.y - y0) * vy) / det;
      if (u < Numerical.EPSILON) return 0;
      if (u > (1 - Numerical.EPSILON)) return 1;
      
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

    for (let i = 0; i <= count; i++)
      refine(i / count);

    // 精度を上げるために反復的に解を改良
    let step = 1 / (count * 2);
    while (step > Numerical.CURVETIME_EPSILON) {
      if (!refine(minT - step) && !refine(minT + step))
        step /= 2;
    }
    return minT;
  }

  /**
   * 三次方程式を解く
   * CurveCalculation.solveCubicのラッパー
   */
  static solveCubic(v: number[], coord: number, val: number, roots: number[], min: number, max: number): number {
    // CurveLocationUtils.solveCubicを呼び出すだけ
    return CurveLocationUtils.solveCubic(v, coord, val, roots, { min, max });
  }

  /**
   * 曲線上の点での接線ベクトルを計算
   * CurveCalculation.getTangentのラッパー
   */
  static getTangent(v: number[], t: number): Point {
    return CurveCalculation.getTangent(v, t)!;
  }

  /**
   * 曲線の境界ボックスを計算
   * paper.jsのCurve.getBoundsメソッドの実装
   */
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

  /**
   * 境界ボックス計算のヘルパー関数
   * paper.jsのCurve._addBoundsメソッドの実装
   */
  static _addBounds(v0: number, v1: number, v2: number, v3: number, coord: number, padding: number, min: number[], max: number[], roots: number[]): void {
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

    // 境界チェックを最初に行う: 少なくとも1つの値がmin-max範囲外の場合のみ、曲線は現在の境界を拡張できる
    if (v0 < minPad || v1 < minPad || v2 < minPad || v3 < minPad ||
        v0 > maxPad || v1 > maxPad || v2 > maxPad || v3 > maxPad) {
      if (v1 < v0 != v1 < v3 && v2 < v0 != v2 < v3) {
        // 曲線の値がソートされている場合、極値は単に始点と終点
        add(v0, 0);
        add(v3, 0);
      } else {
        // ベジェ多項式の導関数を計算（3で割る）
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
          // 良い根かどうかをテストし、良い場合のみ境界に追加
          if (tMin <= t && t <= tMax) {
            // t位置でのベジェ多項式を計算
            add(u * u * u * v0 + 3 * u * u * t * v1 + 3 * u * t * t * v2 + t * t * t * v3, padding);
          }
        }
      }
    }
  }

  /**
   * モノトーン分割: 曲線をx方向またはy方向に単調な部分曲線に分割
   * paper.jsのCurve.getMonoCurves()と同じ
   * @param v 制御点配列 [x1,y1,h1x,h1y,h2x,h2y,x2,y2]
   * @param dir 方向（falseならx方向、trueならy方向）
   * @returns 分割された制御点配列の配列
   */
  static getMonoCurves(v: number[], dir = false): number[][] {
    return CurveSubdivision.getMonoCurves(v, dir);
  }
}

