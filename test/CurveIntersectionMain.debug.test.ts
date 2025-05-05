import { describe, it, expect } from 'vitest';
import { Curve } from '../src/path/Curve';
import { Segment } from '../src/path/Segment';
import { Point } from '../src/basic/Point';
import { getCurveIntersections } from '../src/path/CurveIntersectionMain';

describe('CurveIntersectionMain - debug straight line intersection', () => {
  it('should find intersection for two crossing lines', () => {
    // 1本目: (0,0)-(100,0)
    const segA1 = new Segment(new Point(0, 0));
    const segA2 = new Segment(new Point(100, 0));
    const curveA = new Curve(null, segA1, segA2);

    // 2本目: (50,-50)-(50,50)
    const segB1 = new Segment(new Point(50, -50));
    const segB2 = new Segment(new Point(50, 50));
    const curveB = new Curve(null, segB1, segB2);

    const intersections = getCurveIntersections(
      curveA.getValues(),
      curveB.getValues(),
      curveA,
      curveB,
      [],
      undefined
    );
    expect(intersections.length).toBe(1);
    const pt = intersections[0].getPoint();
    expect(pt.x).toBeCloseTo(50);
    expect(pt.y).toBeCloseTo(0);
  });

  it('should return 0 for parallel lines', () => {
    // 1本目: (0,0)-(100,0)
    const segA1 = new Segment(new Point(0, 0));
    const segA2 = new Segment(new Point(100, 0));
    const curveA = new Curve(null, segA1, segA2);

    // 2本目: (0,10)-(100,10)
    const segB1 = new Segment(new Point(0, 10));
    const segB2 = new Segment(new Point(100, 10));
    const curveB = new Curve(null, segB1, segB2);

    const intersections = getCurveIntersections(
      curveA.getValues(),
      curveB.getValues(),
      curveA,
      curveB,
      [],
      undefined
    );
    expect(intersections.length).toBe(0);
  });

  it('should find endpoint intersection', () => {
    // 1本目: (0,0)-(100,0)
    const segA1 = new Segment(new Point(0, 0));
    const segA2 = new Segment(new Point(100, 0));
    const curveA = new Curve(null, segA1, segA2);

    // 2本目: (100,0)-(100,100)
    const segB1 = new Segment(new Point(100, 0));
    const segB2 = new Segment(new Point(100, 100));
    const curveB = new Curve(null, segB1, segB2);

    const intersections = getCurveIntersections(
      curveA.getValues(),
      curveB.getValues(),
      curveA,
      curveB,
      [],
      undefined
    );
    expect(intersections.length).toBe(1);
    const pt = intersections[0].getPoint();
    expect(pt.x).toBeCloseTo(100);
    expect(pt.y).toBeCloseTo(0);
  });
});