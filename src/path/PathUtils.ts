import { Path } from './Path';
import { Segment } from './Segment';
import { Point } from '../basic/Point';
import { ChangeFlag } from './ChangeFlag';
import { CurveLocation } from './CurveLocation';
import { Numerical } from '../util/Numerical';

/**
 * Pathのセグメントを滑らかにする関数（Path.smoothのロジックを移植）
 */
export function smoothPath(
  path: Path,
  options?: {
    type?: 'asymmetric' | 'continuous';
    from?: number | Segment;
    to?: number | Segment;
  }
): Path {
  const that = path;
  const opts = options || {};
  const type = opts.type || 'asymmetric';
  // paper.jsの実装に合わせて、_segments, _closedはPath型にprivateで持っている前提で型アサーション
  const segments = (path as unknown as { _segments: Segment[] })._segments;
  const length = segments.length;
  const closed = (path as unknown as { _closed: boolean })._closed;

  function getIndex(value: number | Segment | undefined, _default: number): number {
    if (value && (value as Segment).point) {
      const segment = value as Segment;
      // paper.jsの実装に合わせて、_path, _indexはSegment型にprivateで持っている前提で型アサーション
      const segPath = (segment as unknown as { _path: Path })._path;
      if (segPath && segPath !== that) {
        throw new Error(`Segment ${(segment as unknown as { _index: number })._index} of another path cannot be used as a parameter`);
      }
      return (segment as unknown as { _index: number })._index;
    } else {
      const index = typeof value === 'number' ? value : _default;
      return Math.min(index < 0 && closed
        ? index % length
        : index < 0 ? index + length : index, length - 1);
    }
  }

  const loop = closed && opts.from === undefined && opts.to === undefined;
  let from = getIndex(opts.from, 0);
  let to = getIndex(opts.to, length - 1);

  if (from > to) {
    if (closed) {
      from -= length;
    } else {
      const tmp = from;
      from = to;
      to = tmp;
    }
  }

  if (/^(?:asymmetric|continuous)$/.test(type)) {
    const asymmetric = type === 'asymmetric';
    const min = Math.min;
    const amount = to - from + 1;
    let n = amount - 1;

    const padding = loop ? min(amount, 4) : 1;
    let paddingLeft = padding;
    let paddingRight = padding;
    const knots: Point[] = [];

    if (!closed) {
      paddingLeft = min(1, from);
      paddingRight = min(1, length - to - 1);
    }

    n += paddingLeft + paddingRight;
    if (n <= 1) return path;

    for (let i = 0, j = from - paddingLeft; i <= n; i++, j++) {
      knots[i] = segments[(j < 0 ? j + length : j) % length].point;
    }

    const x = knots[0].x + 2 * knots[1].x;
    const y = knots[0].y + 2 * knots[1].y;
    let f = 2;
    const n_1 = n - 1;
    const rx: number[] = [x];
    const ry: number[] = [y];
    const rf: number[] = [f];
    const px: number[] = [];
    const py: number[] = [];

    for (let i = 1; i < n; i++) {
      const internal = i < n_1;
      const a = internal ? 1 : asymmetric ? 1 : 2;
      const b = internal ? 4 : asymmetric ? 2 : 7;
      const u = internal ? 4 : asymmetric ? 3 : 8;
      const v = internal ? 2 : asymmetric ? 0 : 1;
      const m = a / f;
      f = rf[i] = b - m;
      const knotX = knots[i].x;
      const knotY = knots[i].y;
      const nextKnotX = knots[i + 1]?.x || 0;
      const nextKnotY = knots[i + 1]?.y || 0;
      rx[i] = u * knotX + v * nextKnotX - m * x;
      ry[i] = u * knotY + v * nextKnotY - m * y;
    }

    px[n_1] = rx[n_1] / rf[n_1];
    py[n_1] = ry[n_1] / rf[n_1];

    for (let i = n - 2; i >= 0; i--) {
      px[i] = (rx[i] - px[i + 1]) / rf[i];
      py[i] = (ry[i] - py[i + 1]) / rf[i];
    }

    px[n] = (3 * knots[n].x - px[n_1]) / 2;
    py[n] = (3 * knots[n].y - py[n_1]) / 2;

    for (let i = paddingLeft, max = n - paddingRight, j = from; i <= max; i++, j++) {
      const segment = segments[j < 0 ? j + length : j];
      const pt = segment.point;
      const hx = px[i] - pt.x;
      const hy = py[i] - pt.y;

      if (loop || i < max) {
        segment.setHandleOut([hx, hy]);
      }

      if (loop || i > paddingLeft) {
        segment.setHandleIn([-hx, -hy]);
      }
    }
  } else {
    for (let i = from; i <= to; i++) {
      segments[i < 0 ? i + length : i].smooth(opts,
        !loop && i === from, !loop && i === to);
    }
  }

  return path;
}

/**
 * Pathの分割ロジック（Path.splitAtのロジックを移植）
 */
export function splitPathAt(path: Path, location: number | CurveLocation): Path | null {
  let loc: CurveLocation | null;
  if (typeof location === 'number') {
    loc = path.getLocationAt(location);
  } else {
    loc = location;
  }

  if (!loc) {
    return null;
  }

  if (!loc.getCurve()) {
    return null;
  }

  if (loc.getPath() !== path) {
    return null;
  }

  const index = loc.getIndex();
  const time = loc.getTime() ?? 0;
  const tMin = Numerical.CURVETIME_EPSILON;
  const tMax = 1 - tMin;

  let curveIndex = index;
  let curveTime = time;
  if (curveTime > tMax) {
    curveIndex++;
    curveTime = 0;
  }

  const curves = path.getCurves();
  if (curveIndex >= 0 && curveIndex < curves.length) {
    if (curveTime >= tMin) {
      curves[curveIndex].divideAtTime(curveTime);
      curveIndex++;
    }

    const segs = path.removeSegments(curveIndex, (path as unknown as { _segments: Segment[] })._segments.length);

    let path2;
    if ((path as unknown as { _closed: boolean })._closed) {
      path.setClosed(false);
      path2 = path;
    } else {
      path2 = new Path();
      // path2.copyAttributes(path); // Papyrus2Dには未実装かも
      path.add(segs[0]);
    }

    for (let i = 0; i < segs.length; i++) {
      path2.add(segs[i]);
    }

    (path as unknown as { _length: undefined })._length = undefined;
    (path2 as unknown as { _length: undefined })._length = undefined;
    path.getCurves();
    path2.getCurves();

    return path2;
  }

  return null;
}