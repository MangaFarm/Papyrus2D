import { describe, it, expect } from 'vitest';
import { Path } from '../src/path/Path';
import { Segment } from '../src/path/Segment';
import { Point } from '../src/basic/Point';
import { tracePaths } from '../src/path/PathBooleanTracePaths';

describe('PathBooleanTracePaths - 1 segment path', () => {
  it('should not remove a path with only 1 segment', () => {
    // 1セグメントだけの閉じたパス
    const seg = new Segment(new Point(0, 0));
    const path = new Path([seg], true);

    // tracePathsに渡す
    const result = tracePaths([seg], {});
    // Papyrus2D現状では空配列になるが、paper.jsでは1セグメントパスも残る
    expect(result.length).toBe(1);
    expect(result[0].getSegments().length).toBe(1);
  });
});