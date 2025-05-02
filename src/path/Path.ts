/**
 * Path クラス
 * Paper.js の Path (src/path/Path.js) を参考にしたイミュータブルなパス表現。
 * segments 配列と closed フラグを持ち、PathItem インターフェースを実装する。
 */

import { Point } from '../basic/Point';
import { Rectangle } from '../basic/Rectangle';
import { Curve } from './Curve';
import { Segment } from './Segment';
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
    // paper.jsと同様、全てのベジェ制御点（anchor, handleIn, handleOut）を含む厳密な外接矩形
    if (this.segments.length === 0) {
      return new Rectangle(new Point(0, 0), new Point(0, 0));
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      // アンカーポイント
      const pts = [seg.point];
      // handleIn（前のカーブの終端制御点）
      if (!seg.handleIn.isZero()) {
        pts.push(seg.point.add(seg.handleIn));
      }
      // handleOut（次のカーブの始端制御点）
      if (!seg.handleOut.isZero()) {
        pts.push(seg.point.add(seg.handleOut));
      }
      for (const pt of pts) {
        minX = Math.min(minX, pt.x);
        minY = Math.min(minY, pt.y);
        maxX = Math.max(maxX, pt.x);
        maxY = Math.max(maxY, pt.y);
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
    for (const curve of curves) {
      const p1 = curve.segment1.point;
      const p2 = curve.segment2.point;
      if (
        ((p1.y > point.y) !== (p2.y > point.y)) &&
        (point.x < ((p2.x - p1.x) * (point.y - p1.y)) / (p2.y - p1.y + 1e-12) + p1.x)
      ) {
        crossings++;
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
    // 最後のセグメントの handleOut, 新規セグメントの handleIn/point を設定
    if (this.segments.length === 0) {
      // 始点がない場合は to のみ追加
      return this.add(new Segment(to));
    }
    const newSegments = this.segments.slice();
    // 最後のセグメントの handleOut を設定
    const last = newSegments[newSegments.length - 1].withHandleOut(handle1);
    newSegments[newSegments.length - 1] = last;
    // 新しいセグメントを追加
    newSegments.push(new Segment(to, handle2, new Point(0, 0)));
    return new Path(newSegments, this.closed);
  }

  close(): Path {
    return new Path(this.segments, true);
  }
}