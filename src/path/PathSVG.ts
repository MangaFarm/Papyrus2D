/**
 * PathSVG.ts
 * SVGパスデータのエンコード/デコード・パース・エクスポート専用ユーティリティ
 * paper.js の Path.js/PathItem.js のSVG変換ロジックをTypeScriptで移植
 */

import { Path } from './Path';
import { Segment } from './Segment';
import { Point } from '../basic/Point';

/**
 * SVGパスデータ文字列を生成
 */
export function toPathData(path: Path, precision: number = 6): string {
  const segments = path.getSegments();
  if (!segments.length) return '';
  let d = '';
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const pt = seg.getPoint();
    if (i === 0) {
      d += `M${pt.x},${pt.y}`;
    } else {
      const prev = segments[i - 1].getPoint();
      const dx = pt.x - prev.x;
      const dy = pt.y - prev.y;
      // ハンドルが全て0なら直線
      const hasHandles =
        (seg.handleIn && !seg.handleIn.isZero()) ||
        (seg.handleOut && !seg.handleOut.isZero());
      if (!hasHandles) {
        if (dx !== 0 && dy === 0) {
          d += `h${dx}`;
        } else if (dx === 0 && dy !== 0) {
          d += `v${dy}`;
        } else {
          d += `L${pt.x},${pt.y}`;
        }
      } else {
        // ハンドル対応は未実装（今後拡張）
        d += `L${pt.x},${pt.y}`;
      }
    }
  }
  if (path.closed) d += 'z';
  return d;
}

/**
 * SVGパスデータ文字列からPathを生成
 * ※最低限 M, L, C, Z, h, v, H, V, z, 複数サブパス対応
 */
export function fromPathData(d: string): Path {
  // サブパス分割
  const subpaths = d.match(/M[^M]+/g);
  if (!subpaths) throw new Error('Invalid SVG path');
  // 複数サブパスは未対応（必要ならCompoundPathで拡張）
  return parseSinglePath(subpaths[0].trim());
}

// 単一サブパス用: M, L, C, Z, h, v, H, V, z のみ対応
function parseSinglePath(d: string): Path {
  const cmdRe = /([MLCZHVmlczhv])([^MLCZHVmlczhv]*)/g;
  let match: RegExpExecArray | null;
  let curr = new Point(0, 0);
  let start = new Point(0, 0);
  const segments: Segment[] = [];
  while ((match = cmdRe.exec(d))) {
    const [_, cmd, params] = match;
    const p = params.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    let i = 0;
    switch (cmd) {
      case 'M':
      case 'm': {
        while (i < p.length) {
          const x = cmd === 'm' ? curr.x + p[i++] : p[i++];
          const y = cmd === 'm' ? curr.y + p[i++] : p[i++];
          curr = new Point(x, y);
          start = curr;
          segments.push(new Segment(curr));
        }
        break;
      }
      case 'L':
      case 'l': {
        while (i < p.length) {
          const x = cmd === 'l' ? curr.x + p[i++] : p[i++];
          const y = cmd === 'l' ? curr.y + p[i++] : p[i++];
          curr = new Point(x, y);
          segments.push(new Segment(curr));
        }
        break;
      }
      case 'H':
      case 'h': {
        while (i < p.length) {
          const x = cmd === 'h' ? curr.x + p[i++] : p[i++];
          curr = new Point(x, curr.y);
          segments.push(new Segment(curr));
        }
        break;
      }
      case 'V':
      case 'v': {
        while (i < p.length) {
          const y = cmd === 'v' ? curr.y + p[i++] : p[i++];
          curr = new Point(curr.x, y);
          segments.push(new Segment(curr));
        }
        break;
      }
      case 'C':
      case 'c': {
        while (i + 5 < p.length) {
          // ハンドル・終点
          const h1 = new Point(cmd === 'c' ? curr.x + p[i++] : p[i++], cmd === 'c' ? curr.y + p[i++] : p[i++]);
          const h2 = new Point(cmd === 'c' ? curr.x + p[i++] : p[i++], cmd === 'c' ? curr.y + p[i++] : p[i++]);
          const pt = new Point(cmd === 'c' ? curr.x + p[i++] : p[i++], cmd === 'c' ? curr.y + p[i++] : p[i++]);
          segments.push(new Segment(pt, h1.subtract(curr), h2.subtract(pt)));
          curr = pt;
        }
        break;
      }
      case 'Z':
      case 'z': {
        curr = start;
        // パスを閉じる
        break;
      }
    }
  }
  return new Path(segments, /[Zz]$/.test(d));
}

/**
 * SVGパスデータからPathを生成（fromSVGのエイリアス）
 */
export function fromSVG(svg: string): Path {
  return fromPathData(svg);
}