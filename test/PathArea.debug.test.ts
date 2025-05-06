import { describe, it } from 'vitest';
import { Path } from '../src/path/Path';
import { Point } from '../src/basic/Point';

describe('PathAreaDebug', () => {
  it('🔥 Papyrus2D Path.Rectangle のセグメント順序と座標', () => {
    const rect = Path.Rectangle({ from: new Point(0, 0), to: new Point(10, 10) });
    const segments = rect.getSegments();
    for (let i = 0; i < segments.length; i++) {
      const pt = segments[i].point;
      console.log(`🔥 segment[${i}]: (${pt.x}, ${pt.y})`);
    }
    console.log('🔥 getArea:', rect.getArea());
  });
});