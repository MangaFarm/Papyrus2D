import { describe, it, expect } from 'vitest';
import { Rectangle } from '../src/basic/Rectangle';
import { Point } from '../src/basic/Point';
import { Size } from '../src/basic/Size';

describe('Rectangle', () => {
  it('should create a rectangle with x, y, width, height', () => {
    const r = new Rectangle(1, 2, 3, 4);
    expect(r.x).toBe(1);
    expect(r.y).toBe(2);
    expect(r.width).toBe(3);
    expect(r.height).toBe(4);
  });

  it('should create a rectangle from topLeft and size', () => {
    const r = new Rectangle(new Point(5, 6), new Size(7, 8));
    expect(r.x).toBe(5);
    expect(r.y).toBe(6);
    expect(r.width).toBe(7);
    expect(r.height).toBe(8);
  });

  it('should create a rectangle from two points', () => {
    const r = new Rectangle(new Point(1, 2), new Point(4, 6));
    expect(r.x).toBe(1);
    expect(r.y).toBe(2);
    expect(r.width).toBe(3);
    expect(r.height).toBe(4);
  });

  it('should create a rectangle from another rectangle', () => {
    const orig = new Rectangle(1, 2, 3, 4);
    const r = new Rectangle(orig);
    expect(r.equals(orig)).toBe(true);
    expect(r).not.toBe(orig);
  });

  it('should return correct topLeft, bottomRight, center, size', () => {
    const r = new Rectangle(1, 2, 3, 4);
    expect(r.topLeft.equals(new Point(1, 2))).toBe(true);
    expect(r.bottomRight.equals(new Point(4, 6))).toBe(true);
    expect(r.center.equals(new Point(2.5, 4))).toBe(true);
    expect(r.size.equals(new Size(3, 4))).toBe(true);
  });

  it('should clone', () => {
    const r = new Rectangle(1, 2, 3, 4);
    const c = r.clone();
    expect(c.equals(r)).toBe(true);
    expect(c).not.toBe(r);
  });

  it('should check equality', () => {
    const a = new Rectangle(1, 2, 3, 4);
    const b = new Rectangle(1, 2, 3, 4);
    const c = new Rectangle(0, 0, 3, 4);
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });

  it('should stringify', () => {
    const r = new Rectangle(1, 2, 3, 4);
    expect(r.toString()).toBe('{ x: 1, y: 2, width: 3, height: 4 }');
  });

  it('should check if contains a point', () => {
    const r = new Rectangle(1, 2, 3, 4);
    expect(r.contains(new Point(2, 3))).toBe(true);
    expect(r.contains(new Point(0, 0))).toBe(false);
    expect(r.contains(new Point(4, 6))).toBe(true); // 端点含む
  });

  it('should check intersection with another rectangle', () => {
    const a = new Rectangle(0, 0, 4, 4);
    const b = new Rectangle(2, 2, 4, 4);
    const c = new Rectangle(5, 5, 2, 2);
    expect(a.intersects(b)).toBe(true);
    expect(a.intersects(c)).toBe(false);
  });

  it('should unite with another rectangle', () => {
    const a = new Rectangle(0, 0, 2, 2);
    const b = new Rectangle(1, 1, 2, 2);
    const u = a.unite(b);
    expect(u.x).toBe(0);
    expect(u.y).toBe(0);
    expect(u.width).toBe(3);
    expect(u.height).toBe(3);
  });

  it('should be immutable', () => {
    const r = new Rectangle(1, 2, 3, 4);
    // @ts-expect-error
    expect(() => { r.x = 10; }).toThrow();
    // @ts-expect-error
    expect(() => { r.width = 10; }).toThrow();
  });
});