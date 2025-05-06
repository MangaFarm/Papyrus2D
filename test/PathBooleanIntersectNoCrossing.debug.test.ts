// Papyrus2D: Boolean演算のwinding分布デバッグ用
import { describe, it, expect } from 'vitest';
import { Path } from '../src/path/Path';
import { PathConstructors } from '../src/path/PathConstructors';
import { PathBoolean } from '../src/path/PathBoolean';
import { reorientPaths } from '../src/path/PathBooleanReorient';

describe('🔥 PathBoolean intersect no crossing debug', () => {
  it('矩形同士のintersectでreorientPathsのwinding分布を出力', () => {
    const path1 = PathConstructors.Rectangle({
      point: { x: 0, y: 0 },
      size: { width: 200, height: 200 },
    });
    const path2 = PathConstructors.Rectangle({
      point: { x: 50, y: 50 },
      size: { width: 100, height: 100 },
    });

    // 交点なしのintersect時の内部ロジックを直接呼び出す
    const operator = { '2': true, intersect: true };
    const paths = [path1, path2];
    const result = reorientPaths(paths, (w) => !!operator[w]);

    // winding分布を🔥出力
    for (const p of paths) {
      if (!p) continue;
      // @ts-ignore
      const id = p._id;
      // @ts-ignore
      const area = p.getArea();
      // @ts-ignore
      const clockwise = p.isClockwise();
      // @ts-ignore
      const segs = p.getSegments().length;
      // @ts-ignore
      const bounds = p.getBounds();
      // @ts-ignore
      const pathData = p.getPathData ? p.getPathData() : '';
      // @ts-ignore
      console.log(`🔥 id=${id} area=${area} cw=${clockwise} segs=${segs} bounds=${bounds} pathData=${pathData}`);
    }
    // 結果のパスデータも出力
    for (const p of result) {
      if (!p) continue;
      // @ts-ignore
      const pathData = p.getPathData ? p.getPathData() : '';
      console.log('🔥 result pathData:', pathData);
    }
    // テスト自体は常に通す
    expect(true).toBe(true);
  });
});