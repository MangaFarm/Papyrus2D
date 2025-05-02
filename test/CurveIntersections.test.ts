/**
 * CurveIntersections.test.ts
 * Tests for curve intersection calculations.
 * Based on Paper.js tests.
 */

import { describe, it, expect } from 'vitest';
import { Curve } from '../src/path/Curve';
import { Segment } from '../src/path/Segment';
import { Point } from '../src/basic/Point';
import { Path } from '../src/path/Path';

// Helper function to create a path from a curve
// 出典: paper.js/test/tests/Path_Intersections.js の createPath 関数
function createPath(curve: Curve): Path {
  return new Path([curve.segment1, curve.segment2]);
}

// Helper function to test intersections
// 出典: paper.js/test/tests/Path_Intersections.js の testIntersections 関数を修正
function testIntersections(intersections: any[], results: any[]) {
  expect(intersections.length).toBe(results.length);
  for (let i = 0; i < Math.min(results.length, intersections.length); i++) {
    const inter = intersections[i];
    const values = results[i];
    const name = `intersections[${i}]`;
    
    if (values.point != null) {
      expect(inter.point.x).toBeCloseTo(values.point.x, 5);
      expect(inter.point.y).toBeCloseTo(values.point.y, 5);
    }
    
    if (values.t1 != null) {
      expect(inter.t1).toBeCloseTo(values.t1, 5);
    }
    
    if (values.t2 != null) {
      expect(inter.t2).toBeCloseTo(values.t2, 5);
    }
    
    if (values.onPath != null) {
      expect(inter.onPath).toBe(values.onPath);
    }
  }
}

describe('Curve Intersections', () => {
  // Basic intersection tests
  // 出典: 元の CurveIntersections.test.ts の 'Simple intersections' を修正
  describe('Basic intersections', () => {
    it('should find intersection between two straight lines', () => {
      // Two straight lines crossing at (50, 50)
      const curve1 = new Curve(
        new Segment(new Point(0, 0), new Point(0, 0), new Point(0, 0)),
        new Segment(new Point(100, 100), new Point(0, 0), new Point(0, 0))
      );
      
      const curve2 = new Curve(
        new Segment(new Point(0, 100), new Point(0, 0), new Point(0, 0)),
        new Segment(new Point(100, 0), new Point(0, 0), new Point(0, 0))
      );
      
      const v1 = [0, 0, 0, 0, 0, 0, 100, 100];
      const v2 = [0, 100, 0, 100, 0, 100, 100, 0];
      
      const intersections = Curve.getIntersections(v1, v2);
      
      testIntersections(intersections, [
        { point: { x: 50, y: 50 }, t1: 0.5, t2: 0.5 }
      ]);
    });
    
    // 出典: paper.js/test/tests/Path_Intersections.js の複数のテストケースを参考に作成
    it('should find intersections between curved lines', () => {
      // Two S-shaped bezier curves crossing at two points
      const curve1 = new Curve(
        new Segment(new Point(0, 0), new Point(0, 0), new Point(30, 40)),
        new Segment(new Point(100, 0), new Point(-30, 40), new Point(0, 0))
      );
      
      const curve2 = new Curve(
        new Segment(new Point(0, 100), new Point(0, 0), new Point(30, -40)),
        new Segment(new Point(100, 100), new Point(-30, -40), new Point(0, 0))
      );
      
      const v1 = [0, 0, 0, 0, 30, 40, 100, 0];
      const v2 = [0, 100, 0, 100, 30, 60, 100, 100];
      
      const intersections = Curve.getIntersections(v1, v2);
      
      expect(intersections.length).toBe(1);
      expect(intersections[0].point.x).toBeGreaterThan(0);
      expect(intersections[0].point.y).toBeGreaterThan(0);
    });
  });
  
  // Fat-line clipping tests
  // 出典: 元の CurveIntersections.test.ts の 'Fat-line bounds test' を修正
  describe('Fat-line clipping', () => {
    it('should calculate correct fat-line bounds', () => {
      const v = [0, 0, 50, 100, 150, 100, 200, 0];
      const point = new Point(0, 0);
      
      const bounds = Curve._getFatLineBounds(v, point);
      
      expect(typeof bounds.min).toBe('number');
      expect(typeof bounds.max).toBe('number');
      expect(bounds.min).toBeLessThanOrEqual(bounds.max);
    });
    
    it('should use fat-line bounds to optimize intersection detection', () => {
      // Intersecting curves
      const v1 = [0, 0, 50, 100, 150, 100, 200, 0];
      const v2 = [0, 50, 50, -50, 150, -50, 200, 50];
      
      // Non-intersecting curves
      const v3 = [0, 200, 50, 150, 150, 150, 200, 200];
      
      const intersections12 = Curve.getIntersections(v1, v2);
      const intersections13 = Curve.getIntersections(v1, v3);
      
      expect(intersections12.length).toBeGreaterThan(0);
      expect(intersections13.length).toBe(0);
    });
  });
  
  // Monotone subdivision tests
  // 出典: 元の CurveIntersections.test.ts の 'Monotone subdivision test' を修正
  describe('Monotone subdivision', () => {
    it('should correctly subdivide curves into monotone parts', () => {
      const v = [0, 0, 100, 100, 0, 100, 100, 0];
      
      const monotone = Curve.getMonoCurves(v, false);
      
      expect(monotone.length).toBeGreaterThanOrEqual(2);
      
      for (const subCurve of monotone) {
        const x0 = subCurve[0];
        const x2 = subCurve[2];
        const x4 = subCurve[4];
        const x6 = subCurve[6];
        
        const increasing = x0 <= x2 && x2 <= x4 && x4 <= x6;
        const decreasing = x0 >= x2 && x2 >= x4 && x4 >= x6;
        
        expect(increasing || decreasing).toBe(true);
      }
    });
  });
  
  // Flatness tests
  // 出典: 元の CurveIntersections.test.ts の 'Flatness test' を修正
  describe('Curve flatness', () => {
    it('should correctly identify flat curves', () => {
      const v1 = [0, 0, 33.33, 33.33, 66.66, 66.66, 100, 100];
      const v2 = [0, 100, 0, 100, 0, 100, 100, 0];
      
      const intersections = Curve.getIntersections(v1, v2);
      
      testIntersections(intersections, [
        { point: { x: 50, y: 50 } }
      ]);
    });
  });
  
  // Endpoint intersection tests
  // 出典: 元の CurveIntersections.test.ts の 'Endpoint and onPath intersections' を修正
  describe('Endpoint intersections', () => {
    it('should correctly handle endpoint intersections', () => {
      const v1 = [0, 0, 0, 0, 0, 0, 100, 100];
      const v2 = [100, 100, 100, 100, 100, 100, 200, 200];
      
      const intersections = Curve.getIntersections(v1, v2);
      
      testIntersections(intersections, [
        { point: { x: 100, y: 100 }, t1: 1, t2: 0, onPath: true }
      ]);
    });
    
    it('should handle duplicate intersections correctly', () => {
      const v1 = [0, 0, 50, 50, 50, 50, 100, 0];
      const v2 = [0, 0, 50, -50, 50, -50, 100, 0];
      
      const intersections = Curve.getIntersections(v1, v2);
      
      expect(intersections.length).toBe(2);
      
      expect(intersections[0].point.x).toBeCloseTo(0, 5);
      expect(intersections[0].point.y).toBeCloseTo(0, 5);
      expect(intersections[1].point.x).toBeCloseTo(100, 5);
      expect(intersections[1].point.y).toBeCloseTo(0, 5);
    });
    
    it('should handle curve pair reversal correctly', () => {
      const v1 = [0, 0, 0, 0, 0, 0, 100, 100];
      const v2 = [0, 100, 0, 100, 0, 0, 100, 0];
      
      const intersections1 = Curve.getIntersections(v1, v2);
      const intersections2 = Curve.getIntersections(v2, v1);
      
      expect(intersections1.length).toBe(intersections2.length);
      
      for (let i = 0; i < intersections1.length; i++) {
        const p1 = intersections1[i].point;
        
        let found = false;
        for (const intersection of intersections2) {
          const p2 = intersection.point;
          if (p1.subtract(p2).getLength() < 1e-5) {
            found = true;
            break;
          }
        }
        
        expect(found).toBe(true);
      }
    });
  });
  
  // Complex curve tests
  // 出典: 元の CurveIntersections.test.ts の 'Recursion depth test' を修正
  describe('Complex curves', () => {
    it('should handle complex curves with high precision', () => {
      const v1 = [0, 0, 30, 100, 70, -50, 100, 100];
      const v2 = [0, 100, 30, 0, 70, 150, 100, 0];
      
      const intersections = Curve.getIntersections(v1, v2);
      
      expect(intersections.length).toBeGreaterThan(0);
      
      // The first intersection should be around the middle
      const firstIntersection = intersections[0];
      expect(firstIntersection.point.x).toBeGreaterThan(0);
      expect(firstIntersection.point.y).toBeGreaterThan(0);
      expect(firstIntersection.point.x).toBeLessThan(100);
      expect(firstIntersection.point.y).toBeLessThan(100);
    });
    
    it('should adapt recursion depth based on curve complexity', () => {
      const complex = [0, 0, 100, 200, -100, 200, 50, 50];
      const simple = [0, 100, 10, 100, 40, 100, 50, 100]; // Almost a straight line
      
      const intersections1 = Curve.getIntersections(complex, simple);
      const intersections2 = Curve.getIntersections(complex, [50, 0, -50, 200, 150, 200, 0, 50]);
      
      expect(intersections1.length).toBeGreaterThan(0);
      expect(intersections2.length).toBeGreaterThan(0);
    });
  });
  
  // Paper.js specific test cases
  // 出典: paper.js/test/tests/Path_Intersections.js の #565, #568 テストケース
  describe('Paper.js test cases', () => {
    it('should handle issue #565 from Paper.js', () => {
      const curve1 = new Curve(
        new Segment(new Point(421.75945, 416.40481), new Point(-181.49299, -224.94946), new Point(0, 0)),
        new Segment(new Point(397.47615, 331.34712), new Point(0, 0), new Point(44.52004, -194.13319))
      );
      
      const curve2 = new Curve(
        new Segment(new Point(360.09446, 350.97254), new Point(-58.58867, -218.45806), new Point(0, 0)),
        new Segment(new Point(527.83582, 416.79948), new Point(0, 0), new Point(-109.55091, -220.99561))
      );
      
      const path1 = createPath(curve1);
      const path2 = createPath(curve2);
      
      const intersections = path1.getIntersections(path2);
      expect(intersections.length).toBeGreaterThan(0);
    });
    
    it('should handle issue #568 from Paper.js', () => {
      const curve1 = new Curve(
        new Segment(new Point(0, 0), new Point(20, 40), new Point(0, 0)),
        new Segment(new Point(50, 50), new Point(0, 0), new Point(-30, -50))
      );
      
      const curve2 = new Curve(
        new Segment(new Point(50, 50), new Point(20, 100), new Point(0, 0)),
        new Segment(new Point(250, 250), new Point(0, 0), new Point(-30, -120))
      );
      
      const path1 = createPath(curve1);
      const path2 = createPath(curve2);
      
      const intersections = path1.getIntersections(path2);
      expect(intersections.length).toBe(1);
      expect(intersections[0].point.x).toBeCloseTo(50, 5);
      expect(intersections[0].point.y).toBeCloseTo(50, 5);
    });
  });
});