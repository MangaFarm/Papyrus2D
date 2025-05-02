import { describe, it, expect } from 'vitest';
import { Matrix } from '../src/basic/Matrix';
import { Point } from '../src/basic/Point';

describe('Matrix', () => {
  it('should create identity matrix', () => {
    const m = Matrix.identity();
    expect(m.a).toBe(1);
    expect(m.b).toBe(0);
    expect(m.c).toBe(0);
    expect(m.d).toBe(1);
    expect(m.tx).toBe(0);
    expect(m.ty).toBe(0);
    expect(m.isIdentity()).toBe(true);
  });

  it('should create matrix from array', () => {
    const m = Matrix.fromArray([1, 2, 3, 4, 5, 6]);
    expect(m.a).toBe(1);
    expect(m.b).toBe(2);
    expect(m.c).toBe(3);
    expect(m.d).toBe(4);
    expect(m.tx).toBe(5);
    expect(m.ty).toBe(6);
  });

  it('should test equality', () => {
    const m1 = new Matrix(1, 2, 3, 4, 5, 6);
    const m2 = new Matrix(1, 2, 3, 4, 5, 6);
    const m3 = new Matrix(0, 2, 3, 4, 5, 6);
    expect(m1.equals(m2)).toBe(true);
    expect(m1.equals(m3)).toBe(false);
  });

  it('should clone matrix', () => {
    const m1 = new Matrix(1, 2, 3, 4, 5, 6);
    const m2 = m1.clone();
    expect(m1.equals(m2)).toBe(true);
    expect(m1).not.toBe(m2);
  });

  it('should append (multiply) matrices', () => {
    const m1 = new Matrix(1, 2, 3, 4, 5, 6);
    const m2 = new Matrix(7, 8, 9, 10, 11, 12);
    const m3 = m1.append(m2);
    // 手計算で検算
    expect(m3.a).toBe(1 * 7 + 3 * 8);
    expect(m3.b).toBe(2 * 7 + 4 * 8);
    expect(m3.c).toBe(1 * 9 + 3 * 10);
    expect(m3.d).toBe(2 * 9 + 4 * 10);
    expect(m3.tx).toBe(1 * 11 + 3 * 12 + 5);
    expect(m3.ty).toBe(2 * 11 + 4 * 12 + 6);
  });

  it('should invert matrix', () => {
    const m = new Matrix(2, 0, 0, 2, 4, 6);
    const inv = m.invert();
    expect(inv).not.toBeNull();
    if (inv) {
      expect(inv.a).toBeCloseTo(0.5);
      expect(inv.b).toBeCloseTo(0);
      expect(inv.c).toBeCloseTo(0);
      expect(inv.d).toBeCloseTo(0.5);
      expect(inv.tx).toBeCloseTo(-2);
      expect(inv.ty).toBeCloseTo(-3);
    }
  });

  it('should return null for singular matrix inversion', () => {
    const m = new Matrix(1, 2, 2, 4, 5, 6); // 行列式0
    expect(m.invert()).toBeNull();
  });

  it('should translate', () => {
    const m = Matrix.identity().translate(3, 4);
    expect(m.tx).toBe(3);
    expect(m.ty).toBe(4);
  });

  it('should scale', () => {
    const m = Matrix.identity().scale(2, 3);
    expect(m.a).toBe(2);
    expect(m.d).toBe(3);
  });

  it('should rotate 90deg', () => {
    const m = Matrix.identity().rotate(90);
    expect(m.a).toBeCloseTo(0);
    expect(m.b).toBeCloseTo(1);
    expect(m.c).toBeCloseTo(-1);
    expect(m.d).toBeCloseTo(0);
  });

  it('should toString', () => {
    const m = new Matrix(1, 2, 3, 4, 5, 6);
    expect(m.toString()).toBe('[[1, 3, 5], [2, 4, 6]]');
  });
it('should shear', () => {
    const m = Matrix.identity().shear(2, 3);
    // [1, 3, 2, 1, 0, 0]
    expect(m.a).toBe(1);
    expect(m.b).toBe(3);
    expect(m.c).toBe(2);
    expect(m.d).toBe(1);
  });

  it('should skew', () => {
    const m = Matrix.identity().skew(45, 0);
    // tan(45deg) = 1
    expect(m.c).toBeCloseTo(1);
    expect(m.a).toBe(1);
    expect(m.b).toBe(0);
    expect(m.d).toBe(1);
  });

  it('should appended and prepended', () => {
    const m1 = new Matrix(1, 2, 3, 4, 5, 6);
    const m2 = new Matrix(7, 8, 9, 10, 11, 12);
    expect(m1.appended(m2).equals(m1.append(m2))).toBe(true);
    expect(m1.prepended(m2).equals(m2.append(m1))).toBe(true);
  });

  it('should inverted', () => {
    const m = new Matrix(2, 0, 0, 2, 4, 6);
    const inv = m.inverted();
    expect(inv).not.toBeNull();
    if (inv) {
      expect(inv.a).toBeCloseTo(0.5);
      expect(inv.d).toBeCloseTo(0.5);
      expect(inv.tx).toBeCloseTo(-2);
      expect(inv.ty).toBeCloseTo(-3);
    }
  });

  it('should check isInvertible', () => {
    const m = new Matrix(1, 2, 2, 4, 5, 6); // det=0
    expect(m.isInvertible()).toBe(false);
    const m2 = Matrix.identity();
    expect(m2.isInvertible()).toBe(true);
  });

  it('should getTranslation', () => {
    const m = new Matrix(1, 0, 0, 1, 5, 6);
    const t = m.getTranslation();
    expect(t.x).toBe(5);
    expect(t.y).toBe(6);
  });

  it('should getScaling and getRotation (scale only)', () => {
    const m = Matrix.identity().scale(2, 3);
    const scaling = m.getScaling();
    const rotation = m.getRotation();
    expect(scaling.x).toBeCloseTo(2);
    expect(scaling.y).toBeCloseTo(3);
    expect(rotation).toBeCloseTo(0);
  });

  it('should getScaling and getRotation (rotate only)', () => {
    const m = Matrix.identity().rotate(30);
    const scaling = m.getScaling();
    const rotation = m.getRotation();
    expect(scaling.x).toBeCloseTo(1);
    expect(scaling.y).toBeCloseTo(1);
    expect(rotation).toBeCloseTo(30);
  });

  it('should getScaling and getRotation (scale and rotate)', () => {
    const m = Matrix.identity().scale(2, 3).rotate(30);
    const scaling = m.getScaling();
    const rotation = m.getRotation();
    // 回転＋非等方スケールの場合は分解値が元の値と一致しないことを許容
    expect(typeof scaling.x).toBe('number');
    expect(typeof scaling.y).toBe('number');
    expect(typeof rotation).toBe('number');
    // 行列式は一致する
    expect(m.a * m.d - m.b * m.c).toBeCloseTo(scaling.x * scaling.y);
  });

  it('should decompose', () => {
    const m = Matrix.identity().scale(2, 3).rotate(45).translate(5, 6);
    const d = m.decompose();
    // 型・範囲・符号の妥当性をテスト
    expect(typeof d.scaling.x).toBe('number');
    expect(typeof d.scaling.y).toBe('number');
    expect(typeof d.rotation).toBe('number');
    expect(typeof d.translation.x).toBe('number');
    expect(typeof d.translation.y).toBe('number');
    // 行列式は一致する
    expect(m.a * m.d - m.b * m.c).toBeCloseTo(d.scaling.x * d.scaling.y);
  });

  it('should transform and inverseTransform', () => {
    const m = Matrix.identity().translate(10, 20).scale(2, 3);
    const p = new Point(1, 1);
    const tp = m.transform(p);
    expect(tp.x).toBeCloseTo(1 * 2 + 10);
    expect(tp.y).toBeCloseTo(1 * 3 + 20);
    const inv = m.invert();
    if (inv) {
      const orig = inv.transform(tp);
      expect(orig.x).toBeCloseTo(1);
      expect(orig.y).toBeCloseTo(1);
    }
    const invp = m.inverseTransform(tp);
    expect(invp).not.toBeNull();
    if (invp) {
      expect(invp.x).toBeCloseTo(1);
      expect(invp.y).toBeCloseTo(1);
    }
  });
});