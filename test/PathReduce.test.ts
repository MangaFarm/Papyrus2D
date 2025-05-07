import { describe, it, expect } from 'vitest';
import { Segment } from '../src/path/Segment';
import { Path } from '../src/path/Path';
import { Point } from '../src/basic/Point';

// o3検証済み

describe('Path.reduce', () => {
  it('collinear segments are merged', () => {
    // 3点が一直線上
    const path = new Path([
      new Segment(new Point(0, 0)),
      new Segment(new Point(50, 0)),
      new Segment(new Point(100, 0))
    ]);
    path.reduce({ simplify: true });
    const segs = path.getSegments();
    expect(segs.length).toBe(2);
    expect(segs[0].getPoint().equals(new Point(0, 0))).toBe(true);
    expect(segs[1].getPoint().equals(new Point(100, 0))).toBe(true);
  });

  it('zero-length segments are removed', () => {
    const path = new Path([
      new Segment(new Point(0, 0)),
      new Segment(new Point(0, 0)),
      new Segment(new Point(100, 0))
    ]);
    path.reduce({ simplify: true });
    const segs = path.getSegments();
    expect(segs.length).toBe(2);
    expect(segs[0].getPoint().equals(new Point(0, 0))).toBe(true);
    expect(segs[1].getPoint().equals(new Point(100, 0))).toBe(true);
  });

  it('non-collinear segments are not merged', () => {
    const path = new Path([
      new Segment(new Point(0, 0)),
      new Segment(new Point(50, 50)),
      new Segment(new Point(100, 0))
    ]);
    path.reduce({ simplify: true });
    const segs = path.getSegments();
    expect(segs.length).toBe(3);
    expect(segs[0].getPoint().equals(new Point(0, 0))).toBe(true);
    expect(segs[1].getPoint().equals(new Point(50, 50))).toBe(true);
    expect(segs[2].getPoint().equals(new Point(100, 0))).toBe(true);
  });

  it('closed path: collinear segments are merged and closure is preserved', () => {
    const path = new Path([
      new Segment(new Point(0, 0)),
      new Segment(new Point(50, 0)),
      new Segment(new Point(100, 0))
    ], true);
    path.reduce({ simplify: true });
    const segs = path.getSegments();
    console.log("💉", segs);
    expect(segs.length).toBe(0);
    expect(path.closed).toBe(true);
  });
});