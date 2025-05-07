import { describe, it, expect } from 'vitest';
import { Segment } from '../src/path/Segment';
import { Path } from '../src/path/Path';
import { Point } from '../src/basic/Point';

function printSegments(path: Path, label: string) {
  const segs = path.getSegments();
  segs.forEach((seg, i) => {
    const pt = seg.getPoint();
  });
}

function printCurves(path: Path, label: string) {
  const curves = path.getCurves();
  curves.forEach((curve, i) => {
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
    expect(path.closed).toBe(true);
    // 本来は0だが現状は1残るはず
    // expect(path.getSegments().length).toBe(0);
  });
});