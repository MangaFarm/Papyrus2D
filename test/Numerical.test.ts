import { describe, it, expect } from 'vitest';
import { Numerical } from '../src/util/Numerical';

describe('Numerical', () => {
  describe('solveQuadratic()', () => {
    function solve(s: number) {
      const roots: number[] = [];
      Numerical.solveQuadratic(s, 0, -s, roots);
      return roots;
    }

    it('should solve quadratic equations correctly', () => {
      const expected = [1, -1];

      // 通常のケース
      expect(solve(1)).toEqual(expected);
      
      // 非常に小さい係数でも同じ結果になるか
      expect(solve(Numerical.EPSILON)).toEqual(expected);
    });
  });

  describe('solveCubic()', () => {
    function solve(s: number) {
      const roots: number[] = [];
      Numerical.solveCubic(0.5 * s, -s, -s, -s, roots);
      return roots;
    }

    it('should solve cubic equations correctly', () => {
      const expected = [2.919639565839418];

      // 通常のケース
      expect(solve(1)).toEqual(expected);
      
      // 非常に小さい係数でも同じ結果になるか
      expect(solve(Numerical.EPSILON)).toEqual(expected);
    });
  });
});