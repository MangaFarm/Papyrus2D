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

  it('should get tangent at t=0 and t=1', () => {
    const seg1 = new Segment(new Point(0, 0));
    const seg2 = new Segment(new Point(10, 0));
    const path = new Path([seg1, seg2]);
    expect(path.getTangentAt(0).equals(new Point(1, 0))).toBe(true);
    expect(path.getTangentAt(1).equals(new Point(1, 0))).toBe(true);
  });
});