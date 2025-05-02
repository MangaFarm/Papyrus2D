import { describe, it, expect } from 'vitest';
import { Point } from '../src/basic/Point';
import { Segment } from '../src/path/Segment';
import { Curve } from '../src/path/Curve';

describe('Curve', () => {
  it('should return correct length for a straight line', () => {
    const seg1 = new Segment(new Point(0, 0));
    const seg2 = new Segment(new Point(3, 4));
    const curve = new Curve(seg1, seg2);
    expect(curve.getLength()).toBeCloseTo(5, 8);
  });

  it('should return correct point at t=0, t=1 for a straight line', () => {
    const seg1 = new Segment(new Point(0, 0));
    const seg2 = new Segment(new Point(3, 4));
    const curve = new Curve(seg1, seg2);
    expect(curve.getPointAt(0).equals(new Point(0, 0))).toBe(true);
    expect(curve.getPointAt(1).equals(new Point(3, 4))).toBe(true);
  });

  it('should return correct tangent for a straight line', () => {
    const seg1 = new Segment(new Point(0, 0));
    const seg2 = new Segment(new Point(3, 4));
    const curve = new Curve(seg1, seg2);
    const tangent = curve.getTangentAt(0.5);
    // 直線なので常に(3,4)方向
    expect(tangent.x / tangent.y).toBeCloseTo(3 / 4, 8);
  });

  it('should return correct length for a cubic Bezier curve', () => {
    const seg1 = new Segment(new Point(0, 0), new Point(0, 0), new Point(1, 2));
    const seg2 = new Segment(new Point(3, 4), new Point(-1, -2), new Point(0, 0));
    const curve = new Curve(seg1, seg2);
    // 厳密値は難しいが、直線より長いはず
    expect(curve.getLength()).toBeGreaterThan(5);
  });

  it('should return correct point at t=0.5 for a cubic Bezier curve', () => {
    const seg1 = new Segment(new Point(0, 0), new Point(0, 0), new Point(1, 2));
    const seg2 = new Segment(new Point(3, 4), new Point(-1, -2), new Point(0, 0));
    const curve = new Curve(seg1, seg2);
    const pt = curve.getPointAt(0.5);
    // だいたい中間付近
    expect(pt.x).toBeGreaterThan(1);
    expect(pt.x).toBeLessThan(3);
    expect(pt.y).toBeGreaterThan(1);
    expect(pt.y).toBeLessThan(4);
  });

  it('should return correct tangent at t=0, t=1 for a cubic Bezier curve', () => {
    const seg1 = new Segment(new Point(0, 0), new Point(0, 0), new Point(1, 2));
    const seg2 = new Segment(new Point(3, 4), new Point(-1, -2), new Point(0, 0));
    const curve = new Curve(seg1, seg2);
    const tan0 = curve.getTangentAt(0);
    const tan1 = curve.getTangentAt(1);
    // t=0はhandleOut方向、t=1はhandleIn方向
    expect(tan0.x).toBeGreaterThan(0);
    expect(tan1.x).toBeGreaterThan(0);
  });
});