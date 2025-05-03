/**
 * Curve: 2つのSegment（またはSegmentPoint）で定義される三次ベジェ曲線
 * paper.jsのCurveクラスAPIを参考に設計
 * ミュータブル設計
 */

import { Segment } from './Segment';
import { Point } from '../basic/Point';
import { Matrix } from '../basic/Matrix';
import { getIntersections } from './CurveIntersectionMain';
import { CurveCalculation } from './CurveCalculation';
import { CurveGeometry } from './CurveGeometry';
import { CurveSubdivision } from './CurveSubdivision';
import { CurveLocationUtils } from './CurveLocationUtils';
import { CurveLocation } from './CurveLocation';

export class Curve {
  _segment1: Segment;
  _segment2: Segment;
  
  // Path.tsとの互換性のためのプロパティ
  _path: any;
  
  // キャッシュ用プロパティ
  _length: number | undefined;
  _bounds: any;

  constructor(segment1: Segment, segment2: Segment) {
    this._segment1 = segment1;
    this._segment2 = segment2;
  }

  getPrevious(): Curve | null {
    const path = this._path;
    return path ? (path._closed && this.getIndex() === 0
            ? path._curves[path._curves.length - 1]
            : path._curves[this.getIndex() - 1]) || null : null;
  }

  getNext(): Curve | null {
    const path = this._path;
    return path ? (path._closed && this.getIndex() === path._curves.length - 1
            ? path._curves[0]
            : path._curves[this.getIndex() + 1]) || null : null;
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
  getValues(matrix?: Matrix): number[] {
    return Curve.getValues(this._segment1, this._segment2, matrix);
  }

  /**
   * t(0-1)で指定した位置のPointを返す
   */
  getPointAt(t: number, _isTime?: boolean): Point {
    const values = this.getValues();
    return Curve.getPoint(values, _isTime ? t : this.getTimeAt(t));
  }

  /**
   * t(0-1)で指定した位置の接線ベクトルを返す
   */
  getTangentAt(t: number, _isTime?: boolean): Point {
    const values = this.getValues();
    return CurveCalculation.getTangent(values, _isTime ? t : this.getTimeAt(t))!;
  }
  
  /**
   * t(0-1)で指定した位置の法線ベクトルを返す
   */
  getNormalAt(t: number, _isTime?: boolean): Point {
    const values = this.getValues();
    return CurveCalculation.getNormal(values, _isTime ? t : this.getTimeAt(t))!;
  }
  
  /**
   * t(0-1)で指定した位置の重み付き接線ベクトルを返す
   */
  getWeightedTangentAt(t: number, _isTime?: boolean): Point {
    const values = this.getValues();
    return CurveCalculation.getWeightedTangent(values, _isTime ? t : this.getTimeAt(t))!;
  }
  
  /**
   * t(0-1)で指定した位置の重み付き法線ベクトルを返す
   */
  getWeightedNormalAt(t: number, _isTime?: boolean): Point {
    const values = this.getValues();
    return CurveCalculation.getWeightedNormal(values, _isTime ? t : this.getTimeAt(t))!;
  }
  
  /**
   * t(0-1)で指定した位置の曲率を返す
   */
  getCurvatureAt(t: number, _isTime?: boolean): number {
    const values = this.getValues();
    return CurveCalculation.getCurvature(values, _isTime ? t : this.getTimeAt(t));
  }

  /**
   * t(0-1)で指定した位置のPointを返す（時間パラメータ指定）
   */
  getPointAtTime(t: number): Point {
    return Curve.getPoint(this.getValues(), t);
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
  divide(t: number): [Curve, Curve] {
    return CurveSubdivision.divideCurve(this, t);
  }

  /**
   * tで分割し、前半部分のCurveを返す
   */
  split(t: number): Curve {
    return this.divide(t)[0];
  }

  /**
   * tで分割し、前半部分のCurveを返す（paper.jsとの互換性のため）
   */
  splitAt(location: number | CurveLocation): Curve | null {
    const path = this._path;
    return path ? path.splitAt(location) : null;
  }

  /**
   * tで分割し、前半部分のCurveを返す（paper.jsとの互換性のため）
   */
  splitAtTime(t: number): Curve | null {
    const loc = this.getLocationAtTime(t);
    return loc ? this.splitAt(loc) : null;
  }

  /**
   * 曲線をtで分割し、セグメントを追加する
   * paper.jsのdivideAtTimeメソッドに相当
   * @param t 分割位置（0-1）
   * @returns 分割点のインデックス
   */
  divideAtTime(t: number): number {
    // パスが設定されていない場合は処理できない
    if (!this._path) {
      return -1;
    }
    
    // 分割範囲外の場合は処理しない
    if (t <= 0 || t >= 1) {
      return -1;
    }
    
    // 曲線を分割
    const [leftCurve, rightCurve] = CurveSubdivision.divideCurve(this, t);
    
    // 分割点のセグメントを作成
    const segments = this._path._segments;
    const index = this.getIndex();
    const middleSegment = leftCurve._segment2;
    
    // セグメントを挿入
    segments.splice(index + 1, 0, middleSegment);
    
    // セグメントのインデックスを更新
    for (let i = index + 1, l = segments.length; i < l; i++) {
      segments[i]._index = i;
    }
    
    // パスのカーブを更新
    if (this._path._curves) {
      this._path._curves.splice(index + 1, 0, rightCurve);
      this._path._curves[index] = leftCurve;
      
      // カーブのパスを設定
      rightCurve._path = this._path;
      
      // カーブの変更を通知
      this._path._changed();
    }
    
    return index + 1;
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
    console.log('Curve.getLocationAt: offset =', offset, '_isTime =', _isTime);
    const time = _isTime ? offset : this.getTimeAt(offset);
    console.log('Curve.getLocationAt: time =', time);
    return this.getLocationAtTime(time);
  }

  /**
   * 曲線上の指定されたtパラメータ位置の位置情報を取得
   */
  getLocationAtTime(t: number): CurveLocation | null {
    console.log('Curve.getLocationAtTime: t =', t);
    if (t != null && t >= 0 && t <= 1) {
      console.log('Curve.getLocationAtTime: creating location');
      return new CurveLocation(this, t);
    } else {
      console.log('Curve.getLocationAtTime: t out of range');
      return null;
    }
  }

  /**
   * 曲線上の点のtパラメータを取得
   */
  getTimeOf(point: Point): number | null {
    return CurveLocationUtils.getTimeOf(this.getValues(), point);
  }
  
  /**
   * 曲線上の指定されたオフセット位置のパラメータを取得
   */
  getTimeAt(offset: number, start?: number): number {
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
   * この曲線が直線かどうかを判定
   * @returns 直線ならtrue
   */
  isStraight(): boolean {
    return Curve.isStraight(this.getValues());
  }

  /**
   * 直線判定
   */
  static isStraight(v: number[]): boolean {
    return CurveGeometry.isStraight(v);
  }

  /**
   * 三次ベジェ曲線のt位置の点を返す
   */
  static getPoint(v: number[], t: number): Point {
    const result = CurveCalculation.evaluate(v, t, 0, false);
    if (result === null) {
      throw new Error('t must be in [0,1]');
    }
    return result;
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
    segment1: any, segment2: any,
    matrix?: Matrix | null, straight?: boolean | null
  ): number[] {
    return CurveSubdivision.getValues(segment1, segment2, matrix, straight);
  }

  /**
   * 指定されたオフセットでの曲線のtパラメータを計算
   */
  static getTimeAt(v: number[], offset: number, start?: number): number {
    return CurveLocationUtils.getTimeAt(v, offset, start);
  }

  /**
   * 2つの曲線の交点を計算
   */
  static getIntersections(
    curves1: Curve[] | number[],
    curves2: Curve[] | number[] | null,
    include?: (loc: CurveLocation) => boolean,
    matrix1?: Matrix | null | undefined,
    matrix2?: Matrix | null | undefined,
    _returnFirst?: boolean
  ): CurveLocation[] {
    // CurveIntersectionMainモジュールの関数を使用
    return getIntersections(curves1, curves2, include, matrix1, matrix2, _returnFirst);
  }
}
