import { describe, it, expect } from 'vitest';
import { Point } from '../src/basic/Point';
import { Segment } from '../src/path/Segment';

describe('Segment', () => {
  it('should create a segment with default values', () => {
    const seg = new Segment();
    expect(seg.point.equals(new Point(0, 0))).toBe(true);
    expect(seg.handleIn.equals(new Point(0, 0))).toBe(true);
    expect(seg.handleOut.equals(new Point(0, 0))).toBe(true);
  });

  it('should create a segment with given points', () => {
    const seg = new Segment(new Point(10, 10), new Point(5, 5), new Point(15, 15));
    expect(seg.point.equals(new Point(10, 10))).toBe(true);
    expect(seg.handleIn.equals(new Point(5, 5))).toBe(true);
    expect(seg.handleOut.equals(new Point(15, 15))).toBe(true);
  });

  it('should clone a segment', () => {
    const seg = new Segment(new Point(1, 2), new Point(3, 4), new Point(5, 6));
    const clone = seg.clone();
    expect(clone.equals(seg)).toBe(true);
    expect(clone).not.toBe(seg); // 別インスタンス
  });

  it('should reverse handles', () => {
    const seg = new Segment(new Point(1, 2), new Point(3, 4), new Point(5, 6));
    const rev = seg.reversed();
    expect(rev.point.equals(seg.point)).toBe(true);
    expect(rev.handleIn.equals(seg.handleOut)).toBe(true);
    expect(rev.handleOut.equals(seg.handleIn)).toBe(true);
  });

  it('should stringify correctly', () => {
    const seg1 = new Segment(new Point(10, 10));
    expect(seg1.toString()).toBe('{ point: { x: 10, y: 10 } }');
    const seg2 = new Segment(new Point(10, 10), new Point(5, 5), new Point(15, 15));
    expect(seg2.toString()).toBe('{ point: { x: 10, y: 10 }, handleIn: { x: 5, y: 5 }, handleOut: { x: 15, y: 15 } }');
  });

  it('should check equality', () => {
    const seg1 = new Segment(new Point(1, 2), new Point(3, 4), new Point(5, 6));
    const seg2 = new Segment(new Point(1, 2), new Point(3, 4), new Point(5, 6));
    const seg3 = new Segment(new Point(1, 2), new Point(0, 0), new Point(0, 0));
    expect(seg1.equals(seg2)).toBe(true);
    expect(seg1.equals(seg3)).toBe(false);
  });
});