/**
 * CurveLocationUtils: 曲線上の点の位置情報や交点計算に関連する機能
 * Curve.tsから分離した静的位置計算関数群
 */

import { Point } from '../basic/Point';
import { Curve } from './Curve';
import { CurveLocation } from './CurveLocation';
import { Numerical, RangeConstraint } from '../util/Numerical';
import { CurveCalculation } from './CurveCalculation';
import { CurveGeometry } from './CurveGeometry';

export class CurveLocationUtils {
  /**
   * 曲線上の点のtパラメータを取得
   * paper.jsのgetTimeOf実装を移植
   */
  static getTimeOf(v: number[], point: Point): number | null {
    // Before solving cubics, compare the beginning and end of the curve
    // with zero epsilon:
    var p0 = new Point(v[0], v[1]),
      p3 = new Point(v[6], v[7]),
      epsilon = /*#=*/ Numerical.EPSILON,
      geomEpsilon = /*#=*/ Numerical.GEOMETRIC_EPSILON,
      t = point.isClose(p0, epsilon) ? 0 : point.isClose(p3, epsilon) ? 1 : null;
    if (t === null) {
      // Solve the cubic for both x- and y-coordinates and consider all
      // solutions, testing with the larger / looser geometric epsilon.
      var coords = [point.x, point.y],
        roots = [];
      for (var c = 0; c < 2; c++) {
        var count = Curve.solveCubic(v, c, coords[c], roots, 0, 1);
        for (var i = 0; i < count; i++) {
          var u = roots[i];
          if (point.isClose(Curve.getPoint(v, u), geomEpsilon)) return u;
        }
      }
    }
    // Since we're comparing with geometric epsilon for any other t along
    // the curve, do so as well now for the beginning and end of the curve.
    return point.isClose(p0, geomEpsilon) ? 0 : point.isClose(p3, geomEpsilon) ? 1 : null;
  }

  /**
   * 曲線上の最も近い点のtパラメータを取得
   * paper.jsのgetNearestTime実装を移植
   */
  static getNearestTime(v: number[], point: Point): number {
    if (CurveGeometry.isStraight(v)) {
      const x0 = v[0],
        y0 = v[1];
      const x3 = v[6],
        y3 = v[7];
      const vx = x3 - x0,
        vy = y3 - y0;
      const det = vx * vx + vy * vy;

      // ゼロ除算を避ける
      if (det === 0) return 0;

      // 点を線上に投影し、線形パラメータuを計算: u = (point - p1).dot(v) / v.dot(v)
      const u = ((point.x - x0) * vx + (point.y - y0) * vy) / det;

      if (u < Numerical.EPSILON) return 0;
      if (u > 1 - Numerical.EPSILON) return 1;

      const timeOf = CurveLocationUtils.getTimeOf(v, new Point(x0 + u * vx, y0 + u * vy));
      return timeOf !== null ? timeOf : 0;
    }

    const count = 100;
    let minDist = Infinity;
    let minT = 0;

    function refine(t: number): boolean {
      if (t >= 0 && t <= 1) {
        const p = CurveCalculation.getPoint(v, t)!;
        const dist = point.getDistance(p, true);
        if (dist < minDist) {
          minDist = dist;
          minT = t;
          return true;
        }
      }
      return false;
    }

    for (let i = 0; i <= count; i++) {
      refine(i / count);
    }

    // 解を反復的に精製して所望の精度に達するまで
    let step = 1 / (count * 2);
    while (step > Numerical.CURVETIME_EPSILON) {
      if (!refine(minT - step) && !refine(minT + step)) {
        step /= 2;
      }
    }

    return minT;
  }

  /**
   * 三次方程式を解く
   * paper.jsのsolveCubic実装を移植
   */
  static solveCubic(
    v: number[],
    coord: number,
    val: number,
    roots: number[],
    range?: RangeConstraint
  ): number {
    const v0 = v[coord];
    const v1 = v[coord + 2];
    const v2 = v[coord + 4];
    const v3 = v[coord + 6];
    let res = 0;

    // 値が曲線の範囲外にある場合、解は存在しない
    if (
      !(
        (v0 < val && v3 < val && v1 < val && v2 < val) ||
        (v0 > val && v3 > val && v1 > val && v2 > val)
      )
    ) {
      const c = 3 * (v1 - v0);
      const b = 3 * (v2 - v1) - c;
      const a = v3 - v0 - c - b;

      res = Numerical.solveCubic(a, b, c, v0 - val, roots, range);
    }

    return res;
  }

  /**
   * 指定されたオフセットでの曲線のtパラメータを計算
   */
  static getTimeAt(v: number[], offset: number, start?: number): number | null {
    if (start === undefined) start = offset < 0 ? 1 : 0;
    if (offset === 0) return start;

    // 前進または後退を判断し、それに応じて処理
    const abs = Math.abs;
    const epsilon = Numerical.EPSILON;
    const forward = offset > 0;
    const a = forward ? start : 0;
    const b = forward ? 1 : start;

    // 積分を使用して範囲の長さと部分長を計算
    const ds = CurveGeometry.getLengthIntegrand(v);
    // 全範囲の長さを取得
    const rangeLength = Curve.getLength(v, a, b, ds);
    const diff = abs(offset) - rangeLength;

    if (abs(diff) < epsilon) {
      // 終点に一致
      return forward ? b : a;
    } else if (diff > epsilon) {
      // 範囲外
      return null; // 範囲外の場合はnullを返す
    }

    // 初期推測値としてoffset / rangeLengthを使用
    const guess = offset / rangeLength;
    let length = 0;
    let currentStart = start;

    // 曲線範囲の長さを反復的に計算し、それらを合計
    function f(t: number): number {
      // startがtより大きい場合、積分は負の値を返す
      length += Numerical.integrate(
        ds,
        currentStart,
        t,
        CurveGeometry.getIterations(currentStart, t)
      );
      currentStart = t;
      return length - offset;
    }

    // 初期推測値から始める
    return Numerical.findRoot(f, ds, start + guess, a, b, 32, epsilon);
  }
  /**
   * 2つのCurveLocationが等しいかを確認する静的メソッド
   * @param loc1 比較対象のCurveLocation
   * @param loc2 比較対象のCurveLocation
   * @param ignoreOther 相互参照を無視するかどうか
   * @returns 等しければtrue
   */
  static equals(loc1: CurveLocation, loc2: CurveLocation, ignoreOther: boolean = false): boolean {
    let res = loc1 === loc2;
    if (!res && loc2 instanceof CurveLocation) {
      const c1 = loc1.getCurve()!;
      const c2 = loc2.getCurve()!;
      const p1 = c1._path;
      const p2 = c2._path;
      if (p1 === p2) {
        // 曲線時間ではなく、実際のオフセットを比較して
        // 同じ位置にあるかどうかを判断
        const abs = Math.abs;
        const epsilon = Numerical.GEOMETRIC_EPSILON;
        const diff = abs(loc1.getOffset() - loc2.getOffset());
        const i1 = !ignoreOther && loc1._intersection;
        const i2 = !ignoreOther && loc2._intersection;
        res = !!(
          (diff < epsilon || Boolean(p1 && abs(p1.getLength() - diff) < epsilon)) &&
          ((!i1 && !i2) || (i1 && i2 && !!i1.equals(i2, true)))
        );
      }
    }
    return res;
  }

  /**
   * 交点が交差しているかを確認する静的メソッド
   * paper.jsのCurveLocation.isCrossingメソッドを完全に実装
   * @param loc CurveLocation
   * @returns 交差していればtrue
   */
  static isCrossing(loc: CurveLocation): boolean {
    // 交点がない場合はfalse
    const inter = loc._intersection;
    if (!inter) {
      return false;
    }

    // 時間パラメータを取得
    const t1 = loc.getTime();
    const t2 = inter.getTime();
    if (t1 === null || t2 === null) {
      return false;
    }

    const tMin = Numerical.CURVETIME_EPSILON;
    const tMax = 1 - tMin;

    // 時間パラメータが曲線の内部にあるかを確認
    const t1Inside = t1 >= tMin && t1 <= tMax;
    const t2Inside = t2 >= tMin && t2 <= tMax;

    // 両方の交点が曲線の内部にある場合、接触でなければ交差
    if (t1Inside && t2Inside) {
      const isTouching = loc.isTouching();
      return !isTouching;
    }

    // 以下はpaper.jsの完全な実装
    // 交差に関わる4つの曲線の参照を取得
    const c2 = loc.getCurve();
    if (!c2) return false;

    const c1 = t1 < tMin ? c2.getPrevious() : c2;
    if (!c1) return false;

    const c4 = inter.getCurve();
    if (!c4) return false;

    const c3 = t2 < tMin ? c4.getPrevious() : c4;
    if (!c3) return false;

    // t1/t2が終点にある場合、次の曲線に進む
    const c2Next = t1 > tMax ? c2.getNext() : null;
    const c4Next = t2 > tMax ? c4.getNext() : null;

    const curves = [c1, c2, c3, c4];
    if (c2Next) curves[1] = c2Next;
    if (c4Next) curves[3] = c4Next;

    // 4つの曲線すべてが存在することを確認
    if (curves.some((c) => !c)) return false;

    // 交点での曖昧でない角度を計算するためのオフセットを追加
    const offsets: number[] = [];

    // 曲線上の曖昧でない方向のオフセットを見つける関数
    function addOffsets(curve: Curve, end: boolean): void {
      const v = curve.getValues();
      const roots = CurveGeometry.classify(v).roots || [];
      const count = roots.length;

      // 曲線の長さを計算
      let offset: number;
      if (end && count > 0) {
        offset = Curve.getLength(v, roots[count - 1], 1);
      } else if (!end && count > 0) {
        offset = Curve.getLength(v, 0, roots[0]);
      } else {
        offset = Curve.getLength(v, 0, 1);
      }

      // ルートが見つからない場合、長さの一部を使用
      offsets.push(count ? offset : offset / 32);
    }

    // 角度が範囲内にあるかを確認する関数
    function isInRange(angle: number, min: number, max: number): boolean {
      return min < max
        ? angle > min && angle < max
        : // min > max: 範囲が-180/180度を超える
          angle > min || angle < max;
    }

    // t1が曲線の内部にない場合、オフセットを追加
    if (!t1Inside) {
      addOffsets(curves[0], true);
      addOffsets(curves[1], false);
    }

    // t2が曲線の内部にない場合、オフセットを追加
    if (!t2Inside) {
      addOffsets(curves[2], true);
      addOffsets(curves[3], false);
    }

    // 交点の座標を取得
    const pt = loc.getPoint();

    // すべての関連する曲線で最短のオフセットを決定
    const offset = Math.min(...offsets);

    // 各曲線の接線ベクトルを計算
    let v2, v1, v4, v3: Point;

    // 268行目で curves.some(c => !c) をチェックしているので、
    // curves配列の要素はnullでないことが保証されている
    if (t1Inside) {
      const tangent = c2.getTangentAtTime(t1);
      if (!tangent) return false;
      v2 = tangent;
      v1 = v2.negate();
    } else {
      const c1 = curves[0];
      const c2 = curves[1];
      const p1 = c1.getPointAtTime(c1.getTimeAt(-offset)!);
      const p2 = c2.getPointAtTime(c2.getTimeAt(offset)!);
      if (!p1 || !p2) return false;
      v1 = p1.subtract(pt);
      v2 = p2.subtract(pt);
    }

    if (t2Inside) {
      const tangent = c4.getTangentAtTime(t2);
      if (!tangent) return false;
      v4 = tangent;
      v3 = v4.negate();
    } else {
      const c3 = curves[2];
      const c4 = curves[3];
      const p3 = c3.getPointAtTime(c3.getTimeAt(-offset)!);
      const p4 = c4.getPointAtTime(c4.getTimeAt(offset)!);
      if (!p3 || !p4) return false;
      v3 = p3.subtract(pt);
      v4 = p4.subtract(pt);
    }

    // 各ベクトルの角度を計算
    const a1 = v1.getAngle();
    const a2 = v2.getAngle();
    const a3 = v3.getAngle();
    const a4 = v4.getAngle();

    // 曲線2の角度が曲線1の角度の間に何回現れるかをカウント
    // 各角度ペアが他の2つを分割する場合、エッジは交差する
    // t1Insideを使用して、どの角度ペアをチェックするかを決定
    return !!(t1Inside
      ? isInRange(a1, a3, a4) !== isInRange(a2, a3, a4) &&
        isInRange(a1, a4, a3) !== isInRange(a2, a4, a3)
      : isInRange(a3, a1, a2) !== isInRange(a4, a1, a2) &&
        isInRange(a3, a2, a1) !== isInRange(a4, a2, a1));
  }
}
