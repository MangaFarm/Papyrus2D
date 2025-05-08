import { describe, it } from 'vitest';
import { Path } from '../src/path/Path';
import { Point } from '../src/basic/Point';
import { Segment } from '../src/path/Segment';
import { subtract } from '../src/path/PathBoolean';
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

    const result = subtract(rect1, rect2);
  });
});