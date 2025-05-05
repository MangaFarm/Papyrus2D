/**
 * PathGeometry - Path クラスから切り出した幾何学計算関連の関数群
 */

import { Point } from '../basic/Point';
import { Rectangle } from '../basic/Rectangle';
import { Matrix } from '../basic/Matrix';
import { Curve } from './Curve';
import { CurveLocation } from './CurveLocation';
import { Segment } from './Segment';
import { Numerical } from '../util/Numerical';
import { CurveCalculation } from './CurveCalculation';
import { getWinding } from './PathBooleanWinding';

/**
 * 内部: paddingを加味したAABB計算
 */
export function computeBounds(segments: Segment[], closed: boolean, padding: number): Rectangle {
  if (segments.length === 0) {
    return new Rectangle(0, 0, 0, 0);
  }
  
  // Paper.jsと同じアプローチを使用
  const first = segments[0];
  // 空のパスの場合は空の矩形を返す
  if (!first) {
    return new Rectangle(0, 0, 0, 0);
  }
  
  const coords = new Array(6);
  // 最初のセグメントの座標を取得
  const prevCoords = new Array(6);
  first._transformCoordinates(null, prevCoords, true);
  
  const min = prevCoords.slice(0, 2); // 最初の点の値で初期化
  const max = min.slice(); // クローン
  
  const roots = new Array(2);

  // 各セグメントを処理する関数
  function processSegment(segment: Segment) {
    segment._transformCoordinates(null, coords, true);
    
    for (let i = 0; i < 2; i++) {
      // Paper.jsのCurve._addBoundsと同じロジック
      addBezierBounds(
        prevCoords[i],      // prev.point
        prevCoords[i + 4],  // prev.handleOut
        coords[i + 2],      // segment.handleIn
        coords[i],          // segment.point
        i,
        padding,
        min,
        max,
        roots
      );
    }
    
    // 座標バッファを交換
    for (let i = 0; i < 6; i++) {
      const tmp = prevCoords[i];
      prevCoords[i] = coords[i];
      coords[i] = tmp;
    }
  }

  // 全セグメントを処理
  for (let i = 1, l = segments.length; i < l; i++) {
    processSegment(segments[i]);
  }
  
  // 閉じたパスの場合、最初のセグメントも処理
  if (closed) {
    processSegment(first);
  }
  
  const result = new Rectangle(min[0], min[1], max[0] - min[0], max[1] - min[1]);
  return result;
}

// Paper.jsのCurve._addBoundsと同等の関数
function addBezierBounds(
  v0: number, v1: number, v2: number, v3: number,
  coord: number, padding: number,
  min: number[], max: number[],
  roots: number[]
) {
  // 制御点の最小値と最大値を計算
  let minV = Math.min(v0, v3);
  let maxV = Math.max(v0, v3);
  
  // ハンドルを考慮して境界を拡張
  if (v1 < minV) minV = v1;
  if (v1 > maxV) maxV = v1;
  if (v2 < minV) minV = v2;
  if (v2 > maxV) maxV = v2;
  
  // パディングを適用
  min[coord] = Math.min(min[coord], minV - padding);
  max[coord] = Math.max(max[coord], maxV + padding);
  
  // 極値を計算して境界を拡張
  // 1次導関数の係数
  const a = 3 * (v1 - v2) - v0 + v3;
  const b = 2 * (v0 - 2 * v1 + v2);
  const c = v1 - v0;
  
  // 2次方程式を解いて極値を求める
  let count = 0;
  if (Math.abs(a) > Numerical.EPSILON) {
    // 2次方程式
    const discriminant = b * b - 4 * a * c;
    
    if (discriminant >= 0) {
      const sqrtDisc = Math.sqrt(discriminant);
      const t1 = (-b + sqrtDisc) / (2 * a);
      const t2 = (-b - sqrtDisc) / (2 * a);
      
      // 0から1の範囲内の解のみを考慮
      if (t1 >= 0 && t1 <= 1) {
        roots[count++] = t1;
      }
      if (t2 >= 0 && t2 <= 1) {
        roots[count++] = t2;
      }
    }
  } else if (Math.abs(b) > Numerical.EPSILON) {
    // 1次方程式
    const t = -c / b;
    
    if (t >= 0 && t <= 1) {
      roots[count++] = t;
    }
  }
  
  // 極値での座標を計算して境界を拡張
  for (let i = 0; i < count; i++) {
    const t = roots[i];
    const u = 1 - t;
    const bezierValue = u * u * u * v0 + 3 * u * u * t * v1 + 3 * u * t * t * v2 + t * t * t * v3;
    
    min[coord] = Math.min(min[coord], bezierValue - padding);
    max[coord] = Math.max(max[coord], bezierValue + padding);
  }
}

/**
 * 点がパス上にあるかどうかを判定
 * @param segments セグメント配列
 * @param curves カーブ配列
 * @param point 判定する点
 * @param epsilon 許容誤差
 * @returns パス上ならtrue
 */
export function isOnPath(
  segments: Segment[],
  curves: Curve[],
  point: Point,
  epsilon = Numerical.GEOMETRIC_EPSILON
): boolean {
  // Paper.jsと同じアプローチを使用
  
  // 頂点判定
  for (let i = 0, l = segments.length; i < l; i++) {
    const seg = segments[i];
    if (point.subtract(seg.point).getLength() <= epsilon) {
      return true;
    }
  }

  // 辺上判定
  for (let i = 0, l = curves.length; i < l; i++) {
    const curve = curves[i];
    
    // 曲線の値を取得
    const v = curve.getValues();
    
    // 直線の場合は簡易判定
    if (Curve.isStraight(v)) {
      const p1 = curve._segment1.point;
      const p2 = curve._segment2.point;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len2 = dx * dx + dy * dy;

      if (len2 > 0) {
        const t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / len2;
        if (t >= -epsilon && t <= 1 + epsilon) {
          const proj = new Point(p1.x + t * dx, p1.y + t * dy);
          if (point.subtract(proj).getLength() <= epsilon) {
            return true;
          }
        }
      }
    } else {
      // 曲線の場合はNearestLocationを使用
      const loc = curve.getNearestLocation(point);
      if (loc && loc.getDistance()! <= epsilon) {
        return true;
      }
    }
  }

  return false;
}

/**
 * パスの交点を計算
 * @param curves1 カーブ配列1
 * @param curves2 カーブ配列2（未指定の場合は自己交差を検出）
 * @param include 交点をフィルタリングするコールバック関数
 * @param matrix1 カーブ配列1の変換行列
 * @param matrix2 カーブ配列2の変換行列
 * @param _returnFirst 最初の交点だけを返すフラグ
 * @returns 交点情報の配列
 */
export function getIntersections(
  curves1: Curve[],
  curves2?: Curve[] | null,
  include?: ((loc: CurveLocation) => boolean) | { include: (loc: CurveLocation) => boolean },
  matrix1?: Matrix | null,
  matrix2?: Matrix | null,
  _returnFirst?: boolean
): CurveLocation[] {
  // includeパラメータの処理
  let includeFn: ((loc: CurveLocation) => boolean) | undefined;
  
  if (include) {
    if (typeof include === 'function') {
      includeFn = include;
    } else if (typeof include === 'object' && 'include' in include && typeof include.include === 'function') {
      includeFn = include.include;
    }
  }
  
  // 自己交差判定
  const self = curves1 === curves2 || !curves2;
  
  // 行列変換処理
  let matrix1Null: Matrix | null = null;
  
  if (matrix1) {
    matrix1Null = matrix1._orNullIfIdentity ? matrix1._orNullIfIdentity() : matrix1;
  }
  
  let matrix2Null: Matrix | null = null;
  if (self) {
    matrix2Null = matrix1Null;
  } else if (matrix2) {
    matrix2Null = matrix2._orNullIfIdentity ? matrix2._orNullIfIdentity() : matrix2;
  }
  
  // 境界ボックスチェックはPath.getIntersectionsで行うため、ここでは行わない
  return Curve.getIntersections(
          curves1,
          !self && curves2 || null,
          includeFn,
          matrix1Null,
          matrix2Null,
          _returnFirst);
}

/**
 * カーブ配列から境界ボックスを計算
 * @param curves カーブ配列
 * @param matrix 変換行列
 * @returns 境界ボックス
 */
function getBoundsFromCurves(curves: Curve[], matrix: Matrix | null): Rectangle {
  if (curves.length === 0) {
    return new Rectangle(0, 0, 0, 0);
  }
  
  // Paper.jsと同じアプローチを使用
  let bounds: Rectangle | null = null;
  
  for (let i = 0, l = curves.length; i < l; i++) {
    const curve = curves[i];
    const curveBounds = curve.getBounds(matrix);
    if (bounds) {
      bounds = bounds.unite(curveBounds);
    } else {
      bounds = curveBounds;
    }
  }
  
  return bounds!;
}

/**
 * 点がパス内部にあるかどうかを判定
 * @param segments セグメント配列
 * @param closed パスが閉じているかどうか
 * @param curves カーブ配列
 * @param point 判定する点
 * @param options オプション
 * @returns 内部ならtrue、外部またはパス上ならfalse
 */
export function contains(
  segments: Segment[],
  closed: boolean,
  curves: Curve[],
  point: Point,
  options?: {
    rule?: 'evenodd' | 'nonzero';
  }
): boolean {
  // Paper.jsと同じアプローチを使用
  
  // デフォルトはeven-oddルール
  const rule = options?.rule || 'evenodd';
  
  // winding numberを計算
  const wind = getWinding(point, curves);
  
  // Paper.jsと同じ判定ロジック
  return wind.onPath || !!(rule === 'evenodd'
    ? wind.windingL & 1 || wind.windingR & 1
    : wind.winding);
}