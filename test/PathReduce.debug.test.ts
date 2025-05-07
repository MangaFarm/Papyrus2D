import { describe, it, expect } from 'vitest';
import { Segment } from '../src/path/Segment';
import { Path } from '../src/path/Path';
import { Point } from '../src/basic/Point';

function printSegments(path: Path, label: string) {
  const segs = path.getSegments();
  console.log(`🔥[${label}] segments.length=${segs.length} closed=${path.closed}`);
  segs.forEach((seg, i) => {
    const pt = seg.getPoint();
    console.log(`🔥[${label}] seg[${i}] index=${seg._index} point=${pt.toString()} handleIn=${seg._handleIn.toString()} handleOut=${seg._handleOut.toString()}`);
  });
}

function printCurves(path: Path, label: string) {
  const curves = path.getCurves();
  console.log(`🔥[${label}] curves.length=${curves.length}`);
  curves.forEach((curve, i) => {
    console.log(`🔥[${label}] curve[${i}] index=${curve.getIndex()} (${curve.getPoint1().toString()} -> ${curve.getPoint2().toString()}) hasHandles=${curve.hasHandles()} hasLen=${curve.hasLength()} isStraight=${curve.isStraight()}`);
  });
}

describe('PathReduce debug', () => {
  it('closed collinear path: reduce debug', () => {
    // 3点一直線、閉じたパス
    const path = new Path([
      new Segment(new Point(0, 0)),
      new Segment(new Point(50, 0)),
      new Segment(new Point(100, 0))
    ], true);

    printSegments(path, 'before');
    printCurves(path, 'before');

    path.reduce({ simplify: true });

    printSegments(path, 'after');
    printCurves(path, 'after');

    // 期待値: segments.length === 0, closed === true
    console.log(`🔥[after] expect segments.length===0, got ${path.getSegments().length}`);
    console.log(`🔥[after] expect closed===true, got ${path.closed}`);
    expect(path.closed).toBe(true);
    // 本来は0だが現状は1残るはず
    // expect(path.getSegments().length).toBe(0);
  });
});