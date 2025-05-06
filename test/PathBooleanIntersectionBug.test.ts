import { describe, it, expect } from 'vitest';
import { Path } from '../src/path/Path';
import { Point } from '../src/basic/Point';
import { Segment } from '../src/path/Segment';
import { getIntersections, divideLocations } from '../src/path/PathBooleanIntersections';

describe('PathBooleanIntersections バグ再現テスト', () => {
  it('dividePathAtIntersections後、交点に対応するSegment全てに_intersectionがセットされるべき', () => {
    // 2つの重なる矩形
    const rect1 = new Path([
      new Segment(new Point(0, 0)),
      new Segment(new Point(100, 0)),
      new Segment(new Point(100, 100)),
      new Segment(new Point(0, 100))
    ], true);

    const rect2 = new Path([
      new Segment(new Point(50, 50)),
      new Segment(new Point(150, 50)),
      new Segment(new Point(150, 150)),
      new Segment(new Point(50, 150))
    ], true);

    // 交点を取得
    const intersections = getIntersections(rect1, rect2);
    expect(intersections.length).toBeGreaterThan(0);

    // rect1を交点で分割
    const locations = divideLocations(intersections);

    // 交点CurveLocationの_segmentに必ず_intersectionがセットされているべき
    let foundIntersectionSegment = 0;
    for (const loc of locations) {
      const seg = (loc as any)._segment;
      if (!seg) continue;
      // CurveLocation自身が交点情報なので、_segment._intersectionが必ずセットされているべき
      if (!(seg as any)._intersection) {
        // バグを自明にするため詳細出力
        console.error('🔥BUG: intersection segmentに_intersectionがセットされていない', seg.getPoint());
      }
      expect((seg as any)._intersection).toBeDefined();
      foundIntersectionSegment++;
    }
    // 少なくとも1つは交点CurveLocationが存在するはず
    expect(foundIntersectionSegment).toBeGreaterThan(0);
  });
});