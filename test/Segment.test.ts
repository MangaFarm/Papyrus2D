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
it('should translate a segment', () => {
    const seg = new Segment(new Point(1, 2), new Point(3, 4), new Point(5, 6));
    const moved = seg.translate(new Point(10, 20));
    expect(moved.point.equals(new Point(11, 22))).toBe(true);
    expect(moved.handleIn.equals(seg.handleIn)).toBe(true);
    expect(moved.handleOut.equals(seg.handleOut)).toBe(true);
  });

  it('should rotate a segment', () => {
    const seg = new Segment(new Point(1, 0), new Point(0, 1), new Point(1, 1));
    const rotated = seg.rotate(90);
    expect(Math.abs(rotated.point.x - 0) < 1e-10).toBe(true);
    expect(Math.abs(rotated.point.y - 1) < 1e-10).toBe(true);
    // handleIn/handleOutも原点中心で回転
    expect(Math.abs(rotated.handleIn.x - (-1)) < 1e-10).toBe(true);
    expect(Math.abs(rotated.handleIn.y - 0) < 1e-10).toBe(true);
    expect(Math.abs(rotated.handleOut.x - (-1)) < 1e-10).toBe(true);
    expect(Math.abs(rotated.handleOut.y - 1) < 1e-10).toBe(true);
  });

  it('should scale a segment', () => {
    const seg = new Segment(new Point(1, 2), new Point(3, 4), new Point(5, 6));
    const scaled = seg.scale(2);
    expect(scaled.point.equals(new Point(2, 4))).toBe(true);
    expect(scaled.handleIn.equals(new Point(6, 8))).toBe(true);
    expect(scaled.handleOut.equals(new Point(10, 12))).toBe(true);
  });
});