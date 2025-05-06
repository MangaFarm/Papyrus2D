import { describe, it, expect } from 'vitest';
import { Path } from '../src/path/Path';
import { Point } from '../src/basic/Point';
import { Segment } from '../src/path/Segment';
import { divideLocations, getIntersections } from '../src/path/PathBooleanIntersections';
import { getMeta } from '../src/path/SegmentMeta';

describe('divideLocations segment debug', () => {
  it('should show segment info for each divided location', () => {
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

    const intersections = getIntersections(rect1, rect2);
    const divided = divideLocations(intersections);

    for (let i = 0; i < divided.length; i++) {
      const loc = divided[i];
      const seg = loc._segment;
      const pt = seg?._point?.toPoint();
      const pathId = seg?._path?._id;
      const idx = seg?._index;
      const meta = seg ? getMeta(seg) : null;
      const winding = meta && meta.winding ? meta.winding.winding : undefined;
      console.log(`🔥 divided[${i}]: seg=(${pt?.x},${pt?.y}) pathId=${pathId} idx=${idx} winding=${winding}`);
    }

    expect(divided.length).toBeGreaterThan(0);
  });
});