// 自作: removeSegmentsの動作検証用
import { describe, it, expect } from 'vitest';
import { Path } from '../src/path/Path';
import { Segment } from '../src/path/Segment';
import { Point } from '../src/basic/Point';

describe('Path.removeSegments', () => {
  it('should keep curves/segments in sync after removing segments (末尾削除)', () => {
    const path = new Path([
      new Segment(new Point(0, 0)),
      new Segment(new Point(50, 0)),
      new Segment(new Point(100, 0))
    ]);
    // 初期状態
    let curves = path.getCurves();
    expect(curves.length).toBe(2);
    expect(curves[0]._segment1._index).toBe(0);
    expect(curves[0]._segment2._index).toBe(1);
    expect(curves[1]._segment1._index).toBe(1);
    expect(curves[1]._segment2._index).toBe(2);

    // 末尾セグメント削除
    path.removeSegments(2, 3);
    curves = path.getCurves();
    expect(path.getSegments().length).toBe(2);
    expect(curves.length).toBe(1);
    expect(curves[0]._segment1._index).toBe(0);
    expect(curves[0]._segment2._index).toBe(1);
    // undefinedが混入していないか
    expect(curves[0]._segment1).toBeDefined();
    expect(curves[0]._segment2).toBeDefined();
  });

  it('should keep curves/segments in sync after removing segments (先頭削除)', () => {
    const path = new Path([
      new Segment(new Point(0, 0)),
      new Segment(new Point(50, 0)),
      new Segment(new Point(100, 0))
    ]);
    // 先頭セグメント削除
    path.removeSegments(0, 1);
    const curves = path.getCurves();
    expect(path.getSegments().length).toBe(2);
    expect(curves.length).toBe(1);
    expect(curves[0]._segment1._index).toBe(0);
    expect(curves[0]._segment2._index).toBe(1);
    expect(curves[0]._segment1).toBeDefined();
    expect(curves[0]._segment2).toBeDefined();
  });

  it('should handle removing all segments', () => {
    const path = new Path([
      new Segment(new Point(0, 0)),
      new Segment(new Point(50, 0)),
      new Segment(new Point(100, 0))
    ]);
    path.removeSegments();
    expect(path.getSegments().length).toBe(0);
    expect(path.getCurves().length).toBe(0);
  });
});