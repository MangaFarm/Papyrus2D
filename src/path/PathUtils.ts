import { Path } from './Path';
import { Segment } from './Segment';
import { Point } from '../basic/Point';
import { CurveLocation } from './CurveLocation';
import { Numerical } from '../util/Numerical';
import { PathFlattener } from './PathFlattener';
import { PathFitter } from './PathFitter';
import { Change } from './ChangeFlag';

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
        throw new Error(
          `Segment ${(segment as unknown as { _index: number })._index} of another path cannot be used as a parameter`
        );
      }
      return (segment as unknown as { _index: number })._index;
    } else {
      const index = typeof value === 'number' ? value : _default;
      return Math.min(
        index < 0 && closed ? index % length : index < 0 ? index + length : index,
        length - 1
      );
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
        segment.setHandleOut(new Point(hx, hy));
      }

      if (loop || i > paddingLeft) {
        segment.setHandleIn(new Point(-hx, -hy));
      }
    }
  } else {
    for (let i = from; i <= to; i++) {
      segments[i < 0 ? i + length : i].smooth(opts, !loop && i === from, !loop && i === to);
    }
  }

  return path;
}

/**
 * Pathの分割ロジック（Path.splitAtのロジックを移植）
 */
export function splitPathAt(path: Path, location: CurveLocation): Path | null {
  // NOTE: getLocationAt() handles both offset and location:
  var loc = location,
    index = loc && loc.getIndex(),
    time = loc && loc.getTime()!,
    tMin = /*#=*/ Numerical.CURVETIME_EPSILON,
    tMax = 1 - tMin;
  if (time > tMax) {
    // time == 1 is the same location as time == 0 and index++
    index++;
    time = 0;
  }
  var curves = path.getCurves();
  if (index >= 0 && index < curves.length) {
    // Only divide curves if we're not on an existing segment already.
    if (time >= tMin) {
      // Divide the curve with the index at the given curve-time.
      // Increase because dividing adds more segments to the path.
      curves[index++].divideAtTime(time, false);
    }
    // Create the new path with the segments to the right of given
    // curve-time, which are removed from the current path. Pass true
    // for includeCurves, since we want to preserve and move them to
    // the new path through _add(), allowing us to have CurveLocation
    // keep the connection to the new path through moved curves.
    var segs = path.removeSegments(index, path._segments.length, true);
    let resultPath: Path;
    if (path._closed) {
      path.setClosed(false);
      resultPath = path;
    } else {
      resultPath = new Path();
      resultPath.insertAbove(path);
      resultPath.copyAttributes(path);
    }
    resultPath._add(segs, 0);
    path.addSegment(segs[0]);
    return resultPath;
  }
  return null;
}

export function flattenPath(path: Path, flatness: number = 0.25): Path {
  // PathFlattenerを使用して曲線を直線セグメントに分割
  const flattener = new PathFlattener(path, flatness || 0.25, 256, true);
  const parts = flattener.parts;
  const length = parts.length;
  const segments: Segment[] = [];

  // 各部分から新しいセグメントを作成
  for (let i = 0; i < length; i++) {
    segments.push(new Segment(new Point(parts[i].curve[0], parts[i].curve[1])));
  }

  // 開いたパスで長さが0より大きい場合、最後の曲線の終点を追加
  if (!path._closed && length > 0) {
    segments.push(new Segment(new Point(parts[length - 1].curve[6], parts[length - 1].curve[7])));
  }

  // 新しいセグメントでパスを更新
  path.setSegments(segments);
  return path;
}

export function simplifyPath(path: Path, tolerance: number): boolean {
  // PathFitterを使用してパスを単純化
  const segments = new PathFitter(path).fit(tolerance);

  // 単純化に成功した場合、新しいセグメントをパスに設定
  if (segments) {
    path.setSegments(segments);
  }

  return !!segments;
}

export function reversePath(path: Path): Path {
  path._segments.reverse();
  // ハンドルを反転
  for (let i = 0, l = path._segments.length; i < l; i++) {
    const segment = path._segments[i];
    const handleIn = segment._handleIn;
    segment._handleIn = segment._handleOut;
    segment._handleOut = handleIn;
    segment._index = i;
  }
  // カーブのキャッシュをクリア
  path._curves = null;
  path._changed(Change.GEOMETRY);
  return path;
}

export function comparePath(path1: Path, path2: Path): boolean {
  // 境界ボックスの一致判定
  const bounds1 = path1.getBounds(null, {});
  const bounds2 = path2.getBounds(null, {});
  if (!bounds1.equals(bounds2)) return false;

  // セグメント数の一致
  if (path1._segments.length !== path2._segments.length) return false;

  // セグメント座標・ハンドルの一致
  for (let i = 0; i < path1._segments.length; i++) {
    if (!path1._segments[i].equals(path2._segments[i])) {
      return false;
    }
  }

  // パスの方向（isClockwise）の一致
  if (path1.isClockwise() !== path2.isClockwise()) return false;

  // 面積の一致（符号も含めて）
  if (path1.getArea() !== path2.getArea()) return false;

  // ここまで一致すれば幾何学的に等しいとみなす
  return true;
}

export function equalPath(path1: Path, path2: Path): boolean {
  if (!path2 || path2._segments.length !== path1._segments.length) {
    return false;
  }

  for (let i = 0, l = path1._segments.length; i < l; i++) {
    if (!path1._segments[i].equals(path2._segments[i])) {
      return false;
    }
  }

  return true;
}
