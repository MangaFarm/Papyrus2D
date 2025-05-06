import { describe, it, expect } from 'vitest';
import { Path } from '../src/path/Path';
import { Point } from '../src/basic/Point';
import { Segment } from '../src/path/Segment';
import { PathBoolean } from '../src/path/PathBoolean';

describe('PathBooleanDebugIsolate', () => {
  it('subtract: rectangle - rectangle (最小ケース)', () => {
    // Papyrus2D / paper.js の "Boolean operations without crossings" と同じ設定
    const rect1 = new Path([
      new Segment(new Point(0, 0)),
      new Segment(new Point(200, 0)),
      new Segment(new Point(200, 200)),
      new Segment(new Point(0, 200))
    ], true);

    const rect2 = new Path([
      new Segment(new Point(150, 50)),
      new Segment(new Point(250, 50)),
      new Segment(new Point(250, 150)),
      new Segment(new Point(150, 150))
    ], true);

    // 1. intersections
    // 2. divideLocations
    // 3. tracePaths
    // 4. 最終 result の getPathData

    // PathBoolean内部のデバッグ出力も有効化されている前提
    const result = PathBoolean.subtract(rect1, rect2);

    // 追加で明示的に出力
    if (result && typeof (result as any).getPathData === 'function') {
    }

    // 期待値
    const expected = 'M0,200v-200h200v200zM150,150v-100h-100v100z';
    expect(typeof (result as any).getPathData === 'function' ? (result as any).getPathData() : '').toBe(expected);
  });
});