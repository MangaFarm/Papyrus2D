import { describe, it, expect } from 'vitest';
import { Curve } from '../src/path/Curve';
import { Segment } from '../src/path/Segment';
import { Point } from '../src/basic/Point';
import { addLineIntersection } from '../src/path/CurveIntersectionSpecial';

describe('CurveIntersectionMain_isolate - addLineIntersection debug', () => {
  it('🔥 crossing lines: addLineIntersection debug', () => {
    // 水平線 (0,0)-(100,0)
    const segA1 = new Segment(new Point(0, 0));
    const segA2 = new Segment(new Point(100, 0));
    const curveA = new Curve(null, segA1, segA2);

    // 垂直線 (50,-50)-(50,50)
    const segB1 = new Segment(new Point(50, -50));
    const segB2 = new Segment(new Point(50, 50));
    const curveB = new Curve(null, segB1, segB2);

    const vA = curveA.getValues();
    const vB = curveB.getValues();

    const locations: any[] = [];
    // addLineIntersectionの中で🔥デバッグ出力を行うため、関数をラップ
    const include = undefined;

    // addLineIntersectionの挙動を直接検証
    addLineIntersection(vA, vB, curveA, curveB, locations, include, false);

    // デバッグ出力
    if (locations.length > 0) {
      for (const loc of locations) {
        if (loc.getPoint) {
          const pt = loc.getPoint();
        }
      }
    }
    expect(locations.length).toBe(1);
    if (locations.length > 0) {
      const pt = locations[0].getPoint();
      expect(pt.x).toBeCloseTo(50);
      expect(pt.y).toBeCloseTo(0);
    }
  });
});