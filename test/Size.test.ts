import { describe, it, expect } from 'vitest';
import { Size } from '../src/basic/Size';

describe('Size', () => {
  it('should create a size with default values', () => {
    const s = new Size();
    expect(s.width).toBe(0);
    expect(s.height).toBe(0);
  });

  it('should create a size with given values', () => {
    const s = new Size(3, 4);
    expect(s.width).toBe(3);
    expect(s.height).toBe(4);
  });

  it('should add two sizes', () => {
    const a = new Size(1, 2);
    const b = new Size(3, 4);
    const c = a.add(b);
    expect(c.width).toBe(4);
    expect(c.height).toBe(6);
  });

  it('should subtract two sizes', () => {
    const a = new Size(5, 7);
    const b = new Size(2, 3);
    const c = a.subtract(b);
    expect(c.width).toBe(3);
    expect(c.height).toBe(4);
  });

  it('should multiply by scalar', () => {
    const a = new Size(2, 3);
    const b = a.multiply(2);
    expect(b.width).toBe(4);
    expect(b.height).toBe(6);
  });

  it('should multiply by size', () => {
    const a = new Size(2, 3);
    const b = new Size(4, 5);
    const c = a.multiply(b);
    expect(c.width).toBe(8);
    expect(c.height).toBe(15);
  });

  it('should divide by scalar', () => {
    const a = new Size(8, 6);
    const b = a.divide(2);
    expect(b.width).toBe(4);
    expect(b.height).toBe(3);
  });

  it('should divide by size', () => {
    const a = new Size(8, 6);
    const b = new Size(2, 3);
    const c = a.divide(b);
    expect(c.width).toBe(4);
    expect(c.height).toBe(2);
  });

  it('should check equality', () => {
    const a = new Size(1, 2);
    const b = new Size(1, 2);
    const c = new Size(2, 1);
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });

  it('should clone', () => {
    const a = new Size(5, 6);
    const b = a.clone();
    expect(b.equals(a)).toBe(true);
    expect(b).not.toBe(a);
  });

  it('should check isZero', () => {
    const a = new Size(0, 0);
    const b = new Size(1, 0);
    expect(a.isZero()).toBe(true);
    expect(b.isZero()).toBe(false);
  });

  it('should stringify', () => {
    const a = new Size(1, 2);
    expect(a.toString()).toBe('{ width: 1, height: 2 }');
  });
});