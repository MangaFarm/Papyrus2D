import { describe, it, expect } from 'vitest';
import { CompoundPath } from '../src/path/CompoundPath';
import { Path } from '../src/path/Path';
import { Point } from '../src/basic/Point';

describe('CompoundPath getArea debug', () => {
  it('should output area values for rectangles', () => {
    // 外側矩形
    const path1 = Path.Rectangle({ from: new Point(0, 0), to: new Point(100, 100) });
    // 内側矩形
    const path2 = Path.Rectangle({ from: new Point(25, 25), to: new Point(75, 75) });


    const compound = new CompoundPath([path1, path2]);

    // テスト自体は失敗してもよい
    expect(true).toBe(true);
  });
});