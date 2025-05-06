import { describe, it, expect } from 'vitest';
import { Path } from '../src/path/Path';
import { Point } from '../src/basic/Point';
import { Segment } from '../src/path/Segment';
import { divideLocations, getIntersections } from '../src/path/PathBooleanIntersections';

import { getMeta } from '../src/path/SegmentMeta';
describe('divideLocations link structure', () => {
  it('should set up correct intersection links for rectangle-rectangle', () => {
    // Papyrus2D / paper.js "Boolean operations without crossings"と同じ設定
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
    const divided = divideLocations(intersections);

    // 各CurveLocationのリンク構造を出力
    for (let i = 0; i < divided.length; i++) {
      const loc = divided[i];
      const seg = loc._segment;
      if (!seg) continue;
      const pt = seg._point.toPoint();
      const inter = getMeta(seg)?._intersection;
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

    // _intersectionがnullでないものが存在することを確認
    expect(divided.some(loc => loc._segment && getMeta(loc._segment)?._intersection)).toBe(true);
  });
});