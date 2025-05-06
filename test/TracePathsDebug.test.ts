import { describe, it, expect } from 'vitest';
import { Path } from '../src/path/Path';
import { Segment } from '../src/path/Segment';
import { Point } from '../src/basic/Point';
import { tracePaths } from '../src/path/PathBooleanTracePaths';
import { getMeta } from '../src/path/SegmentMeta';

describe('tracePaths/isValid winding=0 debug', () => {
  it('should show isValid/tracePaths behavior for winding=0 segments', () => {
    // 矩形A (0,0)-(100,0)-(100,100)-(0,100)
    const rectA = new Path([
      new Segment(new Point(0, 0)),
      new Segment(new Point(100, 0)),
      new Segment(new Point(100, 100)),
      new Segment(new Point(0, 100))
    ], true);

    // 矩形B (50,50)-(150,50)-(150,150)-(50,150)
    const rectB = new Path([
      new Segment(new Point(50, 50)),
      new Segment(new Point(150, 50)),
      new Segment(new Point(150, 150)),
      new Segment(new Point(50, 150))
    ], true);

    // 2つのパスを合成したセグメント配列を作成
    const segments = [...rectA.getSegments(), ...rectB.getSegments()];

    // operator: subtract
    const operator = { '1': true, subtract: true };

    // 各セグメントのwindingを手動でセット
    // rectA: winding=1, rectB: winding=0
    for (let i = 0; i < segments.length; i++) {
      const meta = getMeta(segments[i]);
      if (!meta) continue;
      // @ts-ignore 型無視してquality/onPathもセット
      if (i < 4) {
        // @ts-ignore
        meta._winding = { winding: 1, windingL: 0, windingR: 1, quality: 1, onPath: false };
      } else {
        // @ts-ignore
        meta._winding = { winding: 0, windingL: 0, windingR: 0, quality: 1, onPath: false };
      }
    }

    // tracePathsでパスを構築
    const paths = tracePaths(segments, operator);

    // デバッグ出力
    for (let i = 0; i < paths.length; i++) {
      const segs = paths[i].getSegments();
    }

    // 期待されるのは、rectAのパスのみが出力されること
    expect(paths.length).toBe(1);
    const segs = paths[0].getSegments();
    expect(segs.length).toBe(4);
    const pt = segs[0]._point.toPoint();
    expect(pt.x).toBe(0);
    expect(pt.y).toBe(0);
  });
});