import { describe, it, expect } from 'vitest';
import { PathConstructors } from '../src/path/PathConstructors';

describe('🔥 PathBoolean.unite debug', () => {
  it('should output pathData for unite of two rectangles (paper.js基礎テストと同条件)', () => {
    const path1 = PathConstructors.Rectangle({
      point: { x: 0, y: 0 },
      size: { width: 200, height: 200 },
    });
    const path2 = PathConstructors.Rectangle({
      point: { x: 50, y: 50 },
      size: { width: 100, height: 100 },
    });
    // eslint-disable-next-line no-console
    console.log('🔥 path1.pathData:', (path1 as any).pathData ?? (path1 + ''));
    // eslint-disable-next-line no-console
    console.log('🔥 path2.pathData:', (path2 as any).pathData ?? (path2 + ''));
    // unite
    const united = (path1 as any).unite(path2);
    // eslint-disable-next-line no-console
    console.log('🔥 unite.pathData:', (united as any).pathData ?? (united + ''));
  });
});