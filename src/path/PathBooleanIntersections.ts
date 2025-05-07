/**
 * PathBooleanIntersections: Boolean演算のための交点計算
 * paper.jsのPathItem.Boolean.jsを完全に一致するように実装
 */

import { Path } from './Path';
import { Segment } from './Segment';
import { Curve } from './Curve';
import { Numerical } from '../util/Numerical';
import { CurveLocation } from './CurveLocation';
import { getMeta } from './SegmentMeta';

/**
 * 交差点と重なりを区別するフィルター関数
 * paper.jsのfilterIntersection関数と完全に同じ
 */
export function filterIntersection(inter: CurveLocation): boolean {
  // TODO: Change isCrossing() to also handle overlaps (hasOverlap())
  // that are actually involved in a crossing! For this we need proper
  // overlap range detection / merging first... But as we call
  // #resolveCrossings() first in boolean operations, removing all
  // self-touching areas in paths, this works for the known use cases.
  // The ideal implementation would deal with it in a way outlined in:
  // https://github.com/paperjs/paper.js/issues/874#issuecomment-168332391
  return inter.hasOverlap() || inter.isCrossing();
}

/**
 * 2つのパスの交点を計算
 * paper.jsのCurveLocation.expand()を使用した実装に合わせる
 */
export function getIntersections(path1: Path, path2: Path): CurveLocation[] {
  // 🔥 デバッグ: 入力パスのSVG、getIntersectionsの生戻り値、expand後の戻り値
  // @ts-ignore
  const path1data = path1.getPathData ? path1.getPathData() : '';
  // @ts-ignore
  const path2data = path2.getPathData ? path2.getPathData() : '';
  const raw = path1.getIntersections(path2, filterIntersection);
  const expanded = CurveLocation.expand(raw);
  // @ts-ignore
  return expanded;
}

/**
 * 指定された位置でパスアイテムを分割する
 * paper.jsのdivideLocations関数と同等の機能を実装
 */
/**
 * 指定された位置でパスアイテムを分割する
 * paper.jsのPathItem.Boolean.js divideLocationsに忠実な実装
 * locations: 分割点（CurveLocation）の配列
 * include: 分割点をフィルタする関数（省略可）
 * 戻り値: 分割後のCurveLocation配列
 */
export function divideLocations(
  locations: CurveLocation[],
  include?: (loc: CurveLocation) => boolean,
  clearLater?: Curve[]
): CurveLocation[] {
  const results: CurveLocation[] | undefined = include ? [] : undefined;
  const tMin = Numerical.CURVETIME_EPSILON;
  const tMax = 1 - tMin;
  let clearHandles = false;
  const clearCurves: Curve[] = clearLater || [];
  const clearLookup: Record<string, boolean> | undefined = clearLater ? {} : undefined;
  let renormalizeLocs: CurveLocation[] = [];
  let prevCurve: Curve | undefined;
  let prevTime: number | null | undefined;

  function getId(curve: Curve): string {
    return curve._path!._id + '.' + curve._segment1._index;
  }

  if (clearLater && clearLookup) {
    for (let i = clearLater.length - 1; i >= 0; i--) {
      const curve = clearLater[i];
      if (curve._path) clearLookup[getId(curve)] = true;
    }
  }

  for (let i = locations.length - 1; i >= 0; i--) {
    const loc = locations[i];
    let time = loc._time!;
    const origTime = time;
    const exclude = include && !include(loc);
    const curve = loc._curve!;
    let segment: Segment | undefined;
    if (curve) {
      if (curve !== prevCurve) {
        clearHandles = !curve.hasHandles() || !!(clearLookup && clearLookup[getId(curve)]);
        renormalizeLocs = [];
        prevTime = null;
        prevCurve = curve;
      } else if (prevTime !== null && prevTime !== undefined && prevTime >= tMin) {
        time /= prevTime;
      }
    }
    if (exclude) {
      if (renormalizeLocs) renormalizeLocs.push(loc);
      continue;
    } else if (include && results) {
      results.unshift(loc);
    }
    prevTime = origTime;
    if (time < tMin) {
      segment = curve._segment1;
    } else if (time > tMax) {
      segment = curve._segment2;
    } else {
      const newCurve = curve.divideAtTime(time, true)!;
      if (clearHandles) clearCurves.push(curve, newCurve);
      segment = newCurve._segment1;
      for (let j = renormalizeLocs.length - 1; j >= 0; j--) {
        const l = renormalizeLocs[j];
        l._time = (l._time! - time) / (1 - time);
      }
    }
    loc._setSegment(segment!);
    const inter = getMeta(segment)._intersection;
    const dest = loc._intersection;
    if (inter && dest) {
      linkIntersections(inter, dest);
      let other: CurveLocation | null = inter;
      while (other && other._intersection) {
        linkIntersections(other._intersection, inter);
        other = other._next;
      }
    } else if (dest) {
      getMeta(segment)._intersection = dest;
    }
  }
  if (!clearLater) clearCurveHandles(clearCurves);
  return results || locations;
}


/**
 * 交点情報をリンクリストとして連結する
 * paper.jsのlinkIntersections関数と完全に同じ実装
 */
export function linkIntersections(from: CurveLocation, to: CurveLocation): void {
  // --- paper.js PathItem.Boolean.js linkIntersections そのまま移植 ---
  var prev: CurveLocation | null = from;
  while (prev) {
    if (prev === to) return;
    prev = prev._previous;
  }
  while (from._next && from._next !== to) from = from._next;
  if (!from._next) {
    while (to._previous) to = to._previous;
    from._next = to;
    to._previous = from;
  }
}

/**
 * カーブのハンドルをクリア
 * paper.jsのclearCurveHandlesメソッドと完全に同じ実装
 */
export function clearCurveHandles(curves: Curve[]): void {
  // paper.js PathItem.Boolean.js: clearCurveHandles
  for (let i = curves.length - 1; i >= 0; i--) {
    curves[i].clearHandles();
  }
}
