import { describe, it, expect } from 'vitest';
import { Path } from '../src/path/Path';
import { Point } from '../src/basic/Point';
import { Segment } from '../src/path/Segment';
import { getIntersections, divideLocations } from '../src/path/PathBooleanIntersections';

import { getMeta } from '../src/path/SegmentMeta';
describe('segments intersection debug', () => {
  it('should show which segments have _intersection', () => {
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
    const divided1 = divideLocations(intersections);
    const divided2 = divideLocations(intersections);

    const segments = rect1.getSegments().concat(rect2.getSegments());

    let count = 0;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const pt = seg._point?.toPoint();
      const hasInter = !!(seg && getMeta(seg)?._intersection);
      if (hasInter) count++;
    }

    expect(segments.length).toBeGreaterThan(0);
  });
});