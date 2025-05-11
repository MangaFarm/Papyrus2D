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
import { getWinding } from './PathBooleanWinding';

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
  curves2: Curve[] | null,
  include: (loc: CurveLocation) => boolean,
  matrix1: Matrix | null,
  matrix2: Matrix | null,
  _returnFirst: boolean
): CurveLocation[] {
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
    (!self && curves2) || null,
    include,
    matrix1Null,
    matrix2Null,
    _returnFirst
  );
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
  return (
    wind.onPath || !!(rule === 'evenodd' ? wind.windingL & 1 || wind.windingR & 1 : wind.winding)
  );
}

export function getPathArea(segments: Segment[], closed: boolean): number {
  let area = 0;

  for (let i = 0, l = segments.length; i < l; i++) {
    const last = i + 1 === l;

    area += Curve.getArea(
      Curve.getValues(segments[i], segments[last ? 0 : i + 1], null, last && !closed)
    );
  }

  return area;
}

export function getPathLength(curves: Curve[]): number {
  let length = 0;
  for (let i = 0, l = curves.length; i < l; i++) {
    length += curves[i].getLength();
  }
  return length;  
}
