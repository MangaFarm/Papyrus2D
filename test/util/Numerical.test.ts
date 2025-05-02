import { describe, it, expect } from 'vitest';
import { Numerical } from '../../src/util/Numerical';

describe('Numerical', () => {
  it('clamp: should clamp values correctly', () => {
    expect(Numerical.clamp(5, 1, 10)).toBe(5);
    expect(Numerical.clamp(-1, 0, 10)).toBe(0);
    expect(Numerical.clamp(11, 0, 10)).toBe(10);
  });

  it('isZero: should detect near-zero values', () => {
    expect(Numerical.isZero(0)).toBe(true);
    expect(Numerical.isZero(Numerical.EPSILON / 2)).toBe(true);
    expect(Numerical.isZero(-Numerical.EPSILON / 2)).toBe(true);
    expect(Numerical.isZero(Numerical.EPSILON * 10)).toBe(false);
  });

  it('isMachineZero: should detect near-machine-zero values', () => {
    expect(Numerical.isMachineZero(0)).toBe(true);
    expect(Numerical.isMachineZero(Numerical.MACHINE_EPSILON / 2)).toBe(true);
    expect(Numerical.isMachineZero(-Numerical.MACHINE_EPSILON / 2)).toBe(true);
    expect(Numerical.isMachineZero(Numerical.MACHINE_EPSILON * 10)).toBe(false);
  });

  it('getNormalizationFactor: should return 0 for normal values', () => {
    expect(Numerical.getNormalizationFactor(1, 2, 3)).toBe(0);
  });

  it('getNormalizationFactor: should return nonzero for very small/large values', () => {
    expect(Numerical.getNormalizationFactor(1e-10)).not.toBe(0);
    expect(Numerical.getNormalizationFactor(1e10)).not.toBe(0);
  });

  it('solveQuadratic: should solve x^2 - 1 = 0', () => {
    const roots: number[] = [];
    const n = Numerical.solveQuadratic(1, 0, -1, roots);
    expect(n).toBe(2);
    expect(roots).toContain(1);
    expect(roots).toContain(-1);
  });

  it('solveQuadratic: should solve 0x^2 + 2x - 8 = 0 (linear)', () => {
    const roots: number[] = [];
    const n = Numerical.solveQuadratic(0, 2, -8, roots);
    expect(n).toBe(1);
    expect(roots[0]).toBeCloseTo(4);
  });

  it('solveQuadratic: should return -1 for infinite solutions', () => {
    const roots: number[] = [];
    const n = Numerical.solveQuadratic(0, 0, 0, roots);
    expect(n).toBe(-1);
  });

  it('solveCubic: should solve x^3 - 6x^2 + 11x - 6 = 0 (roots: 1,2,3)', () => {
    const roots: number[] = [];
    const n = Numerical.solveCubic(1, -6, 11, -6, roots);
    expect(n).toBe(3);
    // 1,2,3 それぞれに十分近い値がrootsに含まれることを確認
    expect(roots.some(r => Math.abs(r - 1) < 1e-8)).toBe(true);
    expect(roots.some(r => Math.abs(r - 2) < 1e-8)).toBe(true);
    expect(roots.some(r => Math.abs(r - 3) < 1e-8)).toBe(true);
  });

  it('solveCubic: should solve x^3 = 0 (triple root at 0)', () => {
    const roots: number[] = [];
    const n = Numerical.solveCubic(1, 0, 0, 0, roots);
    expect(n).toBe(1);
    expect(roots[0]).toBeCloseTo(0);
  });

  it('integrate: should integrate f(x)=x from 0 to 1 (should be 0.5)', () => {
    const result = Numerical.integrate((x) => x, 0, 1, 5);
    expect(result).toBeCloseTo(0.5, 4);
  });

  it('findRoot: should find root of f(x)=x^2-2 near sqrt(2)', () => {
    const f = (x: number) => x * x - 2;
    const df = (x: number) => 2 * x;
    const root = Numerical.findRoot(f, df, 1.5, 1, 2, 20, 1e-10);
    expect(root).toBeCloseTo(Math.SQRT2, 8);
  });
});