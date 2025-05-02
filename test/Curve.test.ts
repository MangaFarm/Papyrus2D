import { describe, it, expect } from 'vitest';
import { Point } from '../src/basic/Point';
import { Segment } from '../src/path/Segment';
import { Curve } from '../src/path/Curve';

describe('Curve', () => {
it('Curve.getIterations should return reasonable step count', () => {
    // a, bが等しい場合は最小値
    expect(Curve.getIterations(0, 0)).toBeGreaterThanOrEqual(2);
    // a, bが1離れている場合
    const n1 = Curve.getIterations(0, 1);
    expect(n1).toBeGreaterThanOrEqual(2);
    // a, bの差が大きい場合は分割数も大きくなる
    const n2 = Curve.getIterations(0, 100);
    expect(n2).toBeGreaterThan(n1);
  });
  it('should return correct length for a straight line', () => {
    const seg1 = new Segment(new Point(0, 0));
    const seg2 = new Segment(new Point(3, 4));
    const curve = new Curve(seg1, seg2);
    expect(curve.getLength()).toBeCloseTo(5, 8);
  });

  it('should return correct point at t=0, t=1 for a straight line', () => {
    const seg1 = new Segment(new Point(0, 0));
    const seg2 = new Segment(new Point(3, 4));
    const curve = new Curve(seg1, seg2);
    expect(curve.getPointAt(0).equals(new Point(0, 0))).toBe(true);
    expect(curve.getPointAt(1).equals(new Point(3, 4))).toBe(true);
  });

  it('should return correct tangent for a straight line', () => {
    const seg1 = new Segment(new Point(0, 0));
    const seg2 = new Segment(new Point(3, 4));
    const curve = new Curve(seg1, seg2);
    const tangent = curve.getTangentAt(0.5);
    // 直線なので常に(3,4)方向
    expect(tangent.x / tangent.y).toBeCloseTo(3 / 4, 8);
  });
it('should return (1,0) tangent for a horizontal straight line', () => {
    const seg1 = new Segment(new Point(0, 0));
    const seg2 = new Segment(new Point(10, 0));
    const curve = new Curve(seg1, seg2);
    expect(curve.getTangentAt(0).equals(new Point(1, 0))).toBe(true);
    expect(curve.getTangentAt(1).equals(new Point(1, 0))).toBe(true);
  });

  it('should return correct length for a cubic Bezier curve', () => {
    const seg1 = new Segment(new Point(0, 0), new Point(0, 0), new Point(1, 2));
    const seg2 = new Segment(new Point(3, 4), new Point(-1, -2), new Point(0, 0));
    const curve = new Curve(seg1, seg2);
    // 厳密値は難しいが、直線より長いはず
    expect(curve.getLength()).toBeGreaterThan(5);
  });

  it('should return correct point at t=0.5 for a cubic Bezier curve', () => {
    const seg1 = new Segment(new Point(0, 0), new Point(0, 0), new Point(1, 2));
    const seg2 = new Segment(new Point(3, 4), new Point(-1, -2), new Point(0, 0));
    const curve = new Curve(seg1, seg2);
    const pt = curve.getPointAt(0.5);
    // だいたい中間付近
    expect(pt.x).toBeGreaterThan(1);
    expect(pt.x).toBeLessThan(3);
    expect(pt.y).toBeGreaterThan(1);
    expect(pt.y).toBeLessThan(4);
  });

  it('should return correct tangent at t=0, t=1 for a cubic Bezier curve', () => {
    const seg1 = new Segment(new Point(0, 0), new Point(0, 0), new Point(1, 2));
    const seg2 = new Segment(new Point(3, 4), new Point(-1, -2), new Point(0, 0));
    const curve = new Curve(seg1, seg2);
    const tan0 = curve.getTangentAt(0);
    const tan1 = curve.getTangentAt(1);
    // t=0はhandleOut方向、t=1はhandleIn方向
    expect(tan0.x).toBeGreaterThan(0);
    expect(tan1.x).toBeGreaterThan(0);
  });
it('should divide a straight line at t=0.5 correctly', () => {
    const seg1 = new Segment(new Point(0, 0));
    const seg2 = new Segment(new Point(10, 0));
    const curve = new Curve(seg1, seg2);
    const [left, right] = curve.divide(0.5);

    // 左カーブの始点は元の始点
    expect(left.segment1.point.equals(new Point(0, 0))).toBe(true);
    // 右カーブの終点は元の終点
    expect(right.segment2.point.equals(new Point(10, 0))).toBe(true);
    // 分割点は両カーブの接続点
    expect(left.segment2.point.equals(right.segment1.point)).toBe(true);
    // 分割点はt=0.5の点
    const mid = curve.getPointAt(0.5);
    expect(left.segment2.point.equals(mid)).toBe(true);
  });

  it('should divide a cubic Bezier curve at t=0.5 correctly', () => {
    const seg1 = new Segment(new Point(0, 0), new Point(0, 0), new Point(2, 4));
    const seg2 = new Segment(new Point(10, 0), new Point(-2, -4), new Point(0, 0));
    const curve = new Curve(seg1, seg2);
    const [left, right] = curve.divide(0.5);

    // 左カーブの始点は元の始点
    expect(left.segment1.point.equals(new Point(0, 0))).toBe(true);
    // 右カーブの終点は元の終点
    expect(right.segment2.point.equals(new Point(10, 0))).toBe(true);
    // 分割点は両カーブの接続点
    expect(left.segment2.point.equals(right.segment1.point)).toBe(true);
    // 分割点はt=0.5の点
    const mid = curve.getPointAt(0.5);
    expect(left.segment2.point.equals(mid)).toBe(true);
  });

  it('split(t) should return the left part of divide(t)', () => {
    const seg1 = new Segment(new Point(0, 0));
    const seg2 = new Segment(new Point(10, 0));
    const curve = new Curve(seg1, seg2);
    const left = curve.split(0.3);
    const [left2, _] = curve.divide(0.3);
    expect(left.segment1.point.equals(left2.segment1.point)).toBe(true);
    expect(left.segment2.point.equals(left2.segment2.point)).toBe(true);
});

it('getPart(from, to) and fromValues should extract correct sub-curve', () => {
  // 三次ベジェ: (0,0)→(10,0) ハンドル(0,10),(10,10)
  const seg1 = new Segment(new Point(0, 0), new Point(0, 0), new Point(0, 10));
  const seg2 = new Segment(new Point(10, 0), new Point(0, 10), new Point(0, 0));
  const curve = new Curve(seg1, seg2);
  const v = curve['getValues']();
  // 区間[0.2, 0.8]の部分曲線
  const partVals = Curve.getPart(v, 0.2, 0.8);
  const partCurve = Curve.fromValues(partVals);
  // 端点が一致すること
  expect(partCurve.segment1.point.x).toBeCloseTo(
    curve.getPointAt(0.2).x, 6
  );
  expect(partCurve.segment1.point.y).toBeCloseTo(
    curve.getPointAt(0.2).y, 6
  );
  expect(partCurve.segment2.point.x).toBeCloseTo(
    curve.getPointAt(0.8).x, 6
  );
  expect(partCurve.segment2.point.y).toBeCloseTo(
    curve.getPointAt(0.8).y, 6
  );
});
});

it('Curve.getIterations should return reasonable step count', () => {
  // a, bが等しい場合は最小値
  expect(Curve.getIterations(0, 0)).toBeGreaterThanOrEqual(1);
  // a, bが1離れている場合
  const n1 = Curve.getIterations(0, 1);
  expect(n1).toBeGreaterThanOrEqual(1);
  // a, bの差が大きい場合は分割数も大きくなる
  const n2 = Curve.getIterations(0, 100);
  expect(n2).toBeGreaterThan(n1);
});