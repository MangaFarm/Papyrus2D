import { describe, it, expect } from 'vitest';
import { Point } from '../src/basic/Point';

describe('Point', () => {
  it('should create a point with default values', () => {
    const p = new Point();
    expect(p.x).toBe(0);
    expect(p.y).toBe(0);
  });

  it('should create a point with given values', () => {
    const p = new Point(3, 4);
    expect(p.x).toBe(3);
    expect(p.y).toBe(4);
  });

  it('should add two points', () => {
    const a = new Point(1, 2);
    const b = new Point(3, 4);
    const c = a.add(b);
    expect(c.x).toBe(4);
    expect(c.y).toBe(6);
  });

  it('should subtract two points', () => {
    const a = new Point(5, 7);
    const b = new Point(2, 3);
    const c = a.subtract(b);
    expect(c.x).toBe(3);
    expect(c.y).toBe(4);
  });

  it('should multiply by scalar', () => {
    const a = new Point(2, 3);
    const b = a.multiply(2);
    expect(b.x).toBe(4);
    expect(b.y).toBe(6);
  });

  it('should multiply by point', () => {
    const a = new Point(2, 3);
    const b = new Point(4, 5);
    const c = a.multiply(b);
    expect(c.x).toBe(8);
    expect(c.y).toBe(15);
  });

  it('should divide by scalar', () => {
    const a = new Point(8, 6);
    const b = a.divide(2);
    expect(b.x).toBe(4);
    expect(b.y).toBe(3);
  });

  it('should divide by point', () => {
    const a = new Point(8, 6);
    const b = new Point(2, 3);
    const c = a.divide(b);
    expect(c.x).toBe(4);
    expect(c.y).toBe(2);
  });

  it('should calculate length', () => {
    const a = new Point(3, 4);
    expect(a.getLength()).toBe(5);
  });

  it('should calculate angle', () => {
    const a = new Point(0, 1);
    expect(a.getAngle()).toBeCloseTo(90);
    const b = new Point(1, 0);
    expect(b.getAngle()).toBeCloseTo(0);
  });

  it('should normalize', () => {
    const a = new Point(3, 4);
    const n = a.normalize();
    expect(n.getLength()).toBeCloseTo(1);
    expect(n.getAngle()).toBeCloseTo(a.getAngle());
  });

  it('should rotate around origin', () => {
    const a = new Point(1, 0);
    const b = a.rotate(90);
    expect(b.x).toBeCloseTo(0);
    expect(b.y).toBeCloseTo(1);
  });

  it('should rotate around a center', () => {
    const a = new Point(2, 1);
    const center = new Point(1, 1);
    const b = a.rotate(180, center);
    expect(b.x).toBeCloseTo(0);
    expect(b.y).toBeCloseTo(1);
  });

  it('should check equality', () => {
    const a = new Point(1, 2);
    const b = new Point(1, 2);
    const c = new Point(2, 1);
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });

  it('should clone', () => {
    const a = new Point(5, 6);
    const b = a.clone();
    expect(b.equals(a)).toBe(true);
    expect(b).not.toBe(a);
  });

  it('should stringify', () => {
    const a = new Point(1, 2);
    expect(a.toString()).toBe('{ x: 1, y: 2 }');
  });
});
