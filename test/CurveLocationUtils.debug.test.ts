import { describe, it, expect } from 'vitest';
import { Point } from '../src/basic/Point';
import { Curve } from '../src/path/Curve';
import { CurveLocationUtils } from '../src/path/CurveLocationUtils';
import { Segment } from '../src/path/Segment';

describe('CurveLocationUtils.getTimeOf (直線)', () => {
  const segA = new Segment(new Point(0, 0));
  const segB = new Segment(new Point(100, 0));
  const curve = new Curve(null, segA, segB);
  const v = curve.getValues();

  it('should return 0 for start point', () => {
    const t = CurveLocationUtils.getTimeOf(v, new Point(0, 0));
    expect(t).toBe(0);
  });

  it('should return 1 for end point', () => {
    const t = CurveLocationUtils.getTimeOf(v, new Point(100, 0));
    expect(t).toBe(1);
  });

  it('should return 0.5 for midpoint', () => {
    const t = CurveLocationUtils.getTimeOf(v, new Point(50, 0));
    expect(t).toBeCloseTo(0.5);
  });

  it('should return null for point far outside (x < 0)', () => {
    const t = CurveLocationUtils.getTimeOf(v, new Point(-10, 0));
    expect(t).toBeNull();
  });

  it('should return null for point far outside (x > 100)', () => {
    const t = CurveLocationUtils.getTimeOf(v, new Point(110, 0));
    expect(t).toBeNull();
  });

  it('should return null for point off the line (0,10)', () => {
    const t = CurveLocationUtils.getTimeOf(v, new Point(0, 10));
    expect(t).toBeNull();
  });
});