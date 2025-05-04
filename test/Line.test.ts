import { describe, it, expect } from 'vitest';
import { Line } from '../src/basic/Line';
import { Point } from '../src/basic/Point';

describe('Line', () => {
  it('Line(Point, Point) で始点・ベクトル・終点が正しい', () => {
    const line = new Line(new Point(20, 20), new Point(40, 40));
    expect(line.getPoint().x).toBe(20);
    expect(line.getPoint().y).toBe(20);
    expect(line.getVector().x).toBe(20);
    expect(line.getVector().y).toBe(20);
    // 終点 = 始点 + ベクトル
    const end = line.getPoint().add(line.getVector());
    expect(end.x).toBe(40);
    expect(end.y).toBe(40);
    // 長さ
    expect(line.getLength()).toBeCloseTo(Math.sqrt(20 * 20 + 20 * 20));
  });

  it('Line(x1, y1, x2, y2) で始点・ベクトル・終点が正しい', () => {
    const line = new Line(20, 20, 40, 40);
    expect(line.getPoint().x).toBe(20);
    expect(line.getPoint().y).toBe(20);
    expect(line.getVector().x).toBe(20);
    expect(line.getVector().y).toBe(20);
    const end = line.getPoint().add(line.getVector());
    expect(end.x).toBe(40);
    expect(end.y).toBe(40);
    expect(line.getLength()).toBeCloseTo(Math.sqrt(20 * 20 + 20 * 20));
  });

  it('Line(Point, Point, true) でベクトル指定', () => {
    const line = new Line(new Point(10, 10), new Point(5, 0), true);
    expect(line.getPoint().x).toBe(10);
    expect(line.getPoint().y).toBe(10);
    expect(line.getVector().x).toBe(5);
    expect(line.getVector().y).toBe(0);
    // 終点 = 始点 + ベクトル
    const end = line.getPoint().add(line.getVector());
    expect(end.x).toBe(15);
    expect(end.y).toBe(10);
    expect(line.getLength()).toBeCloseTo(5);
  });
it('intersect 交差する2線分で交点が得られる', () => {
    const l1 = new Line(new Point(0, 0), new Point(10, 0));
    const l2 = new Line(new Point(5, -5), new Point(5, 5));
    const pt = l1.intersect(l2);
    expect(pt).not.toBeUndefined();
    expect(pt).not.toBeNull();
    expect(pt!.x).toBe(5);
    expect(pt!.y).toBe(0);
  });

  it('intersect 非交差線分でも isInfinite=true なら交点が得られる', () => {
    const l1 = new Line(new Point(0, 0), new Point(1, 0));
    const l2 = new Line(new Point(2, 1), new Point(2, -1));
    expect(l1.intersect(l2)).toBeUndefined();
    const pt = l1.intersect(l2, true);
    expect(pt).not.toBeUndefined();
    expect(pt!.x).toBe(2);
    expect(pt!.y).toBe(0);
  });

  it('getSide の符号が正しい', () => {
    const base = new Line(new Point(0, 0), new Point(10, 0));
    // y&gt;0 は -1, y&lt;0 は 1, 線上は 0
    expect(base.getSide(new Point(0, 3))).toBe(-1);
    expect(base.getSide(new Point(0, -3))).toBe(1);
    expect(base.getSide(new Point(5, 0))).toBe(0);
  });

  it('getDistance / getSignedDistance が正しい', () => {
    const base = new Line(new Point(0, 0), new Point(10, 0));
    expect(base.getDistance(new Point(0, 3))).toBeCloseTo(3);
    expect(base.getSignedDistance(new Point(0, 3))).toBeCloseTo(-3);
  });

  it('isCollinear と isOrthogonal が正しい', () => {
    const horizontal = new Line(new Point(0, 0), new Point(10, 0));
    const horizontal2 = new Line(new Point(5, 5), new Point(15, 5));
    const vertical = new Line(new Point(0, 0), new Point(0, 10));
    expect(horizontal.isCollinear(horizontal2)).toBe(true);
    expect(horizontal.isCollinear(vertical)).toBe(false);
    expect(horizontal.isOrthogonal(vertical)).toBe(true);
  });

  it('Line はイミュータブルである', () => {
    const line = new Line(new Point(0, 0), new Point(10, 0));
    expect(() => {
      (line as any)._px = 100;
    }).toThrow();
  });
});