import { describe, it, expect } from 'vitest';
import { Path } from '../src/path/Path';
import { getMeta } from '../src/path/SegmentMeta';

describe('PathBooleanResolveCrossings debug', () => {
  it('resolveCrossings winding/isValid trace', () => {
    // 失敗したテストのSVGパス
    const svg = 'M100,300l0,-50l50,-50l-50,0l150,0l-150,0l50,0l-50,0l100,0l-100,0l0,-100l200,0l0,200z';
    const path = Path.fromSVG(svg);
    (path as any).fillRule = 'evenodd';

    // resolveCrossings前のセグメント情報
    const segs = (path as any).getSegments();
    for (let i = 0; i < segs.length; i++) {
      const pt = segs[i].getPoint();
    }

    // resolveCrossings実行
    const resolved = (path as any).resolveCrossings();

    // resolveCrossings後のセグメント情報
    const segs2 = (resolved as any).getSegments();
    for (let i = 0; i < segs2.length; i++) {
      const pt = segs2[i].getPoint();
    }

    // SVGパス出力

    // winding値デバッグ
    for (let i = 0; i < segs2.length; i++) {
      // Papyrus2DではwindingはgetMetaで管理
      const winding = getMeta(segs2[i])._winding || {};
    }

    // 期待値（paper.jsと同じ）
    const expected = 'M100,300v-50l50,-50h-50v-100h200v200h-200z';
    expect((resolved as any).getPathData()).toBe(expected);
  });
});