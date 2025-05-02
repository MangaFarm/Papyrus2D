import { describe, it, expect } from 'vitest';
import { Point } from '../src/basic/Point';
import { SegmentPoint, SegmentPointType } from '../src/path/SegmentPoint';

describe('SegmentPoint', () => {
  it('コンストラクタとプロパティ', () => {
    const p = new Point(1, 2);
    const sp = new SegmentPoint(p, 'anchor', 3);
    expect(sp.point.equals(p)).toBe(true);
    expect(sp.type).toBe('anchor');
    expect(sp.segmentIndex).toBe(3);
  });

  it('デフォルト値', () => {
    const p = new Point(0, 0);
    const sp = new SegmentPoint(p);
    expect(sp.type).toBe('anchor');
    expect(sp.segmentIndex).toBe(0);
  });

  it('cloneは同値の新インスタンスを返す', () => {
    const p = new Point(5, 6);
    const sp1 = new SegmentPoint(p, 'handleIn', 2);
    const sp2 = sp1.clone();
    expect(sp2).not.toBe(sp1);
    expect(sp2.equals(sp1)).toBe(true);
  });

  it('equalsは全プロパティ一致でtrue', () => {
    const p1 = new Point(1, 2);
    const p2 = new Point(1, 2);
    const sp1 = new SegmentPoint(p1, 'handleOut', 1);
    const sp2 = new SegmentPoint(p2, 'handleOut', 1);
    const sp3 = new SegmentPoint(p2, 'anchor', 1);
    expect(sp1.equals(sp2)).toBe(true);
    expect(sp1.equals(sp3)).toBe(false);
  });

  it('toStringが情報を含む文字列を返す', () => {
    const p = new Point(3, 4);
    const sp = new SegmentPoint(p, 'handleIn', 7);
    const str = sp.toString();
    expect(str).toContain('point:');
    expect(str).toContain('handleIn');
    expect(str).toContain('7');
  });

  it('イミュータブルである', () => {
    const p = new Point(1, 2);
    const sp = new SegmentPoint(p, 'anchor', 0);
    // @ts-expect-error
    expect(() => { sp.type = 'handleOut'; }).toThrow();
    // @ts-expect-error
    expect(() => { sp.segmentIndex = 5; }).toThrow();
  });
});