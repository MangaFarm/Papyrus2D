import { describe, it, expect } from 'vitest';
import { Path } from '../src/path/Path';
import { Point } from '../src/basic/Point';
import { PathBoolean } from '../src/path/PathBoolean';
import { Segment } from '../src/path/Segment';
import { PathItem } from '../src/path/PathItem';
import { CompoundPath } from '../src/path/CompoundPath';

describe('PathBoolean', () => {
  // テスト用のヘルパー関数
  function testOperations(path1: Path, path2: Path, results: string[]) {
    // unite操作のテスト
    it('should correctly unite paths', () => {
      const result = PathBoolean.unite(path1, path2);
      expect(result).toBeDefined();
      
      // 結果のパスの形状を検証
      const segments = result.getSegments();
      expect(segments.length).toBeGreaterThan(0);
      
      // 結果の面積が両方のパスの面積以上であることを確認
      const area = result.getArea();
      const area1 = path1.getArea();
      const area2 = path2.getArea();
      expect(area).toBeGreaterThanOrEqual(Math.max(area1, area2));
      
      // 結果のバウンディングボックスが両方のパスを含むことを確認
      const bounds = result.getBounds();
      const bounds1 = path1.getBounds();
      const bounds2 = path2.getBounds();
      expect(bounds.x).toBeLessThanOrEqual(Math.min(bounds1.x, bounds2.x));
      expect(bounds.y).toBeLessThanOrEqual(Math.min(bounds1.y, bounds2.y));
      expect(bounds.x + bounds.width).toBeGreaterThanOrEqual(Math.max(bounds1.x + bounds1.width, bounds2.x + bounds2.width));
      expect(bounds.y + bounds.height).toBeGreaterThanOrEqual(Math.max(bounds1.y + bounds1.height, bounds2.y + bounds2.height));
      
      // 結果の文字列表現が期待通りであることを確認（結果が指定されている場合）
      if (results && results[0]) {
        // パスの文字列表現を比較
        const resultPathData = pathToString(result);
        expect(resultPathData).toBe(results[0]);
      }
    });
    
    // subtract操作のテスト（path1からpath2を引く）
    it('should correctly subtract path2 from path1', () => {
      const result = PathBoolean.subtract(path1, path2);
      expect(result).toBeDefined();
      
      // 結果のパスの形状を検証
      const segments = result.getSegments();
      
      // 結果の面積がpath1の面積以下であることを確認
      const area = result.getArea();
      const area1 = path1.getArea();
      expect(area).toBeLessThanOrEqual(area1);
      
      // 結果の文字列表現が期待通りであることを確認（結果が指定されている場合）
      if (results && results[1]) {
        // パスの文字列表現を比較
        const resultPathData = pathToString(result);
        expect(resultPathData).toBe(results[1]);
      }
    });
    
    // subtract操作のテスト（path2からpath1を引く）
    it('should correctly subtract path1 from path2', () => {
      const result = PathBoolean.subtract(path2, path1);
      expect(result).toBeDefined();
      
      // 結果のパスの形状を検証
      const segments = result.getSegments();
      
      // 結果の面積がpath2の面積以下であることを確認
      const area = result.getArea();
      const area2 = path2.getArea();
      expect(area).toBeLessThanOrEqual(area2);
      
      // 結果の文字列表現が期待通りであることを確認（結果が指定されている場合）
      if (results && results[2]) {
        // パスの文字列表現を比較
        const resultPathData = pathToString(result);
        expect(resultPathData).toBe(results[2]);
      }
    });
    
    // intersect操作のテスト
    it('should correctly intersect paths', () => {
      const result = PathBoolean.intersect(path1, path2);
      expect(result).toBeDefined();
      
      // 結果のパスの形状を検証
      const segments = result.getSegments();
      
      // 結果の面積が両方のパスの面積以下であることを確認
      const area = result.getArea();
      const area1 = path1.getArea();
      const area2 = path2.getArea();
      expect(area).toBeLessThanOrEqual(Math.min(area1, area2));
      
      // 結果の文字列表現が期待通りであることを確認（結果が指定されている場合）
      if (results && results[3]) {
        // パスの文字列表現を比較
        const resultPathData = pathToString(result);
        expect(resultPathData).toBe(results[3]);
      }
    });
    
    // exclude操作のテスト
    it('should correctly exclude paths', () => {
      // exclude操作はunite - intersectと同等
      const unite = PathBoolean.unite(path1, path2);
      const intersect = PathBoolean.intersect(path1, path2);
      const expected = PathBoolean.subtract(unite, intersect);
      
      // 結果の文字列表現が期待通りであることを確認（結果が指定されている場合）
      if (results && results[4]) {
        // パスの文字列表現を比較
        const resultPathData = pathToString(expected);
        expect(resultPathData).toBe(results[4]);
      }
    });
  }
  
  // パスを文字列表現に変換するヘルパー関数
  // paper.jsのgetPathDataメソッドを参考に実装
  function pathToString(path: PathItem): string {
    // CompoundPathの場合は各子パスを個別に処理
    if (path instanceof CompoundPath) {
      const compoundPath = path as CompoundPath;
      if (!compoundPath._children || compoundPath._children.length === 0) {
        return '';
      }
      
      // 各子パスのパスデータを連結
      const parts: string[] = [];
      for (const childPath of compoundPath._children) {
        // 子パスが空の場合はスキップ
        if (!childPath.getSegments().length) continue;
        
        // 各セグメントを処理
        const segments = childPath.getSegments();
        let part = '';
        
        for (let i = 0; i < segments.length; i++) {
          const segment = segments[i];
          const point = segment.getPoint();
          
          if (i === 0) {
            part += `M${point.x.toFixed(0)},${point.y.toFixed(0)}`;
          } else {
            part += `L${point.x.toFixed(0)},${point.y.toFixed(0)}`;
          }
        }
        
        // 閉じたパスの場合は最後にZを追加
        if (childPath.isClosed()) {
          part += 'Z';
        }
        
        parts.push(part);
      }
      
      return parts.join('');
    }
    
    // 通常のPathの場合
    if (!path || path.getSegments().length === 0) {
      return '';
    }
    
    const segments = path.getSegments();
    const parts: string[] = [];
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const point = segment.getPoint();
      
      if (i === 0) {
        parts.push(`M${point.x.toFixed(0)},${point.y.toFixed(0)}`);
      } else {
        parts.push(`L${point.x.toFixed(0)},${point.y.toFixed(0)}`);
      }
    }
    
    // 閉じたパスの場合は最後にZを追加
    if (path.closed) {
      parts.push('Z');
    }
    
    return parts.join('');
  }
  
  describe('Boolean operations with rectangles', () => {
    // 2つの重なる長方形を作成
    const rect1 = new Path([
      new Segment(new Point(0, 0)),
      new Segment(new Point(100, 0)),
      new Segment(new Point(100, 100)),
      new Segment(new Point(0, 100))
    ], true);
    
    const rect2 = new Path([
      new Segment(new Point(50, 50)),
      new Segment(new Point(150, 50)),
      new Segment(new Point(150, 150)),
      new Segment(new Point(50, 150))
    ], true);
    
    // 期待される結果
    const results = [
      'M0,0L100,0L100,50L150,50L150,150L50,150L50,100L0,100Z', // unite
      'M0,0L100,0L100,50L50,50L50,100L0,100Z',                 // subtract (rect1 - rect2)
      'M100,50L150,50L150,150L50,150L50,100L100,100Z',         // subtract (rect2 - rect1)
      'M50,50L100,50L100,100L50,100Z',                         // intersect
      'M0,0L100,0L100,50L150,50L150,150L50,150L50,100L0,100Z'  // exclude
    ];
    
    testOperations(rect1, rect2, results);
  });
  
  describe('Boolean operations with non-intersecting rectangles', () => {
    // 交差しない2つの長方形を作成
    const rect1 = new Path([
      new Segment(new Point(0, 0)),
      new Segment(new Point(100, 0)),
      new Segment(new Point(100, 100)),
      new Segment(new Point(0, 100))
    ], true);
    
    const rect2 = new Path([
      new Segment(new Point(200, 200)),
      new Segment(new Point(300, 200)),
      new Segment(new Point(300, 300)),
      new Segment(new Point(200, 300))
    ], true);
    
    // 期待される結果
    const results = [
      'M0,0L100,0L100,100L0,100ZM200,200L300,200L300,300L200,300Z', // unite
      'M0,0L100,0L100,100L0,100Z',                                  // subtract (rect1 - rect2)
      'M200,200L300,200L300,300L200,300Z',                          // subtract (rect2 - rect1)
      '',                                                            // intersect
      'M0,0L100,0L100,100L0,100ZM200,200L300,200L300,300L200,300Z'  // exclude
    ];
    
    testOperations(rect1, rect2, results);
  });
  
  describe('Boolean operations with nested rectangles', () => {
    // 内包関係にある2つの長方形を作成
    const rect1 = new Path([
      new Segment(new Point(0, 0)),
      new Segment(new Point(200, 0)),
      new Segment(new Point(200, 200)),
      new Segment(new Point(0, 200))
    ], true);
    
    const rect2 = new Path([
      new Segment(new Point(50, 50)),
      new Segment(new Point(150, 50)),
      new Segment(new Point(150, 150)),
      new Segment(new Point(50, 150))
    ], true);
    
    // 期待される結果
    const results = [
      'M0,0L200,0L200,200L0,200Z',                                  // unite
      'M0,0L200,0L200,200L0,200ZM50,50L150,50L150,150L50,150Z',     // subtract (rect1 - rect2)
      '',                                                            // subtract (rect2 - rect1)
      'M50,50L150,50L150,150L50,150Z',                              // intersect
      'M0,0L200,0L200,200L0,200ZM50,50L150,50L150,150L50,150Z'      // exclude
    ];
    
    testOperations(rect1, rect2, results);
  });
  
  describe('Boolean operations with circle and rectangle', () => {
    // 円を作成
    const circle = createCircle(new Point(100, 100), 50);
    
    // 長方形を作成
    const rect = new Path([
      new Segment(new Point(70, 50)),
      new Segment(new Point(170, 50)),
      new Segment(new Point(170, 150)),
      new Segment(new Point(70, 150))
    ], true);
    
    testOperations(circle, rect, []);
  });
  
  describe('Boolean operations with complex shapes', () => {
    // 複雑な形状（星形）
    const star = createStar(new Point(100, 100), 5, 50, 25);
    
    // 長方形
    const rect = new Path([
      new Segment(new Point(75, 75)),
      new Segment(new Point(125, 75)),
      new Segment(new Point(125, 125)),
      new Segment(new Point(75, 125))
    ], true);
    
    testOperations(star, rect, []);
  });
  
  describe('Boolean operations with self-intersecting paths', () => {
    // 自己交差するパス
    const path1 = new Path([
      new Segment(new Point(50, 50)),
      new Segment(new Point(150, 150)),
      new Segment(new Point(50, 150)),
      new Segment(new Point(150, 50))
    ], true);
    
    const rect = new Path([
      new Segment(new Point(75, 75)),
      new Segment(new Point(125, 75)),
      new Segment(new Point(125, 125)),
      new Segment(new Point(75, 125))
    ], true);
    
    testOperations(path1, rect, []);
  });
  
  describe('Boolean operations with horizontal overlapping rectangles', () => {
    // 水平方向に重なる長方形
    const rect1 = new Path([
      new Segment(new Point(50, 50)),
      new Segment(new Point(200, 50)),
      new Segment(new Point(200, 100)),
      new Segment(new Point(50, 100))
    ], true);
    
    const rect2 = new Path([
      new Segment(new Point(70, 50)),
      new Segment(new Point(220, 50)),
      new Segment(new Point(220, 100)),
      new Segment(new Point(70, 100))
    ], true);
    
    // 期待される結果
    const results = [
      'M50,50L220,50L220,100L50,100Z',  // unite
      'M50,50L70,50L70,100L50,100Z',    // subtract (rect1 - rect2)
      'M200,50L220,50L220,100L200,100Z', // subtract (rect2 - rect1)
      'M70,50L200,50L200,100L70,100Z',  // intersect
      'M50,50L70,50L70,100L50,100ZM200,50L220,50L220,100L200,100Z' // exclude
    ];
    
    testOperations(rect1, rect2, results);
  });
  
  describe('Boolean operations with vertical overlapping rectangles', () => {
    // 垂直方向に重なる長方形
    const rect1 = new Path([
      new Segment(new Point(50, 150)),
      new Segment(new Point(100, 150)),
      new Segment(new Point(100, 250)),
      new Segment(new Point(50, 250))
    ], true);
    
    const rect2 = new Path([
      new Segment(new Point(50, 175)),
      new Segment(new Point(100, 175)),
      new Segment(new Point(100, 275)),
      new Segment(new Point(50, 275))
    ], true);
    
    // 期待される結果
    const results = [
      'M50,150L100,150L100,275L50,275Z',  // unite
      'M50,150L100,150L100,175L50,175Z',  // subtract (rect1 - rect2)
      'M50,250L100,250L100,275L50,275Z',  // subtract (rect2 - rect1)
      'M50,175L100,175L100,250L50,250Z',  // intersect
      'M50,150L100,150L100,175L50,175ZM50,250L100,250L100,275L50,275Z' // exclude
    ];
    
    testOperations(rect1, rect2, results);
  });
});

// ヘルパー関数

// 円を作成する関数
function createCircle(center: Point, radius: number): Path {
  const segments: Segment[] = [];
  const numSegments = 36; // 円の滑らかさ
  
  for (let i = 0; i < numSegments; i++) {
    const angle = (i / numSegments) * Math.PI * 2;
    const x = center.x + Math.cos(angle) * radius;
    const y = center.y + Math.sin(angle) * radius;
    segments.push(new Segment(new Point(x, y)));
  }
  
  return new Path(segments, true);
}

// 星形を作成する関数
function createStar(center: Point, points: number, radius1: number, radius2: number): Path {
  const segments: Segment[] = [];
  const numPoints = points * 2;
  
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    const radius = i % 2 === 0 ? radius1 : radius2;
    const x = center.x + Math.cos(angle) * radius;
    const y = center.y + Math.sin(angle) * radius;
    segments.push(new Segment(new Point(x, y)));
  }
  
  return new Path(segments, true);
}