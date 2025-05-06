import { describe, it, expect } from 'vitest';
import { Path } from '../src/path/Path';
import { Point } from '../src/basic/Point';
import { Segment } from '../src/path/Segment';
import { divideLocations, getIntersections } from '../src/path/PathBooleanIntersections';

describe('divideLocations intersection link debug', () => {
  it('should show _intersection link for divided segments', () => {
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
      const seg = divided[i]._segment;
      const pt = seg?._point?.toPoint();
      const hasInter = !!(seg as any)._intersection;
      const interObj = hasInter ? (seg as any)._intersection : undefined;
      const interPt = interObj && interObj._point instanceof Object && 'x' in interObj._point && 'y' in interObj._point
        ? interObj._point
        : null;
      const isSame = interObj === divided[i];
      console.log(`🔥 divided[${i}]: seg=(${pt?.x},${pt?.y}) _intersection=${hasInter} interPt=${interPt ? `(${interPt.x},${interPt.y})` : 'null'} isSame=${isSame}`);
    }

    expect(divided.length).toBeGreaterThan(0);
  });
});