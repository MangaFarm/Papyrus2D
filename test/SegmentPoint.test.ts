import { describe, it, expect } from 'vitest';
import { Point } from '../src/basic/Point';
import { SegmentPoint } from '../src/path/SegmentPoint';

describe('SegmentPoint', () => {
  it('コンストラクタとプロパティ', () => {
    const p = new Point(1, 2);
    const owner = {};
    const sp = new SegmentPoint(p, owner, '_point');
    expect(sp._x).toBe(1);
    expect(sp._y).toBe(2);
    expect(sp._owner).toBe(owner);
    expect(owner['_point']).toBe(sp);
  });

  it('デフォルト値', () => {
    const p = new Point(0, 0);
    const sp = new SegmentPoint(p);
    expect(sp._x).toBe(0);
    expect(sp._y).toBe(0);
    expect(sp._owner).toBeUndefined();
  });

  it('cloneは同値の新インスタンスを返す', () => {
    const p = new Point(5, 6);
    const sp1 = new SegmentPoint(p);
    const sp2 = sp1.clone();
    expect(sp2).not.toBe(sp1);
    expect(sp2._x).toBe(sp1._x);
    expect(sp2._y).toBe(sp1._y);
  });

  it('equalsは座標が一致すればtrue', () => {
    const p1 = new Point(1, 2);
    const p2 = new Point(1, 2);
    const p3 = new Point(3, 4);
    const sp1 = new SegmentPoint(p1);
    const sp2 = new SegmentPoint(p2);
    const sp3 = new SegmentPoint(p3);
    expect(sp1.equals(sp2)).toBe(true);
    expect(sp1.equals(sp3)).toBe(false);
  });

  it('toStringが情報を含む文字列を返す', () => {
    const p = new Point(3, 4);
    const sp = new SegmentPoint(p);
    const str = sp.toString();
    expect(str).toContain('x:');
    expect(str).toContain('y:');
    expect(str).toContain('3');
    expect(str).toContain('4');
  });

  it('ミュータブルである', () => {
    const p = new Point(1, 2);
    const sp = new SegmentPoint(p);
    sp._x = 10;
    sp._y = 20;
    expect(sp._x).toBe(10);
    expect(sp._y).toBe(20);
  });
});