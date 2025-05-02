/**
 * PathIntersections.test.ts
 * Path交点計算の精度テスト（paper.jsのテストを移植）
 */

import { describe, it, expect } from 'vitest';
import { Curve } from '../src/path/Curve';
import { Segment } from '../src/path/Segment';
import { Point } from '../src/basic/Point';
import { Path } from '../src/path/Path';
import { Matrix } from '../src/basic/Matrix';

// paper.jsのテストヘルパー関数を移植
function createPath(curve: Curve): Path {
  return new Path([curve.segment1, curve.segment2]);
}

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
    
    if (values.index != null) {
      expect(inter.index).toBe(values.index);
    }
    
    if (values.time != null) {
      expect(inter.time).toBeCloseTo(values.time, 5);
    }
    
    if (values.crossing != null) {
      // paper.jsのisCrossing()メソッドに相当する機能がない場合はスキップ
      if (typeof inter.isCrossing === 'function') {
        expect(inter.isCrossing()).toBe(values.crossing);
      }
    }
  }
}

describe('Path Intersections', () => {
  // 基本的な交点テスト（既存のテストから移植）
  describe('Basic intersections', () => {
    it('should find intersection of two crossing lines', () => {
      // (0,0)-(10,0) と (5,-5)-(5,5) は (5,0) で交差
      const segA1 = new Segment(new Point(0, 0));
      const segA2 = new Segment(new Point(10, 0));
      const pathA = new Path([segA1, segA2]);
  
      const segB1 = new Segment(new Point(5, -5));
      const segB2 = new Segment(new Point(5, 5));
      const pathB = new Path([segB1, segB2]);
  
      const intersections = pathA.getIntersections(pathB);
      expect(intersections.length).toBe(1);
      expect(intersections[0].point.x).toBeCloseTo(5, 6);
      expect(intersections[0].point.y).toBeCloseTo(0, 6);
    });
  
    it('should find two intersections of two crossing beziers', () => {
      // 2つのS字ベジェ曲線が2点で交差
      const segA1 = new Segment(new Point(0, 0), new Point(0, 0), new Point(30, 40));
      const segA2 = new Segment(new Point(100, 0), new Point(-30, 40), new Point(0, 0));
      const pathA = new Path([segA1, segA2]);
  
      const segB1 = new Segment(new Point(0, 100), new Point(0, 0), new Point(30, -40));
      const segB2 = new Segment(new Point(100, 100), new Point(-30, -40), new Point(0, 0));
      const pathB = new Path([segB1, segB2]);
  
      const intersections = pathA.getIntersections(pathB);
      expect(intersections.length).toBe(2);
      // 交点座標の大まかな検証（順不同）
      const xs = intersections.map(i => Math.round(i.point.x));
      const ys = intersections.map(i => Math.round(i.point.y));
      expect(xs).toContain(25);
      expect(xs).toContain(75);
      expect(ys).toContain(50);
      expect(ys).toContain(50);
    });
  });
  
  // 行列変換を使用したテスト
  describe('Matrix transformations', () => {
    it('should find intersections with matrix transformations', () => {
      // 2つの交差する直線パスを作成
      const segA1 = new Segment(new Point(0, 0));
      const segA2 = new Segment(new Point(10, 0));
      const pathA = new Path([segA1, segA2]);
  
      const segB1 = new Segment(new Point(5, -5));
      const segB2 = new Segment(new Point(5, 5));
      const pathB = new Path([segB1, segB2]);
      
      // 行列変換なしの交点
      const intersectionsNoMatrix = pathA.getIntersections(pathB);
      expect(intersectionsNoMatrix.length).toBe(1);
      
      // pathAを平行移動
      const matrix1 = Matrix.identity().translate(5, 0);
      
      // 行列変換ありの交点
      const intersectionsWithMatrix = pathA.getIntersections(pathB, {
        matrix1: matrix1
      });
      
      // 平行移動により交点がなくなる
      expect(intersectionsWithMatrix.length).toBe(0);
    });
  });
  
  // includeコールバックを使用したテスト
  describe('Include callback', () => {
    it('should filter intersections using include callback', () => {
      // 2つの交差する直線パスを作成
      const segA1 = new Segment(new Point(0, 0));
      const segA2 = new Segment(new Point(10, 0));
      const pathA = new Path([segA1, segA2]);
  
      const segB1 = new Segment(new Point(5, -5));
      const segB2 = new Segment(new Point(5, 5));
      const pathB = new Path([segB1, segB2]);
      
      // すべての交点
      const allIntersections = pathA.getIntersections(pathB);
      expect(allIntersections.length).toBe(1);
      
      // x座標が3より小さい交点のみをフィルタリング（交点はx=5なので結果は0になる）
      const filteredIntersections = pathA.getIntersections(pathB, {
        include: (loc) => loc.point.x < 3
      });
      
      // フィルタリングされた交点の数を確認
      expect(filteredIntersections.length).toBe(0);
    });
  });
  
  // 自己交差テスト
  describe('Self-intersections', () => {
    it('should handle self-intersections', () => {
      // 自己交差するパス（8の字）
      const path = new Path([
        new Segment(new Point(0, 0)),
        new Segment(new Point(100, 100)),
        new Segment(new Point(0, 100)),
        new Segment(new Point(100, 0))
      ], true);
      
      // 自己交差点の座標（理論上は (50, 50)）
      const expectedIntersection = new Point(50, 50);
      
      // 自己交差を検出
      const intersections = path.getIntersections(path);
      
      // 少なくとも1つの交点があることを確認
      expect(intersections.length).toBeGreaterThan(0);
      
      // 交点の中に期待する座標に近いものがあるかを確認
      let found = false;
      for (const intersection of intersections) {
        if (intersection.point.subtract(expectedIntersection).getLength() < 1e-8) {
          found = true;
          break;
        }
      }
      
      expect(found).toBe(true);
    });
  });
  
  // paper.jsのテストケースを移植
  describe('Paper.js test cases', () => {
    it('should handle complex curve intersections', () => {
      const curve1 = new Curve(
        new Segment(new Point(0, 0), new Point(0, 0), new Point(30, 40)),
        new Segment(new Point(100, 0), new Point(-30, 40), new Point(0, 0))
      );
      
      const curve2 = new Curve(
        new Segment(new Point(0, 100), new Point(0, 0), new Point(30, -40)),
        new Segment(new Point(100, 100), new Point(-30, -40), new Point(0, 0))
      );
      
      const path1 = createPath(curve1);
      const path2 = createPath(curve2);
      
      const intersections = path1.getIntersections(path2);
      expect(intersections.length).toBe(2);
      
      // 交点の座標が期待値に近いことを確認
      const xs = intersections.map(i => Math.round(i.point.x));
      const ys = intersections.map(i => Math.round(i.point.y));
      
      expect(xs).toContain(25);
      expect(xs).toContain(75);
      expect(ys).toContain(50);
      expect(ys).toContain(50);
    });
    
    it('should handle endpoint intersections', () => {
      // 端点で交差する曲線
      const curve1 = new Curve(
        new Segment(new Point(0, 0)),
        new Segment(new Point(100, 100))
      );
      
      const curve2 = new Curve(
        new Segment(new Point(100, 100)),
        new Segment(new Point(200, 200))
      );
      
      const path1 = createPath(curve1);
      const path2 = createPath(curve2);
      
      const intersections = path1.getIntersections(path2);
      expect(intersections.length).toBe(1);
      expect(intersections[0].point.x).toBeCloseTo(100, 5);
      expect(intersections[0].point.y).toBeCloseTo(100, 5);
    });
  });
});