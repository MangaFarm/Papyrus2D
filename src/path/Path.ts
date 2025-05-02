/**
 * Path クラス
 * Paper.js の Path (src/path/Path.js) を参考にしたイミュータブルなパス表現。
 * segments 配列と closed フラグを持ち、PathItem インターフェースを実装する。
 */

import { Point } from '../basic/Point';
import { Rectangle } from '../basic/Rectangle';
import { Curve } from './Curve';
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
    if (this.segments.length === 0) {
      return new Rectangle(new Point(0, 0), new Point(0, 0));
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    const add = (x: number, y: number) => {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
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
        // 線分上のパラメータtを計算
        const t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / len2;
        if (t >= 0 - EPS && t <= 1 + EPS) {
          // 線分上の最近点
          const proj = new Point(p1.x + t * dx, p1.y + t * dy);
          if (proj.equals(point)) return false;
        }
      }
    }
    // winding number アルゴリズム（even-odd ルール）
    let crossings = 0;
    // 曲線区間も含めてBézier曲線と水平方向の直線の交点を厳密に求める
    for (const curve of curves) {
      const p0 = curve.segment1.point;
      const p1 = p0.add(curve.segment1.handleOut);
      const p2 = curve.segment2.point.add(curve.segment2.handleIn);
      const p3 = curve.segment2.point;
      // y成分がpoint.yと等しくなるtを全て求める
      const roots: number[] = [];
      const a = -p0.y + 3 * p1.y - 3 * p2.y + p3.y;
      const b = 3 * p0.y - 6 * p1.y + 3 * p2.y;
      const c = -3 * p0.y + 3 * p1.y;
      const d = p0.y - point.y;
      // solveCubic(a, b, c, d, roots, 0, 1)
      // 0 < t < 1 の範囲で交点を全て求める
      Numerical.solveCubic(a, b, c, d, roots, 0, 1);
      for (const t of roots) {
        if (t < 0 || t > 1) continue;
        // tでのx座標
        const mt = 1 - t;
        const x =
          mt * mt * mt * p0.x +
          3 * mt * mt * t * p1.x +
          3 * mt * t * t * p2.x +
          t * t * t * p3.x;
        if (x > point.x) crossings++;
      }
    }
    return (crossings % 2) === 1;
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
    const last = this.segments[this.segments.length - 1];
    return this.add(new Segment(point));
  }

  cubicCurveTo(handle1: Point, handle2: Point, to: Point): Path {
    // paper.jsと同様、handleOut/handleInを相対値で設定
    if (this.segments.length === 0) {
      // 始点がない場合は to のみ追加
      return this.add(new Segment(to));
    }
    const newSegments = this.segments.slice();
    const lastSeg = newSegments[newSegments.length - 1];
    // handleOut: handle1 - last.point
    const relHandleOut = handle1.subtract(lastSeg.point);
    const last = lastSeg.withHandleOut(relHandleOut);
    newSegments[newSegments.length - 1] = last;
    // handleIn: handle2 - to
    const relHandleIn = handle2.subtract(to);
    newSegments.push(new Segment(to, relHandleIn, new Point(0, 0)));
    return new Path(newSegments, this.closed);
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
}