import { describe, it } from 'vitest';
import { Path } from '../src/path/Path';
import { Point } from '../src/basic/Point';
import { Segment } from '../src/path/Segment';
import { tracePaths } from '../src/path/PathBooleanTracePaths';
import { getMeta } from '../src/path/SegmentMeta';

describe('🔥 PathBooleanTracePaths debug', () => {
  it('🔥 should debug isValid for open path with resolve', () => {
    // 開いたパスを作成
    const openPath = new Path([
      new Segment(new Point(0, 0)),
      new Segment(new Point(100, 0)),
      new Segment(new Point(100, 100)),
      new Segment(new Point(50, 50))
    ], false);

    // PathBooleanPreparationの流れを模倣
    // まずsegmentsを取得
    const segments = openPath.getSegments();

    // operatorはPathBooleanPreparation.tsのデフォルトを模倣
    // ここでは単純な { 1: true } を使う
    const operator = { 1: true };

  });
});