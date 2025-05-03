/**
 * Curve: 2つのSegment（またはSegmentPoint）で定義される三次ベジェ曲線
 * paper.jsのCurveクラスAPIを参考に設計
 * イミュータブル設計
 */

import { Segment } from './Segment';
import { Point } from '../basic/Point';
import { Matrix } from '../basic/Matrix';
import { Numerical } from '../util/Numerical';
import { CollisionDetection } from '../util/CollisionDetection';
import { getSelfIntersection, getCurveIntersections } from './CurveIntersections';
import { CurveCalculation } from './CurveCalculation';
import { CurveGeometry } from './CurveGeometry';
import { CurveSubdivision } from './CurveSubdivision';
import { CurveLocationUtils } from './CurveLocationUtils';
import { CurveLocation } from './CurveLocation';

export class Curve {
  readonly segment1: Segment;
  readonly segment2: Segment;
  
  // Path.tsとの互換性のためのエイリアス
  get _segment1(): Segment { return this.segment1; }
  set _segment1(value: Segment) { (this as any).segment1 = value; }
  
  get _segment2(): Segment { return this.segment2; }
  set _segment2(value: Segment) { (this as any).segment2 = value; }
  
  // Path.tsとの互換性のためのプロパティ
  _path: any;

  constructor(segment1: Segment, segment2: Segment) {
    this.segment1 = segment1;
    this.segment2 = segment2;
  }

  getPrevious(): Curve | null {
    const path = (this as any)._path;
    return path ? (path._closed && this.getIndex() === 0
            ? path._curves[path._curves.length - 1]
            : path._curves[this.getIndex() - 1]) || null : null;
  }

  getNext(): Curve | null {
    const path = (this as any)._path;
    return path ? (path._closed && this.getIndex() === path._curves.length - 1
            ? path._curves[0]
            : path._curves[this.getIndex() + 1]) || null : null;
  }

  /**
   * 曲線の始点を取得
   */
  getPoint1(): Point {
    return this.segment1.getPoint();
  }

  /**
   * 曲線の終点を取得
   */
  getPoint2(): Point {
    return this.segment2.getPoint();
  }

  /**
   * パス内でのこのカーブの位置を返す
   */
  getIndex(): number {
    return (this.segment1 as any)._index;
  }

  /**
   * 曲線がハンドルを持っているかチェック
   */
  hasHandles(): boolean {
    return !this.segment1.getHandleOut().isZero() || !this.segment2.getHandleIn().isZero();
  }

  /**
   * 曲線長を返す
   */
  getLength(): number {
    if ((this as any)._length == null) {
      (this as any)._length = CurveGeometry.getLength(this.getValues(), 0, 1);
    }
    return (this as any)._length;
  }

  /**
   * ベジェ制御点配列 [x1, y1, h1x, h1y, h2x, h2y, x2, y2] を返す
   */
  getValues(matrix?: Matrix): number[] {
    const p1 = this.segment1.getPoint();
    const h1 = p1.add(this.segment1.getHandleOut());
    const h2 = this.segment2.getPoint().add(this.segment2.getHandleIn());
    const p2 = this.segment2.getPoint();
    const values = [p1.x, p1.y, h1.x, h1.y, h2.x, h2.y, p2.x, p2.y];
    
    if (matrix) {
      matrix._transformCoordinates(values, values, 4);
    }
    
    return values;
  }

  /**
   * t(0-1)で指定した位置のPointを返す
   */
  getPointAt(t: number): Point {
    const v = this.getValues();
    return CurveCalculation.getPoint(v, t);
  }

  /**
   * t(0-1)で指定した位置の接線ベクトルを返す
   */
  getTangentAt(t: number): Point {
    return CurveCalculation.getTangent(this.getValues(), t);
  }
  
  /**
   * t(0-1)で指定した位置の法線ベクトルを返す
   */
  getNormalAt(t: number): Point {
    return CurveCalculation.getNormal(this.getValues(), t);
  }
  
  /**
   * t(0-1)で指定した位置の重み付き接線ベクトルを返す
   */
  getWeightedTangentAt(t: number): Point {
    return CurveCalculation.getWeightedTangent(this.getValues(), t);
  }
  
  /**
   * t(0-1)で指定した位置の重み付き法線ベクトルを返す
   */
  getWeightedNormalAt(t: number): Point {
    return CurveCalculation.getWeightedNormal(this.getValues(), t);
  }
  
  /**
   * t(0-1)で指定した位置の曲率を返す
   */
  getCurvatureAt(t: number): number {
    return CurveCalculation.getCurvature(this.getValues(), t);
  }
  
  /**
   * 指定された接線に対して曲線が接する時間パラメータを計算
   */
  getTimesWithTangent(tangent: Point): number[] {
    return CurveCalculation.getTimesWithTangent(this.getValues(), tangent);
  }

  /**
   * 曲線をtで分割し、2つのCurveに分ける
   */
  divide(t: number): [Curve, Curve] {
    if (t < 0 || t > 1) throw new Error('t must be in [0,1]');
    const v = this.getValues();
    const [left, right] = CurveSubdivision.subdivide(v, t);

    // left: [x0, y0, x4, y4, x7, y7, x9, y9]
    // right: [x9, y9, x8, y8, x6, y6, x3, y3]
    const seg1_left = new Segment(
      new Point(left[0], left[1]),
      new Point(0, 0), // handleIn
      new Point(left[2] - left[0], left[3] - left[1]) // handleOut
    );
    const seg2_left = new Segment(
      new Point(left[6], left[7]),
      new Point(left[4] - left[6], left[5] - left[7]), // handleIn
      new Point(0, 0) // handleOut
    );
    const seg1_right = new Segment(
      new Point(right[0], right[1]),
      new Point(0, 0), // handleIn
      new Point(right[2] - right[0], right[3] - right[1]) // handleOut
    );
    const seg2_right = new Segment(
      new Point(right[6], right[7]),
      new Point(right[4] - right[6], right[5] - right[7]), // handleIn
      new Point(0, 0) // handleOut
    );
    return [
      new Curve(seg1_left, seg2_left),
      new Curve(seg1_right, seg2_right)
    ];
  }

  /**
   * tで分割し、前半部分のCurveを返す
   */
  split(t: number): Curve {
    return this.divide(t)[0];
  }

  /**
   * 曲線上の点の位置情報を取得
   * @param point 曲線上の点
   * @returns 曲線位置情報
   */
  getLocationOf(point: Point): CurveLocation | null {
    const time = CurveLocationUtils.getTimeOf(this.getValues(), point);
    return time !== null ? new CurveLocation(this, time, point) : null;
  }

  /**
   * 曲線上の指定されたオフセット位置の位置情報を取得
   */
  getLocationAt(offset: number): CurveLocation {
    if (offset <= 0) {
      return new CurveLocation(this, 0);
    }
    if (offset >= this.getLength()) {
      return new CurveLocation(this, 1);
    }
    
    const t = this.getTimeAt(offset);
    return new CurveLocation(this, t);
  }
  
  /**
   * 曲線上の指定されたオフセット位置のパラメータを取得
   */
  getTimeAt(offset: number): number {
    if (offset <= 0) {
      return 0;
    }
    if (offset >= this.getLength()) {
      return 1;
    }
    
    // 二分探索で近似
    let start = 0;
    let end = 1;
    let epsilon = Numerical.CURVETIME_EPSILON;
    
    while (end - start > epsilon) {
      const mid = (start + end) / 2;
      const length = this.getPartLength(0, mid);
      if (length < offset) {
        start = mid;
      } else {
        end = mid;
      }
    }
    
    return start;
  }
  
  /**
   * 曲線の一部の長さを計算
   */
  getPartLength(from: number, to: number): number {
    if (from === 0 && to === 1) {
      return this.getLength();
    }
    return CurveGeometry.getLength(this.getValues(), from, to);
  }

  /**
   * 変更通知メソッド
   */
  _changed(): void {
    // キャッシュをクリア
    (this as any)._length = undefined;
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
  static evaluate(v: number[], t: number, type: number = 0, normalized: boolean = false): Point {
    return CurveCalculation.evaluate(v, t, type, normalized);
  }

  /**
   * ベジェ曲線の面積を計算
   */
  static getArea(v: number[]): number {
    return CurveGeometry.getArea(v);
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
    const epsilon = Numerical.GEOMETRIC_EPSILON;
    const self = !curves2;
    
    if (Array.isArray(curves1) && typeof curves1[0] === 'number') {
      // 数値配列の場合、Curveオブジェクトに変換
      const v1 = curves1 as number[];
      const v2 = curves2 as number[] | null;
      
      if (v2 && typeof v2[0] === 'number') {
        // 両方数値配列の場合
        const curve1 = CurveSubdivision.fromValues(v1);
        const curve2 = CurveSubdivision.fromValues(v2);
        const locations: CurveLocation[] = [];
        
        return getCurveIntersections(v1, v2, curve1, curve2, locations, include);
      } else if (!v2) {
        // 自己交差チェックの場合
        const curve = CurveSubdivision.fromValues(v1);
        const locations: CurveLocation[] = [];
        return getSelfIntersection(v1, curve, locations, include);
      }
    }
    
    if (self) {
      curves2 = curves1;
    }
    
    const curveArray1 = curves1 as Curve[];
    const curveArray2 = curves2 as Curve[];
    
    const length1 = curveArray1.length;
    const length2 = curveArray2!.length;
    const values1: number[][] = new Array(length1);
    const values2 = self ? values1 : new Array(length2);
    const locations: CurveLocation[] = [];
    
    // 各曲線の値を取得（行列変換を適用）
    for (let i = 0; i < length1; i++) {
      values1[i] = curveArray1[i].getValues();
      if (matrix1) {
        // 行列変換を適用
        for (let j = 0; j < 8; j += 2) {
          const p = new Point(values1[i][j], values1[i][j + 1]);
          const transformed = matrix1.transform(p);
          values1[i][j] = transformed.x;
          values1[i][j + 1] = transformed.y;
        }
      }
    }
    
    if (!self) {
      for (let i = 0; i < length2; i++) {
        values2[i] = curveArray2![i].getValues();
        if (matrix2) {
          // 行列変換を適用
          for (let j = 0; j < 8; j += 2) {
            const p = new Point(values2[i][j], values2[i][j + 1]);
            const transformed = matrix2.transform(p);
            values2[i][j] = transformed.x;
            values2[i][j + 1] = transformed.y;
          }
        }
      }
    }
    
    const boundsCollisions = CollisionDetection.findCurveBoundsCollisions(
      values1, self ? values1 : values2, epsilon
    );
    
    // 各曲線の交点を計算
    for (let index1 = 0; index1 < length1; index1++) {
      const curve1 = curveArray1[index1];
      const v1 = values1[index1];
      
      if (self) {
        // 自己交差チェック
        getSelfIntersection(v1, curve1, locations, include);
      }
      
      // 潜在的に交差する曲線とのチェック
      const collisions1 = boundsCollisions[index1];
      if (collisions1) {
        for (let j = 0; j < collisions1.length; j++) {
          // 既に交点が見つかっていて、最初の交点だけを返す場合は早期リターン
          if (_returnFirst && locations.length) {
            return locations;
          }
          
          const index2 = collisions1[j];
          // 自己交差の場合は、重複チェックを避けるために index2 > index1 の場合のみ処理
          if (!self || index2 > index1) {
            const curve2 = curveArray2![index2];
            const v2 = values2[index2];
            
            // 曲線の交点を計算
            getCurveIntersections(
              v1, v2, curve1, curve2, locations, include
            );
            
            // 曲線インデックスを設定
            for (let k = locations.length - 1; k >= 0; k--) {
              const loc = locations[k];
              if (loc.curve1Index === -1) {
                loc.curve1Index = index1;
                loc.curve2Index = index2;
                
                // paper.jsと同様に、交点が見つかった後に曲線インデックスを設定
                if (loc.time !== null) {
                  // paper.jsでは交点の位置は変換された座標系で計算され、
                  // 元の座標系に戻す処理は行われない
                  // 交点の位置はそのまま使用する
                }
              }
            }
          }
        }
      }
    }
    
    return locations;
  }
}
