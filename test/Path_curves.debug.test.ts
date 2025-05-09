import { describe, it, expect } from 'vitest';
import { Path } from '../src/path/Path';
import { Segment } from '../src/path/Segment';
import { Point } from '../src/basic/Point';

describe('Path.curves バグ再現・正常系テスト', () => {
  it('正常: 直接セグメントを追加した場合 getCurves() の長さ', () => {
    const path = new Path();
    path.add(new Segment(new Point(0, 0)));
    path.add(new Segment(new Point(100, 0)));
    path.add(new Segment(new Point(100, 100)));
    expect(path.getSegments().length).toBe(3);
    expect(path.getCurves().length).toBe(2); // open path: n-1
  });

  it('バグ再現: removeSegments→setSegmentsで getCurves() が0になる', () => {
    const path = new Path();
    path.add(new Segment(new Point(0, 0)));
    path.add(new Segment(new Point(100, 0)));
    path.add(new Segment(new Point(100, 100)));
    const segs = path.removeSegments();
    path.setSegments(segs);
    // 🔥 バグ: getSegmentsは3だがgetCurvesは0
    console.log("🔥 Path.getSegments().length:", path.getSegments().length);
    console.log("🔥 Path.getCurves().length:", path.getCurves().length);
    expect(path.getSegments().length).toBe(3);
    expect(path.getCurves().length).toBe(2); // 本来2になるべき
  });

  it('setSegmentsで空配列を渡した場合 getCurves() は0', () => {
    const path = new Path();
    path.setSegments([]);
    expect(path.getCurves().length).toBe(0);
  });

  it('closedパスの場合 getCurves() の長さ', () => {
    const path = new Path();
    path.add(new Segment(new Point(0, 0)));
    path.add(new Segment(new Point(100, 0)));
    path.add(new Segment(new Point(100, 100)));
    path.setClosed(true);
    expect(path.getSegments().length).toBe(3);
    expect(path.getCurves().length).toBe(3); // closed path: n
  });
});