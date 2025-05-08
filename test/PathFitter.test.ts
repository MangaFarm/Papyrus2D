import { describe, it, expect } from 'vitest';
import { Path } from '../src/path/Path';
import { Segment } from '../src/path/Segment';
import { Point } from '../src/basic/Point';

describe('PathFitter', () => {
  describe('Path.simplify', () => {
    it('should simplify a path with many segments', () => {
      // 複雑なパスを作成（多くのセグメントを持つ）
      const path = new Path();
      
      // 円形のような形状を作成（多くのセグメントで構成）
      const centerX = 100;
      const centerY = 100;
      const radius = 50;
      const numPoints = 20; // 多くのポイントで円を近似
      
      for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        path.add(new Segment(new Point(x, y)));
      }
      
      // 閉じたパスにする
      path.setClosed(true);
      
      // 元のセグメント数を記録
      const originalSegmentCount = path.segmentCount;
      
      // パスを単純化
      const result = path.simplify(2.5); // デフォルトの許容誤差で単純化
      
      // 単純化が成功したことを確認
      expect(result).toBe(true);
      
      // セグメント数が減少したことを確認
      expect(path.segmentCount).toBeLessThan(originalSegmentCount);
      
      // 単純化後もパスが閉じていることを確認
      expect(path.isClosed()).toBe(true);
    });
    
    it('should handle paths with curves', () => {
      // 曲線を含むパスを作成
      const path = new Path();
      path.add(new Segment(new Point(0, 0)));
      
      // 曲線のハンドルを持つセグメントを追加
      const segment = new Segment(new Point(100, 0));
      segment.setHandleIn(new Point(-20, -20));
      path.add(segment);
      
      // 別のセグメントを追加
      path.add(new Segment(new Point(100, 100)));
      
      // 元のセグメント数を記録
      const originalSegmentCount = path.segmentCount;
      
      // パスを単純化
      path.simplify(2.5);
      
      // 単純化後もセグメントが存在することを確認
      expect(path.segmentCount).toBeGreaterThan(0);
      
      // 単純化によってセグメント数が変わる可能性があるが、
      // 極端に増えることはないはず
      expect(path.segmentCount).toBeLessThanOrEqual(originalSegmentCount * 2);
    });
    
    it('should return false for empty paths', () => {
      // 空のパス
      const path = new Path();
      
      // 単純化を試みる
      const result = path.simplify();
      
      // 単純化が失敗したことを確認
      expect(result).toBe(false);
      
      // セグメント数が0のままであることを確認
      expect(path.segmentCount).toBe(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle a path with only one segment', () => {
      // 1つのセグメントだけを持つパス
      const path = new Path();
      path.add(new Segment(new Point(10, 10)));
      
      // 単純化を試みる
      const result = path.simplify();
      
      // 単純化が成功したことを確認（1つのセグメントは既に最小なので変化なし）
      expect(result).toBe(true);
      expect(path.segmentCount).toBe(1);
    });
    
    it('should handle a path with three segments at the same position', () => {
      // 同じ位置に3つのセグメントがあるパス
      const path = new Path();
      path.add(new Segment(new Point(20, 20)));
      path.add(new Segment(new Point(20, 20)));
      path.add(new Segment(new Point(20, 20)));
      
      // 単純化を試みる
      const result = path.simplify();
      
      // 単純化が成功し、1つのセグメントになることを確認
      expect(result).toBe(true);
      expect(path.segmentCount).toBe(1);
    });
    
    it('should handle different tolerance values', () => {
      // 小さい許容誤差で単純化するパスを作成
      const pathLowTolerance = new Path();
      for (let i = 0; i < 10; i++) {
        // わずかに揺れる直線状のパス
        pathLowTolerance.add(new Segment(new Point(i * 10, 50 + (i % 2 === 0 ? 2 : -2))));
      }
      
      // 大きい許容誤差で単純化するパスを作成（同じ形状）
      const pathHighTolerance = new Path();
      for (let i = 0; i < 10; i++) {
        // わずかに揺れる直線状のパス
        pathHighTolerance.add(new Segment(new Point(i * 10, 50 + (i % 2 === 0 ? 2 : -2))));
      }
      
      // 元のセグメント数を記録
      const originalSegmentCount = pathLowTolerance.segmentCount;
      
      // 小さい許容誤差で単純化
      pathLowTolerance.simplify(1);
      
      // 大きい許容誤差で単純化
      pathHighTolerance.simplify(2.5);
      
      // 許容誤差を使用すると、セグメント数が削減されることを確認
      expect(pathLowTolerance.segmentCount).toBeLessThanOrEqual(originalSegmentCount);
      expect(pathHighTolerance.segmentCount).toBeLessThanOrEqual(originalSegmentCount);
    });
  });
});