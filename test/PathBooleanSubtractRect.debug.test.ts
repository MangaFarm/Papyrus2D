import { describe, it } from 'vitest';
import { Path } from '../src/path/Path';
import { Point } from '../src/basic/Point';
import { Segment } from '../src/path/Segment';
import { PathBoolean } from '../src/path/PathBoolean';
import { getMeta } from '../src/path/SegmentMeta';

describe('🔥 PathBoolean.subtract debug (rect-rect)', () => {
  it('should output SVG path data for rect1 - rect2', () => {
    // paper.jsと同じ設定
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

    const result = PathBoolean.subtract(rect1, rect2);

    // 🔥 resultの全セグメントの座標・winding値を出力
    const segments = result.getSegments();
    for (const seg of segments) {
      const pt = seg._point?.toPoint();
      const meta = getMeta(seg);
      const winding = meta._winding ? meta._winding.winding : undefined;
      // eslint-disable-next-line no-console
      console.log(`🔥 segment: (${pt?.x},${pt?.y}) winding=${winding}`);
    }

    // getPathData()があれば出力
    if (typeof (result as any).getPathData === 'function') {
      // eslint-disable-next-line no-console
      console.log('🔥 subtract result getPathData:', (result as any).getPathData());
    } else {
      // eslint-disable-next-line no-console
      console.log('🔥 subtract result (no getPathData)');
    }
  });
});