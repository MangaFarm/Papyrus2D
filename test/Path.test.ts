import { describe, it, expect } from 'vitest';
import { Point } from '../src/basic/Point';
import { Segment } from '../src/path/Segment';
import { Path } from '../src/path/Path';

describe('Path', () => {
  it('should create an empty path', () => {
    const path = new Path();
    expect(path.segments.length).toBe(0);
    expect(path.closed).toBe(false);
  });

  it('should add segments immutably', () => {
    const seg1 = new Segment(new Point(0, 0));
    const seg2 = new Segment(new Point(10, 0));
    const path1 = new Path([seg1]);
    const path2 = path1.add(seg2);
    expect(path1.segments.length).toBe(1);
    expect(path2.segments.length).toBe(2);
    expect(path2.segments[1].point.equals(new Point(10, 0))).toBe(true);
  });

  it('should insert and remove segments immutably', () => {
    const seg1 = new Segment(new Point(0, 0));
    const seg2 = new Segment(new Point(10, 0));
    const seg3 = new Segment(new Point(20, 0));
    const path = new Path([seg1, seg3]);
    const path2 = path.insert(1, seg2);
    expect(path2.segments[1].point.equals(new Point(10, 0))).toBe(true);
    const path3 = path2.removeSegment(1);
    expect(path3.segments[1].point.equals(new Point(20, 0))).toBe(true);
  });

  it('should calculate bounds correctly', () => {
    const seg1 = new Segment(new Point(0, 0));
    const seg2 = new Segment(new Point(10, 10));
    const path = new Path([seg1, seg2]);
    const bounds = path.getBounds();
    expect(bounds.topLeft.equals(new Point(0, 0))).toBe(true);
    expect(bounds.bottomRight.equals(new Point(10, 10))).toBe(true);
  });

  it('should expand bounds correctly with getStrokeBounds (strokePadding)', () => {
    const seg1 = new Segment(new Point(0, 0));
    const seg2 = new Segment(new Point(10, 10));
    const path = new Path([seg1, seg2]);
    const strokeWidth = 4;
    const bounds = path.getBounds();
    const strokeBounds = path.getStrokeBounds(strokeWidth);
    // strokeBoundsは各辺をstrokeWidth/2だけ拡張しているはず
    expect(strokeBounds.topLeft.x).toBeCloseTo(bounds.topLeft.x - 2, 6);
    expect(strokeBounds.topLeft.y).toBeCloseTo(bounds.topLeft.y - 2, 6);
    expect(strokeBounds.bottomRight.x).toBeCloseTo(bounds.bottomRight.x + 2, 6);
    expect(strokeBounds.bottomRight.y).toBeCloseTo(bounds.bottomRight.y + 2, 6);
  });

  it('should close the path', () => {
    const seg1 = new Segment(new Point(0, 0));
    const seg2 = new Segment(new Point(10, 0));
    const path = new Path([seg1, seg2]);
    const closedPath = path.close();
    expect(closedPath.closed).toBe(true);
  });

  it('should get point at t=0 and t=1', () => {
    const seg1 = new Segment(new Point(0, 0));
    const seg2 = new Segment(new Point(10, 0));
    const path = new Path([seg1, seg2]);
    expect(path.getPointAt(0).equals(new Point(0, 0))).toBe(true);
    expect(path.getPointAt(1).equals(new Point(10, 0))).toBe(true);
  });

  it('should include handle points in getBounds (bezier)', () => {
    // (0,0) --handleOut=(10,10)--> (20,0)
    const seg1 = new Segment(new Point(0, 0), new Point(0, 0), new Point(10, 10));
    const seg2 = new Segment(new Point(20, 0), new Point(-10, 10), new Point(0, 0));
    const path = new Path([seg1, seg2]);
    const bounds = path.getBounds();
    // ハンドル先端 (10,10) および (10,10) を含む
    expect(bounds.topLeft.x).toBeLessThanOrEqual(0);
    expect(bounds.topLeft.y).toBeLessThanOrEqual(0);
    expect(bounds.bottomRight.x).toBeGreaterThanOrEqual(20);
    // Bézier 曲線の極値は y=7.5。paper.js 本家に合わせて期待値を修正
    expect(bounds.bottomRight.y).toBeGreaterThanOrEqual(7.5);
  });

  it('should return true for contains() inside closed triangle, false outside', () => {
    const seg1 = new Segment(new Point(0, 0));
    const seg2 = new Segment(new Point(10, 0));
    const seg3 = new Segment(new Point(5, 10));
    const path = new Path([seg1, seg2, seg3], true);
    expect(path.contains(new Point(5, 5))).toBe(true); // 内部
    expect(path.contains(new Point(0, 0))).toBe(false); // 頂点上は外部扱い
    expect(path.contains(new Point(20, 20))).toBe(false); // 完全外部
  });

  it('should follow even-odd rule for self-intersecting (figure-eight) path', () => {
    // 8の字型パス: (0,0)-(20,20)-(0,20)-(20,0)-(0,0)
    const seg1 = new Segment(new Point(0, 0));
    const seg2 = new Segment(new Point(20, 20));
    const seg3 = new Segment(new Point(0, 20));
    const seg4 = new Segment(new Point(20, 0));
    const path = new Path([seg1, seg2, seg3, seg4], true);
    // 8の字の中央（交点）は外部
    expect(path.contains(new Point(10, 10))).toBe(false);
    // ループ内（左上）は内部
    expect(path.contains(new Point(5, 15))).toBe(true);
    // ループ内（右下）も内部
    expect(path.contains(new Point(15, 5))).toBe(true);
    // 完全外部
    expect(path.contains(new Point(-5, 10))).toBe(false);
  });

  it('should get tangent at t=0 and t=1', () => {
    const seg1 = new Segment(new Point(0, 0));
    const seg2 = new Segment(new Point(10, 0));
    const path = new Path([seg1, seg2]);
    expect(path.getTangentAt(0).equals(new Point(1, 0))).toBe(true);
    expect(path.getTangentAt(1).equals(new Point(1, 0))).toBe(true);
  });
it('should find intersection of two crossing lines', () => {
    // (0,0)-(10,0) と (5,-5)-(5,5) は (5,0) で交差
    const segA1 = new Segment(new Point(0, 0));
    const segA2 = new Segment(new Point(10, 0));
    const pathA = new Path([segA1, segA2]);

    const segB1 = new Segment(new Point(5, -5));
    const segB2 = new Segment(new Point(5, 5));
    const pathB = new Path([segB1, segB2]);

    const intersections = pathA.getIntersections(pathB);
    expect(intersections.length).toBe(1);
    expect(intersections[0].point.x).toBeCloseTo(5, 6);
    expect(intersections[0].point.y).toBeCloseTo(0, 6);
  });

  it('should find two intersections of two crossing beziers', () => {
    // 2つのS字ベジェ曲線が2点で交差
    const segA1 = new Segment(new Point(0, 0), new Point(0, 0), new Point(30, 40));
    const segA2 = new Segment(new Point(100, 0), new Point(-30, 40), new Point(0, 0));
    const pathA = new Path([segA1, segA2]);

    const segB1 = new Segment(new Point(0, 100), new Point(0, 0), new Point(30, -40));
    const segB2 = new Segment(new Point(100, 100), new Point(-30, -40), new Point(0, 0));
    const pathB = new Path([segB1, segB2]);

    const intersections = pathA.getIntersections(pathB);
    expect(intersections.length).toBe(2);
    // 交点座標の大まかな検証（順不同）
    const xs = intersections.map(i => Math.round(i.point.x));
    const ys = intersections.map(i => Math.round(i.point.y));
    expect(xs).toContain(25);
    expect(xs).toContain(75);
    expect(ys).toContain(50);
    expect(ys).toContain(50);
  });
});
it('should throw error for unimplemented Boolean operations: intersect', () => {
  const seg1 = new Segment(new Point(0, 0));
  const seg2 = new Segment(new Point(10, 0));
  const pathA = new Path([seg1, seg2]);
  const pathB = new Path([seg1, seg2]);
  expect(() => pathA.intersect(pathB)).toThrow('intersectは未実装です');
});

it('should throw error for unimplemented Boolean operations: subtract', () => {
  const seg1 = new Segment(new Point(0, 0));
  const seg2 = new Segment(new Point(10, 0));
  const pathA = new Path([seg1, seg2]);
  const pathB = new Path([seg1, seg2]);
  expect(() => pathA.subtract(pathB)).toThrow('subtractは未実装です');
});

// uniteは空実装なので型・返り値の検証のみ
it('should throw error for unimplemented Boolean operations: unite', () => {
  const seg1 = new Segment(new Point(0, 0));
  const seg2 = new Segment(new Point(10, 0));
  const pathA = new Path([seg1, seg2]);
  const pathB = new Path([seg1, seg2]);
  expect(() => pathA.unite(pathB)).toThrow('uniteは未実装です');
});
it('should add a cubic bezier segment with cubicCurveTo', () => {
  const seg1 = new Segment(new Point(0, 0));
  const path = new Path([seg1]);
  const handle1 = new Point(10, 0);
  const handle2 = new Point(10, 10);
  const to = new Point(20, 10);
  const path2 = path.cubicCurveTo(handle1, handle2, to);
  expect(path2.segments.length).toBe(2);
  // 終点が正しい
  expect(path2.segments[1].point.equals(to)).toBe(true);
  // ハンドルが正しい
  expect(path2.segments[0].handleOut.equals(handle1.subtract(seg1.point))).toBe(true);
  expect(path2.segments[1].handleIn.equals(handle2.subtract(to))).toBe(true);
});

it('should smooth handles with cubicCurveTo({ smoothHandles: true })', () => {
  const seg1 = new Segment(new Point(0, 0));
  const seg2 = new Segment(new Point(10, 0));
  const path = new Path([seg1, seg2]);
  const handle1 = new Point(20, 0);
  const handle2 = new Point(20, 10);
  const to = new Point(30, 10);
  const path2 = path.cubicCurveTo(handle1, handle2, to, { smoothHandles: true });
  // 2番目のセグメントのhandleOutが平滑化されている
  const expectedHandleOut = seg2.point.subtract(seg1.point).multiply(1 / 3);
  expect(path2.segments[1].handleOut.equals(expectedHandleOut)).toBe(true);
});

it('should close path automatically with cubicCurveTo({ selfClosing: true })', () => {
  const seg1 = new Segment(new Point(0, 0));
  const seg2 = new Segment(new Point(10, 0));
  const path = new Path([seg1, seg2]);
  const handle1 = new Point(0, 10);
  const handle2 = new Point(10, 10);
  const to = new Point(0, 0); // 始点と同じ
  const path2 = path.cubicCurveTo(handle1, handle2, to, { selfClosing: true });
  expect(path2.closed).toBe(true);
});