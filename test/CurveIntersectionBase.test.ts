import { describe, it, expect } from 'vitest';
import { insertLocation, addLocation } from '../src/path/CurveIntersectionBase';
import { Curve } from '../src/path/Curve';
import { Path } from '../src/path/Path';
import { Segment } from '../src/path/Segment';
import { CurveLocation } from '../src/path/CurveLocation';
import { Point } from '../src/basic/Point';
import { Numerical } from '../src/util/Numerical';

// ダミーCurve生成
function makeDummyCurve(): Curve {
  const seg1 = new Segment(new Point(0, 0));
  const seg2 = new Segment(new Point(100, 0));
  const dummyPath = new Path([seg1, seg2], false);
  seg1._path = dummyPath; seg1._index = 0;
  seg2._path = dummyPath; seg2._index = 1;
  return new Curve(dummyPath, seg1, seg2);
}

// CurveLocationをaddLocation相当の相互参照付きで生成
function makeDummyLocation(curve: Curve, t: number, pt: Point) {
  const loc1 = new CurveLocation(curve, t, pt, null);
  const loc2 = new CurveLocation(curve, t, pt, null);
  loc1._intersection = loc2;
  loc2._intersection = loc1;
  return loc1;
}

describe('insertLocation', () => {
  it('should not add duplicate locations for same curve and t', () => {
    const curve = makeDummyCurve();
    const pt = new Point(0, 0);
    const loc1 = makeDummyLocation(curve, 0, pt);
    const loc2 = makeDummyLocation(curve, 0, pt);
    const locations: CurveLocation[] = [];
    insertLocation(locations, loc1);
    const idx = insertLocation(locations, loc2);
    expect(locations.length).toBe(1);
    expect(idx).toBe(0);
  });

  it('should add both locations if includeOverlaps=true', () => {
    const curve = makeDummyCurve();
    const pt = new Point(0, 0);
    const loc1 = makeDummyLocation(curve, 0, pt);
    const loc2 = makeDummyLocation(curve, 0, pt);
    const locations: CurveLocation[] = [];
    insertLocation(locations, loc1, true);
    const idx = insertLocation(locations, loc2, true);
    expect(locations.length).toBe(2);
    expect(idx).toBe(1);
  });

  it('should treat t=0 and t=Numerical.CURVETIME_EPSILON as duplicate', () => {
    const curve = makeDummyCurve();
    const pt = new Point(0, 0);
    const loc1 = makeDummyLocation(curve, 0, pt);
    const loc2 = makeDummyLocation(curve, Numerical.CURVETIME_EPSILON, pt);
    const locations: CurveLocation[] = [];
    insertLocation(locations, loc1);
    const idx = insertLocation(locations, loc2);
    expect(locations.length).toBe(1);
    expect(idx).toBe(0);
  });

  it('should add locations at t=0 and t=1 as separate if on different curves', () => {
    const curve1 = makeDummyCurve();
    const curve2 = makeDummyCurve();
    const pt1 = new Point(0, 0);
    const pt2 = new Point(100, 0);
    const loc1 = makeDummyLocation(curve1, 0, pt1);
    const loc2 = makeDummyLocation(curve2, 1, pt2);
    const locations: CurveLocation[] = [];
    insertLocation(locations, loc1);
    const idx = insertLocation(locations, loc2);
    expect(locations.length).toBe(2);
    expect(idx).toBe(1);
  });

  it('should treat locations with close points as duplicate', () => {
    const curve = makeDummyCurve();
    const pt1 = new Point(0, 0);
    const pt2 = new Point(Numerical.GEOMETRIC_EPSILON / 2, 0);
    const loc1 = makeDummyLocation(curve, 0, pt1);
    const loc2 = makeDummyLocation(curve, 0.5, pt2);
    const locations: CurveLocation[] = [];
    insertLocation(locations, loc1);
    const idx = insertLocation(locations, loc2);
    expect(locations.length).toBe(1);
    expect(idx).toBe(0);
  });
});

describe('insertLocation - Papyrus2D PathBoolean失敗ケース再現', () => {
  it('should not drop intersection at rectangle endpoint (frame.intersect(rect) case)', () => {
    // わかりやすい直線同士の交点
    // A: (0,0)-(0,10) の縦線
    const segA1 = new Segment(new Point(0, 0));
    const segA2 = new Segment(new Point(0, 10));
    const pathA = new Path([segA1, segA2], false);
    segA1._path = pathA; segA1._index = 0;
    segA2._path = pathA; segA2._index = 1;
    const curveA = new Curve(pathA, segA1, segA2);

    // B: (0,5)-(10,5) の横線
    const segB1 = new Segment(new Point(0, 5));
    const segB2 = new Segment(new Point(10, 5));
    const pathB = new Path([segB1, segB2], false);
    segB1._path = pathB; segB1._index = 0;
    segB2._path = pathB; segB2._index = 1;
    const curveB = new Curve(pathB, segB1, segB2);

    // 交点 (0,5) - Aのt=0.5, Bのt=0.0
    const pt = new Point(0, 5);
    const tA = 0.5;
    const tB = 0.0;

    // CurveLocationをaddLocation経由で生成（相互参照付き）
    const locations: CurveLocation[] = [];
    addLocation(locations, undefined, curveA, tA, curveB, tB, false);

    // 交点が1つ追加されていること
    expect(locations.length).toBe(1);
    expect(locations[0]._point.x).toBeCloseTo(0);
    expect(locations[0]._point.y).toBeCloseTo(5);
  });
});