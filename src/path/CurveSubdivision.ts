/**
 * CurveSubdivision: 曲線の分割に関する機能
 * Curve.tsから分離した静的分割関数群
 */

import { Point } from '../basic/Point';
import { Segment } from './Segment';
import { Curve } from './Curve';
import { Numerical } from '../util/Numerical';

export class CurveSubdivision {
  /**
   * de Casteljau アルゴリズムによる分割
   * v: [x1, y1, h1x, h1y, h2x, h2y, x2, y2]
   * t: 分割位置 (0-1)
   * 戻り値: [左側の制御点配列, 右側の制御点配列]
   */
  static subdivide(v: number[], t: number): [number[], number[]] {
    const x0 = v[0], y0 = v[1];
    const x1 = v[2], y1 = v[3];
    const x2 = v[4], y2 = v[5];
    const x3 = v[6], y3 = v[7];
    const u = 1 - t;
    // 1次補間
    const x4 = u * x0 + t * x1, y4 = u * y0 + t * y1;
    const x5 = u * x1 + t * x2, y5 = u * y1 + t * y2;
    const x6 = u * x2 + t * x3, y6 = u * y2 + t * y3;
    // 2次補間
    const x7 = u * x4 + t * x5, y7 = u * y4 + t * y5;
    const x8 = u * x5 + t * x6, y8 = u * y5 + t * y6;
    // 3次補間
    const x9 = u * x7 + t * x8, y9 = u * y7 + t * y8;
    // 左右の制御点配列
    return [
      [x0, y0, x4, y4, x7, y7, x9, y9],
      [x9, y9, x8, y8, x6, y6, x3, y3]
    ];
  }

  /**
   * 指定した区間[from, to]の部分曲線を返す（paper.jsのgetPart相当）
   */
  static getPart(v: number[], from: number, to: number): number[] {
    const flip = from > to;
    if (flip) {
      const tmp = from;
      from = to;
      to = tmp;
    }
    let vv = v;
    if (from > 0) {
      vv = CurveSubdivision.subdivide(vv, from)[1]; // [1] right
    }
    // Interpolate the parameter at 'to' in the new curve and cut there.
    if (to < 1) {
      vv = CurveSubdivision.subdivide(vv, (to - from) / (1 - from))[0]; // [0] left
    }
    // Return reversed curve if from / to were flipped:
    return flip
      ? [vv[6], vv[7], vv[4], vv[5], vv[2], vv[3], vv[0], vv[1]]
      : vv;
  }

  /**
   * モノトーン分割: 曲線をx方向またはy方向に単調な部分曲線に分割
   * paper.jsのCurve.getMonoCurves()を移植
   * @param v 制御点配列 [x1,y1,h1x,h1y,h2x,h2y,x2,y2]
   * @param dir 方向（falseならx方向、trueならy方向）
   * @returns 分割された制御点配列の配列
   */
  static getMonoCurves(v: number[], dir = false): number[][] {
    const curves: number[][] = [];
    // paper.jsと同じ方法でインデックスを決定
    // paper.jsではdir=trueはy方向、dir=falseはx方向を意味する
    const io = dir ? 0 : 1;
    const o0 = v[io + 0];
    const o1 = v[io + 2];
    const o2 = v[io + 4];
    const o3 = v[io + 6];
    
    // 曲線が既に単調であるか直線である場合
    if ((o0 >= o1) === (o1 >= o2) && (o1 >= o2) === (o2 >= o3) || 
        CurveGeometry.isStraight(v)) {
      // 直線または単調な曲線はそのまま返す
      curves.push(v);
    } else {
      // 単調でない場合は分割
      const a = 3 * (o1 - o2) - o0 + o3;
      const b = 2 * (o0 + o2) - 4 * o1;
      const c = o1 - o0;
      const tMin = Numerical.CURVETIME_EPSILON;
      const tMax = 1 - tMin;
      const roots: number[] = [];
      
      // 二次方程式を解いて単調性が変わる点を見つける
      const n = Numerical.solveQuadratic(a, b, c, roots, { min: tMin, max: tMax });
      
      if (!n) {
        // 解がない場合は単調
        curves.push(v);
      } else {
        // 解がある場合は分割
        roots.sort();
        let t = roots[0];
        let parts = CurveSubdivision.subdivide(v, t);
        curves.push(parts[0]);
        
        if (n > 1) {
          // 2つの解がある場合はさらに分割
          t = (roots[1] - t) / (1 - t);
          parts = CurveSubdivision.subdivide(parts[1], t);
          curves.push(parts[0]);
        }
        
        curves.push(parts[1]);
      }
    }
    
    return curves;
  }

  /**
   * 制御点配列からCurveを生成
   */
  static fromValues(v: number[]): Curve {
    const p0 = new Point(v[0], v[1]);
    const h0 = new Point(v[2], v[3]).subtract(p0);
    const h1 = new Point(v[4], v[5]).subtract(new Point(v[6], v[7]));
    const p1 = new Point(v[6], v[7]);
    return new Curve(
      null,
      new Segment(p0, new Point(0, 0), h0),
      new Segment(p1, h1, new Point(0, 0))
    );
  }

  /**
   * 静的なgetValues関数 - 制御点を配列として返す
   * Paper.jsと完全に同じシグネチャ
   */
  static getValues(
    segment1: any, segment2: any,
    matrix?: any | null, straight?: boolean | null
  ): number[] {
    // Paper.jsと同じ処理: 最後のセグメントが閉じていない場合、ハンドルを無視
    if (straight) {
      const p1 = segment1.point;
      const p2 = segment2.point;
      return [
        p1.x, p1.y,
        (p1.x * 2 + p2.x) / 3, (p1.y * 2 + p2.y) / 3,
        (p1.x + p2.x * 2) / 3, (p1.y + p2.y * 2) / 3,
        p2.x, p2.y
      ];
    }
  
    const p1 = segment1.point;
    const h1 = segment1.handleOut;
    const h2 = segment2.handleIn;
    const p2 = segment2.point;
    
    const values = [
      p1.x, p1.y,
      p1.x + h1.x, p1.y + h1.y,
      p2.x + h2.x, p2.y + h2.y,
      p2.x, p2.y
    ];
    
    if (matrix) {
      matrix._transformCoordinates(values, values, 4);
    }
    
    return values;
  }

  /**
   * 静的なgetValues関数 - 制御点を配列として返す
   * @param x0 始点のx座標
   * @param y0 始点のy座標
   * @param x1 制御点1のx座標
   * @param y1 制御点1のy座標
   * @param x2 制御点2のx座標
   * @param y2 制御点2のy座標
   * @param x3 終点のx座標
   * @param y3 終点のy座標
   * @returns 制御点配列 [x0,y0,x1,y1,x2,y2,x3,y3]
   */
  static getValues2(
    x0: number, y0: number,
    x1: number, y1: number,
    x2: number, y2: number,
    x3: number, y3: number
  ): number[] {
    return [x0, y0, x1, y1, x2, y2, x3, y3];
  }
  /**
   * 曲線をtで分割し、2つのCurveに分ける
   * paper.jsのCurve.subdivideに相当
   */
  static subdivideCurve(curve: Curve, t: number): [Curve, Curve] | null {
    // paper.jsと同様に、tが範囲外の場合はnullを返す代わりに、
    // 範囲内に収める
    const tMin = Numerical.CURVETIME_EPSILON;
    const tMax = 1 - tMin;
    if (t <= tMin || t >= tMax) {
      return null; // paper.jsと同様にnullを返す
    }
    
    const v = curve.getValues();
    const [left, right] = CurveSubdivision.subdivide(v, t);
    const hasHandles = curve.hasHandles();
    
    // left: [x0, y0, x4, y4, x7, y7, x9, y9]
    // right: [x9, y9, x8, y8, x6, y6, x3, y3]
    
    // 左側のセグメント
    const seg1 = curve._segment1;
    const seg2Left = new Segment(
      new Point(left[6], left[7]),
      hasHandles ? new Point(left[4] - left[6], left[5] - left[7]) : new Point(0, 0),
      new Point(0, 0)
    );
    
    // 右側のセグメント
    const seg1Right = new Segment(
      new Point(right[0], right[1]),
      new Point(0, 0),
      hasHandles ? new Point(right[2] - right[0], right[3] - right[1]) : new Point(0, 0)
    );
    const seg2 = curve._segment2;
    
    // ハンドルを調整
    if (hasHandles) {
      seg1._handleOut._set(left[2] - left[0], left[3] - left[1]);
      seg2._handleIn._set(right[4] - right[6], right[5] - right[7]);
    }
    
    // 変更を通知
    curve._changed();
    
    const leftCurve = new Curve(curve._path, seg1, seg2Left);
    const rightCurve = new Curve(curve._path, seg1Right, seg2);
    
    // パスの参照を設定
    leftCurve._path = curve._path;
    rightCurve._path = curve._path;
    
    return [leftCurve, rightCurve];
  }
}

// CurveGeometryクラスへの参照
import { CurveGeometry } from './CurveGeometry';