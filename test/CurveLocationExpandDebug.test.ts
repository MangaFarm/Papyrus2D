import { describe, it, expect } from 'vitest';
import { Path } from '../src/path/Path';
import { Point } from '../src/basic/Point';
import { Segment } from '../src/path/Segment';
import { getIntersections } from '../src/path/PathBooleanIntersections';
import { CurveLocation } from '../src/path/CurveLocation';

describe('CurveLocation.expand debug', () => {
  it('should show CurveLocation internal structure for rectangle-rectangle', () => {
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

    // 交点計算
    const intersections = getIntersections(rect1, rect2);

    // CurveLocation.expandの返す配列の各要素を出力
    for (let i = 0; i < intersections.length; i++) {
      const loc = intersections[i];
      const pt = loc._point;
      const seg = loc._segment;
      const segpt = seg?._point?.toPoint();
      const inter = seg?._intersection;
      const next = inter?._next;
      const prev = inter?._previous;
      console.log(`🔥 expand[${i}]: loc._point=(${pt.x},${pt.y}) seg=(${segpt?.x},${segpt?.y}) seg._index=${seg?._index}`);
      if (inter) {
        const ipt = inter._point;
        console.log(`  🔥 _intersection: (${ipt.x},${ipt.y})`);
        if (next) {
          const npt = next._point;
          console.log(`    🔥 _next: (${npt.x},${npt.y})`);
        }
        if (prev) {
          const ppt = prev._point;
          console.log(`    🔥 _previous: (${ppt.x},${ppt.y})`);
        }
      } else {
        console.log('  🔥 _intersection: null');
      }
    }

    // _segmentがnullでないものが存在することを確認
    expect(intersections.some(loc => loc._segment)).toBe(true);
  });
});