/**
 * Path クラス
 * Paper.js の Path (src/path/Path.js) を参考にしたイミュータブルなパス表現。
 * segments 配列と closed フラグを持ち、PathItem インターフェースを実装する。
 */

import { Point } from '../basic/Point';
import { Rectangle } from '../basic/Rectangle';
import { Curve, CurveLocation } from './Curve';
import { Segment } from './Segment';
import { Numerical } from '../util/Numerical';
import { PathItem } from './PathItem';

export class Path implements PathItem {
  readonly segments: Segment[];
  readonly closed: boolean;

  constructor(segments: Segment[] = [], closed: boolean = false) {
    // セグメント配列はコピーして保持（イミュータブル設計）
    this.segments = segments.slice();
    this.closed = closed;
  }

  get segmentCount(): number {
    return this.segments.length;
  }

  getLength(): number {
    // Curve を全て取得し、合計長を返す
    return this.getCurves().reduce((sum, curve) => sum + curve.getLength(), 0);
  }

  getBounds(): Rectangle {
    // paper.jsのCurve._addBoundsロジックを移植
    return this._computeBounds(0);
  }

  /**
   * paper.jsそっくりのストローク境界計算
   * @param strokeWidth 線幅
   */
  getStrokeBounds(strokeWidth: number): Rectangle {
    // strokeWidth/2をpaddingとしてAABB拡張
    return this._computeBounds(strokeWidth / 2);
  }

  /**
   * 内部: paddingを加味したAABB計算
   */
  private _computeBounds(padding: number): Rectangle {
    if (this.segments.length === 0) {
      return new Rectangle(new Point(0, 0), new Point(0, 0));
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    const add = (x: number, y: number) => {
      minX = Math.min(minX, x - padding);
      minY = Math.min(minY, y - padding);
      maxX = Math.max(maxX, x + padding);
      maxY = Math.max(maxY, y + padding);
    };

    // 各カーブ区間ごとにBézierの極値もAABBに含める
    for (let i = 0; i < this.segments.length - (this.closed ? 0 : 1); i++) {
      const seg0 = this.segments[i];
      const seg1 = this.segments[(i + 1) % this.segments.length];
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
        add(
          p0.x,
          p0.y
        );
        add(
          p1.x,
          p1.y
        );

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
              mt * mt * mt * v0 +
              3 * mt * mt * t * v1 +
              3 * mt * t * t * v2 +
              t * t * t * v3;
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
            add(
              dim === 'x' ? bez : other,
              dim === 'y' ? bez : other
            );
          }
        }
      }
    }
    return new Rectangle(new Point(minX, minY), new Point(maxX, maxY));
  }

  getPointAt(t: number): Point {
    // t: 0〜1 のパラメータでパス上の点を取得
    const curves = this.getCurves();
    if (curves.length === 0) return new Point(0, 0);
    const total = this.getLength();
    let acc = 0;
    for (const curve of curves) {
      const len = curve.getLength();
      if (total === 0) return curve.getPointAt(0);
      const next = acc + len;
      if (t * total <= next) {
        const localT = (t * total - acc) / len;
        return curve.getPointAt(localT);
      }
      acc = next;
    }
    // 端の場合
    return curves[curves.length - 1].getPointAt(1);
  }

  getTangentAt(t: number): Point {
    // t: 0〜1 のパラメータでパス上の接線ベクトルを取得
    const curves = this.getCurves();
    if (curves.length === 0) return new Point(0, 0);
    const total = this.getLength();
    let acc = 0;
    for (const curve of curves) {
      const len = curve.getLength();
      if (total === 0) return curve.getTangentAt(0);
      const next = acc + len;
      if (t * total <= next) {
        const localT = (t * total - acc) / len;
        return curve.getTangentAt(localT);
      }
      acc = next;
    }
    return curves[curves.length - 1].getTangentAt(1);
  }

  /**
   * paper.jsそっくりの点包含判定
   */
  contains(point: Point): boolean {
    // 頂点または辺上の点は外部扱い（paper.js仕様）
    const EPS = 1e-8;
    const curves = this.getCurves();
    // 頂点判定
    for (const seg of this.segments) {
      if (seg.point.equals(point)) return false;
    }
    // 辺上判定
    for (const curve of curves) {
      const p1 = curve.segment1.point;
      const p2 = curve.segment2.point;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len2 = dx * dx + dy * dy;
      if (len2 > 0) {
        const t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / len2;
        if (t >= 0 - EPS && t <= 1 + EPS) {
          const proj = new Point(p1.x + t * dx, p1.y + t * dy);
          if (proj.equals(point)) return false;
        }
      }
    }
    // paper.js本家のgetWindingロジック
    function getWinding(point: Point, curves: Curve[]): number {
      let winding = 0;
      for (const curve of curves) {
        const v = [
          curve.segment1.point.x, curve.segment1.point.y,
          curve.segment1.point.x + curve.segment1.handleOut.x, curve.segment1.point.y + curve.segment1.handleOut.y,
          curve.segment2.point.x + curve.segment2.handleIn.x, curve.segment2.point.y + curve.segment2.handleIn.y,
          curve.segment2.point.x, curve.segment2.point.y
        ];
        // y成分の範囲外ならスキップ
        const y = point.y;
        const minY = Math.min(v[1], v[3], v[5], v[7]);
        const maxY = Math.max(v[1], v[3], v[5], v[7]);
        if (y < minY || y > maxY) continue;
        // y成分の三次方程式
        const roots: number[] = [];
        const a = -v[1] + 3 * v[3] - 3 * v[5] + v[7];
        const b = 3 * v[1] - 6 * v[3] + 3 * v[5];
        const c = -3 * v[1] + 3 * v[3];
        const d = v[1] - y;
        Numerical.solveCubic(a, b, c, d, roots, 0, 1);
        for (const t of roots) {
          if (t < EPS || t > 1 - EPS) continue;
          // x座標を計算
          const mt = 1 - t;
          const x =
            mt * mt * mt * v[0] +
            3 * mt * mt * t * v[2] +
            3 * mt * t * t * v[4] +
            t * t * t * v[6];
          if (x > point.x) {
            // 上昇/下降で符号を分ける
            const dy =
              3 * (mt * mt * (v[3] - v[1]) +
                   2 * mt * t * (v[5] - v[3]) +
                   t * t * (v[7] - v[5]));
            winding += dy > 0 ? 1 : -1;
          }
        }
      }
      return winding;
    }
    // even-oddルール: 交差数の偶奇
    // nonzeroルール: winding!=0
    // Papyrus2Dはeven-oddルールをデフォルトとする
    const winding = getWinding(point, curves);
    return (winding & 1) === 1;
  }

  getCurves(): Curve[] {
    // セグメント配列から Curve 配列を生成
    const curves: Curve[] = [];
    for (let i = 0; i < this.segments.length - 1; i++) {
      curves.push(new Curve(this.segments[i], this.segments[i + 1]));
    }
    if (this.closed && this.segments.length > 1) {
      curves.push(new Curve(this.segments[this.segments.length - 1], this.segments[0]));
    }
    return curves;
  }

  // --- セグメント操作（イミュータブル: 新しいPathを返す） ---

  add(segment: Segment): Path {
    return new Path([...this.segments, segment], this.closed);
  }

  insert(index: number, segment: Segment): Path {
    const newSegments = this.segments.slice();
    newSegments.splice(index, 0, segment);
    return new Path(newSegments, this.closed);
  }

  removeSegment(index: number): Path {
    const newSegments = this.segments.slice();
    newSegments.splice(index, 1);
    return new Path(newSegments, this.closed);
  }

  // --- サブパス操作 ---

  moveTo(point: Point): Path {
    // 新しいサブパスを開始（既存セグメントをクリアし、1点のみのPathを返す）
    return new Path([new Segment(point)], false);
  }

  lineTo(point: Point): Path {
    // 最後の点から直線セグメントを追加
    if (this.segments.length === 0) {
      return this.add(new Segment(point));
    }
    return this.add(new Segment(point));
  }

  /**
   * cubicCurveTo: smoothHandles/selfClosing対応
   * @param handle1
   * @param handle2
   * @param to
   * @param options.smoothHandles: 連続ノードのハンドルを平滑化
   * @param options.selfClosing: 始点と終点が一致していれば自動的にclose
   */
  cubicCurveTo(
    handle1: Point,
    handle2: Point,
    to: Point,
    options?: { smoothHandles?: boolean; selfClosing?: boolean }
  ): Path {
    if (this.segments.length === 0) {
      return this.add(new Segment(to));
    }
    const newSegments = this.segments.slice();
    const lastIdx = newSegments.length - 1;
    const lastSeg = newSegments[lastIdx];
    // handleOut: handle1 - last.point
    let relHandleOut = handle1.subtract(lastSeg.point);
    let relHandleIn = handle2.subtract(to);

    // smoothHandles: 連続ノードのハンドルを平滑化
    if (options?.smoothHandles && lastIdx > 0) {
      const prev = newSegments[lastIdx - 1].point;
      const curr = lastSeg.point;
      // Catmull-Rom的な平滑化
      relHandleOut = curr.subtract(prev).multiply(1 / 3);
      relHandleIn = to.subtract(lastSeg.point).multiply(-1 / 3);
    }

    const last = lastSeg.withHandleOut(relHandleOut);
    newSegments[lastIdx] = last;
    newSegments.push(new Segment(to, relHandleIn, new Point(0, 0)));

    // selfClosing: 始点と終点が一致していれば自動的にclose
    let closed = this.closed;
    if (options?.selfClosing) {
      const firstPt = newSegments[0].point;
      const lastPt = to;
      if (firstPt.equals(lastPt)) {
        closed = true;
      }
    }
    return new Path(newSegments, closed);
  }

/**
   * 全セグメントのハンドルを自動補正（paper.jsのsmooth相当, Catmull-Rom的）
   */
  smooth(): Path {
    if (this.segments.length < 3) return this;
    const newSegments = this.segments.slice();
    for (let i = 1; i < this.segments.length - 1; i++) {
      const prev = this.segments[i - 1].point;
      const curr = this.segments[i].point;
      const next = this.segments[i + 1].point;
      // ハンドルは前後点の差分を1/6ずつ
      const handleIn = prev.subtract(next).multiply(-1 / 6);
      const handleOut = next.subtract(prev).multiply(1 / 6);
      newSegments[i] = new Segment(
        newSegments[i].point,
        handleIn,
        handleOut
      );
    }
    return new Path(newSegments, this.closed);
  }
  close(): Path {
    return new Path(this.segments, true);
  }
// Boolean演算API（unite, intersect, subtract, exclude, divide）
  unite(other: Path): Path {
    throw new Error('uniteは未実装です（paper.js BooleanOperations参照）');
  }
  intersect(other: Path): Path {
    throw new Error('intersectは未実装です（paper.js BooleanOperations参照）');
  }
  subtract(other: Path): Path {
    throw new Error('subtractは未実装です（paper.js BooleanOperations参照）');
  }
  exclude(other: Path): Path {
    throw new Error('excludeは未実装です（paper.js BooleanOperations参照）');
  }
  divide(other: Path): Path {
    throw new Error('divideは未実装です（paper.js BooleanOperations参照）');
  }

  /**
     * 2つのPathの全Curveペアについて交点を列挙
     */
  getIntersections(other: Path): CurveLocation[] {
    const result: CurveLocation[] = [];
    const curves1 = this.getCurves();
    const curves2 = other.getCurves();
    for (let i = 0; i < curves1.length; i++) {
      for (let j = 0; j < curves2.length; j++) {
        const v1 = [
          curves1[i].segment1.point.x, curves1[i].segment1.point.y,
          curves1[i].segment1.point.x + curves1[i].segment1.handleOut.x, curves1[i].segment1.point.y + curves1[i].segment1.handleOut.y,
          curves1[i].segment2.point.x + curves1[i].segment2.handleIn.x, curves1[i].segment2.point.y + curves1[i].segment2.handleIn.y,
          curves1[i].segment2.point.x, curves1[i].segment2.point.y
        ];
        const v2 = [
          curves2[j].segment1.point.x, curves2[j].segment1.point.y,
          curves2[j].segment1.point.x + curves2[j].segment1.handleOut.x, curves2[j].segment1.point.y + curves2[j].segment1.handleOut.y,
          curves2[j].segment2.point.x + curves2[j].segment2.handleIn.x, curves2[j].segment2.point.y + curves2[j].segment2.handleIn.y,
          curves2[j].segment2.point.x, curves2[j].segment2.point.y
        ];
        const intersections = Curve.getIntersections(v1, v2);
        for (const inter of intersections) {
          result.push({
            curve1Index: i,
            curve2Index: j,
            t1: inter.t1,
            t2: inter.t2,
            point: inter.point
          });
        }
      }
    }
    return result;
  }

}
