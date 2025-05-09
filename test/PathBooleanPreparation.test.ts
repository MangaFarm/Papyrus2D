import { describe, it, expect } from 'vitest';
import { Path } from '../src/path/Path';
import { Point } from '../src/basic/Point';
import { Segment } from '../src/path/Segment';
import { preparePath } from '../src/path/PathBooleanPreparation';
import { CompoundPath } from '../src/path/CompoundPath';

// preparePath関数のテスト
describe('preparePath function', () => {
  // 基本的なパスに対する動作テスト
  it('should prepare a basic path correctly', () => {
    // 基本的な長方形パスを作成
    const rect = new Path([
      new Segment(new Point(0, 0)),
      new Segment(new Point(100, 0)),
      new Segment(new Point(100, 100)),
      new Segment(new Point(0, 100))
    ], true);
    
    // パスを準備
    const prepared = preparePath(rect, false) as Path;
    
    // 準備されたパスが元のパスと同じ形状を持つことを確認
    expect(prepared).toBeDefined();
    expect(prepared).not.toBe(rect); // クローンされているので同一オブジェクトではない
    expect(prepared.getSegments().length).toBe(rect.getSegments().length);
    expect(prepared.isClosed()).toBe(rect.isClosed());
    
    // 座標が一致することを確認
    const originalPoints = rect.getSegments().map(s => s.getPoint());
    const preparedPoints = prepared.getSegments().map(s => s.getPoint());
    
    for (let i = 0; i < originalPoints.length; i++) {
      expect(preparedPoints[i].x).toBeCloseTo(originalPoints[i].x);
      expect(preparedPoints[i].y).toBeCloseTo(originalPoints[i].y);
    }
  });
  
  // 開いたパスが適切に閉じられるかテスト
  it('should close open paths when resolve is true', () => {
    // 開いたパスを作成
    const openPath = new Path([
      new Segment(new Point(0, 0)),
      new Segment(new Point(100, 0)),
      new Segment(new Point(100, 100)),
      new Segment(new Point(50, 50))
    ], false); // 閉じていないパス
    
    // resolve=trueでパスを準備
    const prepared = preparePath(openPath, true) as Path;
    
    // 準備されたパスが閉じていることを確認
    expect(prepared.isClosed()).toBe(true);
    
    // 最初と最後のセグメントのハンドルが適切に設定されていることを確認
    const firstSegment = prepared.getFirstSegment();
    const lastSegment = prepared.getLastSegment();
    
    if (firstSegment && lastSegment) {
      expect(firstSegment.getHandleIn().x).toBe(0);
      expect(firstSegment.getHandleIn().y).toBe(0);
      expect(lastSegment.getHandleOut().x).toBe(0);
      expect(lastSegment.getHandleOut().y).toBe(0);
    }
  });
  
  // 自己交差パスが正しく分割されるかテスト
  it('should resolve self-intersecting paths when resolve is true', () => {
    // 矩形に対角線を追加して明確な自己交差を発生させる
    const selfIntersecting = new Path([
      new Segment(new Point(0, 0)),
      new Segment(new Point(150, 0)),
      new Segment(new Point(150, 150)),
      new Segment(new Point(0, 150))
    ], true);

    // 対角線を追加してパスを自己交差させる
    selfIntersecting.lineTo(new Point(150, 0));
    selfIntersecting.lineTo(new Point(0, 150));
    selfIntersecting.close();

    const originalSegCount = selfIntersecting.getSegments().length;

    // resolve=true でパスを準備
    const prepared = preparePath(selfIntersecting, true) as Path;
 
    // 分割後、各セグメントは直線（ハンドル長 0）である
    prepared.getSegments().forEach(seg => {
      expect(seg.getHandleIn().isZero()).toBe(true);
      expect(seg.getHandleOut().isZero()).toBe(true);
    });
  });
  
  // CompoundPathに対する動作テスト
  it('should handle CompoundPath correctly', () => {
    // 2つのパスからなるCompoundPathを作成
    const rect1 = new Path([
      new Segment(new Point(0, 0)),
      new Segment(new Point(50, 0)),
      new Segment(new Point(50, 50)),
      new Segment(new Point(0, 50))
    ], true);
    
    const rect2 = new Path([
      new Segment(new Point(70, 70)),
      new Segment(new Point(120, 70)),
      new Segment(new Point(120, 120)),
      new Segment(new Point(70, 120))
    ], true);
    
    const compoundPath = new CompoundPath();
    compoundPath.addChild(rect1);
    compoundPath.addChild(rect2);
    
    // パスを準備
    const prepared = preparePath(compoundPath, false);
    
    // 準備されたパスがCompoundPathであることを確認
    expect(prepared instanceof CompoundPath).toBe(true);
    
    // 子パスの数が一致することを確認
    const preparedCompound = prepared as CompoundPath;
    expect(preparedCompound._children?.length).toBe(2);
  });
});

