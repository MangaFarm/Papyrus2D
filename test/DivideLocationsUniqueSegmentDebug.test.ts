import { describe, it, expect } from 'vitest';
import { Path } from '../src/path/Path';
import { Point } from '../src/basic/Point';
import { Segment } from '../src/path/Segment';
import { divideLocations, getIntersections } from '../src/path/PathBooleanIntersections';

describe('divideLocations unique segment debug', () => {
  it('should show unique segments and their path presence', () => {
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

    // 一意なセグメントを抽出
    const uniqueSegments = Array.from(new Set(divided.map(loc => loc._segment))).filter(Boolean);

    for (let i = 0; i < uniqueSegments.length; i++) {
      const seg = uniqueSegments[i];
      const pt = seg?._point?.toPoint();
      const pathId = seg?._path?._id;
      const idx = seg?._index;
      // パス上に存在するか
      const inPath = seg?._path?._segments?.includes(seg);
      console.log(`🔥 uniqueSeg[${i}]: seg=(${pt?.x},${pt?.y}) pathId=${pathId} idx=${idx} inPath=${inPath}`);
    }

    expect(uniqueSegments.length).toBeGreaterThan(0);
  });
});