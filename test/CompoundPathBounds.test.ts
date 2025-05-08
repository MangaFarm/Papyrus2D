import { describe, it, expect } from 'vitest';
import { CompoundPath } from '../src/path/CompoundPath';
import { Path } from '../src/path/Path';
import { Point } from '../src/basic/Point';

describe('CompoundPathBounds', () => {
  it('check individual path bounds', () => {
    // 矩形パスを作成
    const path1 = Path.Rectangle({ from: new Point(0, 0), to: new Point(100, 100) });
    const path2 = Path.Rectangle({ from: new Point(50, 50), to: new Point(150, 150) });

    // 各パスの境界ボックスを確認
    const bounds1 = path1.getBounds(null, {});
    const bounds2 = path2.getBounds(null, {});
    
    // 期待される結果を確認
    expect(bounds1.x).toBe(0);
    expect(bounds1.y).toBe(0);
    expect(bounds1.width).toBe(100);
    expect(bounds1.height).toBe(100);
    
    expect(bounds2.x).toBe(50);
    expect(bounds2.y).toBe(50);
    expect(bounds2.width).toBe(100);
    expect(bounds2.height).toBe(100);
  });
  
  it('check compound path bounds calculation', () => {
    // 矩形パスを作成
    const path1 = Path.Rectangle({ from: new Point(0, 0), to: new Point(100, 100) });
    const path2 = Path.Rectangle({ from: new Point(50, 50), to: new Point(150, 150) });

    // CompoundPathを作成
    const compound = new CompoundPath([path1, path2]);
    
    // _getBoundsメソッドを直接テスト
    const boundsEntry = compound._getBounds(null, {});
    const bounds = boundsEntry.rect;

    // getBoundsメソッドの結果も確認
    const publicBounds = compound.getBounds(null, {});

    // 期待される結果を確認
    expect(bounds.x).toBe(0);
    expect(bounds.y).toBe(0);
    expect(bounds.width).toBe(150);
    expect(bounds.height).toBe(150);
  });
});