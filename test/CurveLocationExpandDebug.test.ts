import { describe, it, expect } from 'vitest';
import { Path } from '../src/path/Path';
import { Point } from '../src/basic/Point';
import { Segment } from '../src/path/Segment';
import { getIntersections } from '../src/path/PathBooleanIntersections';
import { CurveLocation } from '../src/path/CurveLocation';
import { getMeta } from '../src/path/SegmentMeta';

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
      const inter = seg ? getMeta(seg)?._intersection : undefined;
      const next = inter?._next;
      const prev = inter?._previous;
      if (inter) {
        const ipt = inter._point;
        if (next) {
          const npt = next._point;
        }
        if (prev) {
          const ppt = prev._point;
        }
      } else {
      }
    }

    // _segmentがnullでないものが存在することを確認
    expect(intersections.some(loc => loc._segment)).toBe(true);
  });
});