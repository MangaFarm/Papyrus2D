import { describe, it, expect } from 'vitest';
import { Path } from '../src/path/Path';
import { Point } from '../src/basic/Point';
import { Segment } from '../src/path/Segment';
import { divideLocations, getIntersections } from '../src/path/PathBooleanIntersections';

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
      const pt = seg._point.toPoint();
      const inter = seg._intersection;
      const next = inter?._next;
      const prev = inter?._previous;
      console.log(`🔥 divided[${i}]: seg=(${pt.x},${pt.y}) seg._index=${seg._index}`);
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

    // _intersectionがnullでないものが存在することを確認
    expect(divided.some(loc => loc._segment._intersection)).toBe(true);
  });
});