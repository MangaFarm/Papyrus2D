import { describe, it, expect } from 'vitest';
import { Path } from '../src/path/Path';
import { Point } from '../src/basic/Point';
import { PathBoolean } from '../src/path/PathBoolean';
import { Segment } from '../src/path/Segment';

// 1点だけ共有する2つの矩形
describe('PathBoolean Debug: minimal intersection cases', () => {
  it('unite: rectangles sharing only one point', () => {
    // 矩形A: (0,0)-(50,0)-(50,50)-(0,50)
    const rectA = new Path([
      new Segment(new Point(0, 0)),
      new Segment(new Point(50, 0)),
      new Segment(new Point(50, 50)),
      new Segment(new Point(0, 50))
    ], true);

    // 矩形B: (50,50)-(100,50)-(100,100)-(50,100)
    const rectB = new Path([
      new Segment(new Point(50, 50)),
      new Segment(new Point(100, 50)),
      new Segment(new Point(100, 100)),
      new Segment(new Point(50, 100))
    ], true);

    const result = PathBoolean.unite(rectA, rectB);
    expect(result).toBeDefined();

    // デバッグ出力
    const segments = result.getSegments();
    console.log('🔥 unite: rectangles sharing one point');
    segments.forEach((seg, i) => {
      const pt = seg.getPoint();
      console.log(`🔥 seg[${i}]: (${pt.x},${pt.y})`);
    });

    // パス数・座標列を確認
    if ((result as any)._children) {
      const children = (result as any)._children;
      console.log('🔥 unite: children count', children.length);
      children.forEach((child: any, idx: number) => {
        const segs = child.getSegments();
        console.log(`🔥 child[${idx}] segs:`, segs.map((s: any) => `(${s.getPoint().x},${s.getPoint().y})`).join(' -> '));
      });
    } else {
      console.log('🔥 unite: single path');
    }
    // 期待値: 2つの矩形が1点だけ共有している場合、uniteは2つのサブパスになるはず
    // ただしpaper.jsの仕様により1つになる場合もあるので、まずは出力観察
  });
});
import { getIntersections, divideLocations } from '../src/path/PathBooleanIntersections';
import { Curve } from '../src/path/Curve';

// getIntersections: 2本の直線が1点で交わる場合
describe('PathBoolean Debug: getIntersections', () => {
  it('should find intersection of two crossing lines', () => {
    // 線分A: (0,0)-(100,100)
    const segA1 = new Segment(new Point(0, 0));
    const segA2 = new Segment(new Point(100, 100));
    const pathA = new Path([segA1, segA2], false);

    // 線分B: (0,100)-(100,0)
    const segB1 = new Segment(new Point(0, 100));
    const segB2 = new Segment(new Point(100, 0));
    const pathB = new Path([segB1, segB2], false);

    const intersections = getIntersections(pathA, pathB);
    console.log('🔥 getIntersections: count', intersections.length);
    intersections.forEach((loc, i) => {
      const pt = loc._point;
      console.log(`🔥 intersection[${i}]: (${pt.x},${pt.y})`);
    });
    expect(intersections.length).toBe(2);
    intersections.forEach((loc) => {
      expect(Math.abs(loc._point.x - 50)).toBeLessThan(1e-6);
      expect(Math.abs(loc._point.y - 50)).toBeLessThan(1e-6);
    });
  });
});
// divideLocations: 交点1つのときの分割・リンク構造
describe('PathBoolean Debug: divideLocations', () => {
  it('should divide at a single intersection and link both sides', () => {
    // 線分A: (0,0)-(100,100)
    const segA1 = new Segment(new Point(0, 0));
    const segA2 = new Segment(new Point(100, 100));
    const pathA = new Path([segA1, segA2], false);

    // 線分B: (0,100)-(100,0)
    const segB1 = new Segment(new Point(0, 100));
    const segB2 = new Segment(new Point(100, 0));
    const pathB = new Path([segB1, segB2], false);

    const intersections = getIntersections(pathA, pathB);
    // divideLocationsを呼ぶ
    const divided = divideLocations(intersections);

    console.log('🔥 divideLocations: count', divided.length);
    divided.forEach((loc, i) => {
      const pt = loc._point;
      const seg = loc._segment;
      const inter = loc._intersection;
      console.log(`🔥 divided[${i}]: (${pt.x},${pt.y}) seg=(${seg?._point.x},${seg?._point.y}) inter=(${inter?._point.x},${inter?._point.y})`);
    });

    // 交点の両側が正しくリンクされているか
    expect(divided.length).toBe(2);
    expect(divided[0]._intersection).toBe(divided[1]);
    expect(divided[1]._intersection).toBe(divided[0]);
  });
});
describe('PathBoolean Debug: divideLocations type check', () => {
  it('should print types of divideLocations output', () => {
    // 線分A: (0,0)-(100,100)
    const segA1 = new Segment(new Point(0, 0));
    const segA2 = new Segment(new Point(100, 100));
    const pathA = new Path([segA1, segA2], false);

    // 線分B: (0,100)-(100,0)
    const segB1 = new Segment(new Point(0, 100));
    const segB2 = new Segment(new Point(100, 0));
    const pathB = new Path([segB1, segB2], false);

    const intersections = getIntersections(pathA, pathB);
    const divided = divideLocations(intersections);

    divided.forEach((loc, i) => {
      console.log(`🔥 divided[${i}] type:`, typeof loc, loc && loc.constructor && loc.constructor.name);
    });
  });
});
describe('PathBoolean Debug: divideLocations output details', () => {
  it('should print all properties of divideLocations output', () => {
    // 線分A: (0,0)-(100,100)
    const segA1 = new Segment(new Point(0, 0));
    const segA2 = new Segment(new Point(100, 100));
    const pathA = new Path([segA1, segA2], false);

    // 線分B: (0,100)-(100,0)
    const segB1 = new Segment(new Point(0, 100));
    const segB2 = new Segment(new Point(100, 0));
    const pathB = new Path([segB1, segB2], false);

    const intersections = getIntersections(pathA, pathB);
    const divided = divideLocations(intersections);

    divided.forEach((loc, i) => {
      console.log(`🔥 divided[${i}] type:`, typeof loc, loc && loc.constructor && loc.constructor.name);
      console.log(`🔥 divided[${i}] _point:`, loc._point);
      console.log(`🔥 divided[${i}] _segment:`, loc._segment);
      console.log(`🔥 divided[${i}] _intersection:`, loc._intersection);
    });
  });
});
// tracePaths: 単一交点・単一セグメント列でのパス生成挙動
import { tracePaths } from '../src/path/PathBooleanTracePaths';

describe('PathBoolean Debug: tracePaths minimal', () => {
  it('should trace paths from divided segments (single intersection)', () => {
    // 線分A: (0,0)-(100,100)
    const segA1 = new Segment(new Point(0, 0));
    const segA2 = new Segment(new Point(100, 100));
    const pathA = new Path([segA1, segA2], false);

    // 線分B: (0,100)-(100,0)
    const segB1 = new Segment(new Point(0, 100));
    const segB2 = new Segment(new Point(100, 0));
    const pathB = new Path([segB1, segB2], false);

    const intersections = getIntersections(pathA, pathB);
    const divided = divideLocations(intersections);

    // operator: 全てtrue（unite相当）
    const operator = { '1': true, '2': true, unite: true };

    // tracePathsに分割後のセグメントを渡す
    const segments = divided.map(loc => loc._segment);
    const paths = tracePaths(segments, operator);

    console.log('🔥 tracePaths: output paths.length =', paths.length);
    paths.forEach((p, i) => {
      const segs = p.getSegments();
      console.log(`🔥 path[${i}] segs:`, segs.map(s => `(${s.getPoint().x},${s.getPoint().y})`).join(' -> '));
    });

    // パス数や座標列を観察
    expect(paths.length).toBeGreaterThan(0);
  });
});
// tracePaths: 交点が2つある場合のパス生成挙動
describe('PathBoolean Debug: tracePaths with two intersections', () => {
  it('should trace paths from divided segments (two intersections)', () => {
    // 線分A: (0,0)-(100,100)
    const segA1 = new Segment(new Point(0, 0));
    const segA2 = new Segment(new Point(100, 100));
    const pathA = new Path([segA1, segA2], false);

    // 線分B: (0,100)-(100,0)
    const segB1 = new Segment(new Point(0, 100));
    const segB2 = new Segment(new Point(100, 0));
    const pathB = new Path([segB1, segB2], false);

    // もう1本交差する線分C: (0,50)-(100,50)
    const segC1 = new Segment(new Point(0, 50));
    const segC2 = new Segment(new Point(100, 50));
    const pathC = new Path([segC1, segC2], false);

    // AとC, BとCの交点を取得
    const intersectionsAC = getIntersections(pathA, pathC);
    const intersectionsBC = getIntersections(pathB, pathC);

    // すべての交点をまとめてdivideLocations
    const divided = divideLocations([...intersectionsAC, ...intersectionsBC]);

    // 全セグメントにwindingを仮セット
    divided.forEach(loc => {
      const meta = getMeta(loc._segment);
      if (meta) meta.winding = { winding: 1 };
    });

    // operator: 全てtrue（unite相当）
    const operator = { '1': true, '2': true, unite: true };

    // tracePathsに分割後のセグメントを渡す
    const segments = divided.map(loc => loc._segment);
    const paths = tracePaths(segments, operator);

    console.log('🔥 tracePaths (two intersections): output paths.length =', paths.length);
    paths.forEach((p, i) => {
      const segs = p.getSegments();
      console.log(`🔥 path[${i}] segs:`, segs.map(s => `(${s.getPoint().x},${s.getPoint().y})`).join(' -> '));
    });

    // パス数や座標列を観察
    expect(paths.length).toBeGreaterThanOrEqual(0);
  });
});
import { getMeta } from '../src/path/SegmentMeta';

describe('PathBoolean Debug: tracePaths with manual winding', () => {
  it('should trace paths if winding is set manually', () => {
    // 線分A: (0,0)-(100,100)
    const segA1 = new Segment(new Point(0, 0));
    const segA2 = new Segment(new Point(100, 100));
    const pathA = new Path([segA1, segA2], false);

    // 線分B: (0,100)-(100,0)
    const segB1 = new Segment(new Point(0, 100));
    const segB2 = new Segment(new Point(100, 0));
    const pathB = new Path([segB1, segB2], false);

    // もう1本交差する線分C: (0,50)-(100,50)
    const segC1 = new Segment(new Point(0, 50));
    const segC2 = new Segment(new Point(100, 50));
    const pathC = new Path([segC1, segC2], false);

    // AとC, BとCの交点を取得
    const intersectionsAC = getIntersections(pathA, pathC);
    const intersectionsBC = getIntersections(pathB, pathC);

    // すべての交点をまとめてdivideLocations
    const divided = divideLocations([...intersectionsAC, ...intersectionsBC]);

    // 各セグメントにwindingを仮セット
    divided.forEach(loc => {
      const meta = getMeta(loc._segment);
      if (meta) meta.winding = { winding: 1 };
    });
    // 元のパスの全セグメントにもwindingをセット
    [pathA, pathB, pathC].forEach(path => {
      path.getSegments().forEach(seg => {
        const meta = getMeta(seg);
        if (meta) meta.winding = { winding: 1 };
      });
    });

    // operator: 全てtrue（unite相当）
    const operator = { '1': true, '2': true, unite: true };

    // tracePathsに分割後のセグメント＋元のパスの全セグメントを渡す
    const allSegments = [
      ...divided.map(loc => loc._segment),
      ...pathA.getSegments(),
      ...pathB.getSegments(),
      ...pathC.getSegments()
    ];
    const paths = tracePaths(allSegments, operator);

    console.log('🔥 tracePaths (manual winding): output paths.length =', paths.length);
    paths.forEach((p, i) => {
      const segs = p.getSegments();
      console.log(`🔥 path[${i}] segs:`, segs.map(s => `(${s.getPoint().x},${s.getPoint().y})`).join(' -> '));
    });

    // パス数や座標列を観察
    expect(paths.length).toBeGreaterThanOrEqual(0);
  });
});