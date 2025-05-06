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
  // paper.js toPathData完全コピペ＋TypeScript化
  const segments = path.getSegments();
  const length = segments.length;
  if (!length) return '';
  function num(n: number) {
    // paper.jsは小数点以下6桁、末尾の.0は省略
    return Number(n.toFixed(6)).toString();
  }
  function pair(x: number, y: number) {
    return num(x) + ',' + num(y);
  }
  let d = '';
  let first = true;
  let curX = 0, curY = 0, prevX = 0, prevY = 0, inX = 0, inY = 0, outX = 0, outY = 0;
  for (let i = 0; i < length; i++) {
    const seg = segments[i];
    curX = seg.getPoint().x;
    curY = seg.getPoint().y;
    if (first) {
      d += 'M' + pair(curX, curY);
      first = false;
    } else {
      inX = seg.getHandleIn().x + curX;
      inY = seg.getHandleIn().y + curY;
      if (inX === curX && inY === curY && outX === prevX && outY === prevY) {
        // l = relative lineto
        const dx = curX - prevX;
        const dy = curY - prevY;
        // paper.jsは必ずlコマンドで出力
        d += 'l' + pair(dx, dy);
      } else {
        // c = relative curveto
        d += 'c' + pair(outX - prevX, outY - prevY)
          + ' ' + pair(inX - prevX, inY - prevY)
          + ' ' + pair(curX - prevX, curY - prevY);
      }
    }
    prevX = curX;
    prevY = curY;
    outX = seg.getHandleOut().x + curX;
    outY = seg.getHandleOut().y + curY;
  }
  // 閉じたパスの場合、最初のセグメントを再度描画
  if (path.closed && length > 0) {
    const seg = segments[0];
    const pt = seg.getPoint();
    inX = seg.getHandleIn().x + pt.x;
    inY = seg.getHandleIn().y + pt.y;
    if (inX === pt.x && inY === pt.y && outX === prevX && outY === prevY) {
      const dx = pt.x - prevX;
      const dy = pt.y - prevY;
      // paper.jsは必ずlコマンドで出力
      d += 'l' + pair(dx, dy);
    } else {
      d += 'c' + pair(outX - prevX, outY - prevY)
        + ' ' + pair(inX - prevX, inY - prevY)
        + ' ' + pair(pt.x - prevX, pt.y - prevY);
    }
    d += 'z';
  }
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