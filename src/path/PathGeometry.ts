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
    return new Rectangle(new Point(0, 0), new Point(0, 0));
  }
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  const add = (x: number, y: number) => {
    minX = Math.min(minX, x - padding);
    minY = Math.min(minY, y - padding);
    maxX = Math.max(maxX, x + padding);
    maxY = Math.max(maxY, y + padding);
  };

  // 各カーブ区間ごとにBézierの極値もAABBに含める
  for (let i = 0; i < segments.length - (closed ? 0 : 1); i++) {
    const seg0 = segments[i];
    const seg1 = segments[(i + 1) % segments.length];
    // 4点: p0, handleOut, handleIn, p1
    const p0 = seg0.point;
    const p1 = seg1.point;
    const h0 = p0.add(seg0.handleOut);
    const h1 = p1.add(seg1.handleIn);

    // x, y それぞれで三次ベジェの極値を求める
    for (const dim of ['x', 'y'] as const) {
      // 三次ベジェの係数
      const v0 = p0[dim];
      const v1 = h0[dim];
      const v2 = h1[dim];
      const v3 = p1[dim];

      // 端点をAABBに含める
      add(p0.x, p0.y);
      add(p1.x, p1.y);

      // 極値（1次導関数=0のt）を求める（paper.jsと同じ式）
      // a = 3*(v1-v2) - v0 + v3
      // b = 2*(v0+v2) - 4*v1
      // c = v1 - v0
      const a = 3 * (v1 - v2) - v0 + v3;
      const b = 2 * (v0 + v2) - 4 * v1;
      const c = v1 - v0;

      // 2次方程式 at^2 + bt + c = 0
      if (Math.abs(a) > 1e-12) {
        const D = b * b - 4 * a * c;
        if (D >= 0) {
          const sqrtD = Math.sqrt(D);
          for (const t of [(-b + sqrtD) / (2 * a), (-b - sqrtD) / (2 * a)]) {
            if (t > 0 && t < 1) {
              // 三次ベジェ補間
              const mt = 1 - t;
              const x =
                mt * mt * mt * p0.x +
                3 * mt * mt * t * h0.x +
                3 * mt * t * t * h1.x +
                t * t * t * p1.x;
              const y =
                mt * mt * mt * p0.y +
                3 * mt * mt * t * h0.y +
                3 * mt * t * t * h1.y +
                t * t * t * p1.y;
              add(x, y);
            }
          }
        }
      } else if (Math.abs(b) > 1e-12) {
        // 1次方程式
        const t = -c / b;
        if (t > 0 && t < 1) {
          const mt = 1 - t;
          const bez =
            mt * mt * mt * v0 + 3 * mt * mt * t * v1 + 3 * mt * t * t * v2 + t * t * t * v3;
          const other =
            dim === 'x'
              ? mt * mt * mt * p0.y +
                3 * mt * mt * t * h0.y +
                3 * mt * t * t * h1.y +
                t * t * t * p1.y
              : mt * mt * mt * p0.x +
                3 * mt * mt * t * h0.x +
                3 * mt * t * t * h1.x +
                t * t * t * p1.x;
          add(dim === 'x' ? bez : other, dim === 'y' ? bez : other);
        }
      }
    }
  }
  return new Rectangle(new Point(minX, minY), new Point(maxX, maxY));
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
  // 頂点判定
  for (const seg of segments) {
    if (seg.point.subtract(point).getLength() <= epsilon) {
      return true;
    }
  }

  // 辺上判定
  for (const curve of curves) {
    // 直線の場合は簡易判定
    if (
      Curve.isStraight([
        curve._segment1.point.x,
        curve._segment1.point.y,
        curve._segment1.point.x + curve._segment1.handleOut.x,
        curve._segment1.point.y + curve._segment1.handleOut.y,
        curve._segment2.point.x + curve._segment2.handleIn.x,
        curve._segment2.point.y + curve._segment2.handleIn.y,
        curve._segment2.point.x,
        curve._segment2.point.y,
      ])
    ) {
      const p1 = curve._segment1.point;
      const p2 = curve._segment2.point;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len2 = dx * dx + dy * dy;

      if (len2 > 0) {
        const t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / len2;
        if (t >= -epsilon && t <= 1 + epsilon) {
          const proj = new Point(p1.x + t * dx, p1.y + t * dy);
          if (proj.subtract(point).getLength() <= epsilon) {
            return true;
          }
        }
      }
    } else {
      // 曲線の場合は最近接点を求める
      // paper.jsのCurve.getTimeOf()実装を使用
      const v = [
        curve._segment1.point.x,
        curve._segment1.point.y,
        curve._segment1.point.x + curve._segment1.handleOut.x,
        curve._segment1.point.y + curve._segment1.handleOut.y,
        curve._segment2.point.x + curve._segment2.handleIn.x,
        curve._segment2.point.y + curve._segment2.handleIn.y,
        curve._segment2.point.x,
        curve._segment2.point.y,
      ];

      // Curve.getTimeOf()相当の実装
      // まず端点との距離をチェック
      const p0 = new Point(v[0], v[1]);
      const p3 = new Point(v[6], v[7]);

      // 端点が十分近い場合は早期リターン
      const geomEpsilon = /*#=*/ Numerical.GEOMETRIC_EPSILON;

      if (point.isClose(p0, geomEpsilon) || point.isClose(p3, geomEpsilon)) {
        return true;
      }

      // x座標とy座標それぞれについて、曲線上の点と与えられた点の距離が
      // 最小になる t を求める
      const coords = [point.x, point.y];
      const roots: Set<number> = new Set(); // 重複を排除するためにSetを使用

      for (let c = 0; c < 2; c++) {
        // 三次方程式を解く
        const tempRoots: number[] = [];
        const a = 3 * (-v[c] + 3 * v[c + 2] - 3 * v[c + 4] + v[c + 6]);
        const b = 6 * (v[c] - 2 * v[c + 2] + v[c + 4]);
        const c2 = 3 * (-v[c] + v[c + 2]);
        const d = v[c] - coords[c];

        // 三次方程式を解く
        const count = Numerical.solveCubic(a, b, c2, d, tempRoots, { min: 0, max: 1 });

        // 重複を排除しながらrootsに追加
        for (let i = 0; i < count; i++) {
          roots.add(tempRoots[i]);
        }
      }

      // 各解について、曲線上の点と与えられた点の距離をチェック
      for (const t of roots) {
        const p = CurveCalculation.evaluate(v, t, 0, false);
        if (p && point.isClose(p, geomEpsilon)) {
          return true;
        }
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
  
  // paper.jsと同様に境界ボックスチェックを行う
  if (self || (curves2 && curves1.length > 0 && curves2.length > 0)) {
    // 境界ボックスの交差チェックを追加
    if (!self) {
      // 境界ボックスを計算
      const bounds1 = getBoundsFromCurves(curves1, matrix1Null);
      const bounds2 = getBoundsFromCurves(curves2, matrix2Null);
      
      // 境界ボックスが交差しない場合は早期リターン
      if (!bounds1.intersects(bounds2, Numerical.EPSILON)) {
        return [];
      }
    }
    
    return Curve.getIntersections(
      curves1,
      curves2 || null,
      includeFn,
      matrix1Null,
      matrix2Null,
      _returnFirst);
  } else {
    return [];
  }
}

/**
 * カーブ配列から境界ボックスを計算
 * @param curves カーブ配列
 * @param matrix 変換行列
 * @returns 境界ボックス
 */
function getBoundsFromCurves(curves: Curve[], matrix: Matrix | null): Rectangle {
  if (curves.length === 0) {
    return new Rectangle(new Point(0, 0), new Point(0, 0));
  }
  
  // 各カーブの境界ボックスを計算して統合
  let bounds: Rectangle | null = null;
  
  for (const curve of curves) {
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
  // デフォルトはeven-oddルール
  const rule = options?.rule || 'evenodd';

  // 境界チェック（高速化のため）
  // paper.jsと同じ方法で境界チェックを行う
  const bounds = computeBounds(segments, closed, 0);
  if (!point.isInside(bounds)) {
    return false;
  }
  
  // winding numberを計算
  const wind = getWinding(point, curves);
  
  // paper.jsと同じ判定ロジック
  return wind.onPath || !!(rule === 'evenodd'
    ? wind.windingL & 1 || wind.windingR & 1
    : wind.winding);
}