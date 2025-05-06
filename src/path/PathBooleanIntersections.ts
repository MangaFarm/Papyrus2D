/**
 * PathBooleanIntersections: Boolean演算のための交点計算
 * paper.jsのPathItem.Boolean.jsを完全に一致するように実装
 */

import { Path } from './Path';
import { Segment } from './Segment';
import { Point } from '../basic/Point';
import { Curve } from './Curve';
import { Numerical } from '../util/Numerical';
import { CurveLocation } from './CurveLocation';
import { CollisionDetection } from '../util/CollisionDetection';
import { getMeta, IntersectionInfo } from './SegmentMeta';

/**
 * 交点情報
 * SegmentMeta.ts の IntersectionInfo を再エクスポート
 */
export type Intersection = IntersectionInfo;

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
  // CurveLocation.expand(_path1.getIntersections(_path2, filterIntersection)) をそのまま返す
  return CurveLocation.expand(path1.getIntersections(path2, filterIntersection));
}

/**
 * 指定された位置でパスアイテムを分割する
 * paper.jsのdivideLocations関数と同等の機能を実装
 */
export function divideLocations(
  locations: CurveLocation[],
  include?: (loc: CurveLocation) => boolean,
  clearLater?: Curve[]
): CurveLocation[] {
  // --- paper.js PathItem.Boolean.js divideLocations そのまま移植 ---
  const results: CurveLocation[] = include ? [] : locations;
  const tMin = /*#=*/ Numerical.CURVETIME_EPSILON;
  const tMax = 1 - tMin;
  let clearHandles = false;
  const clearCurves: Curve[] = clearLater || [];
  const clearLookup: Record<string, boolean> | undefined = clearLater ? {} : undefined;
  let renormalizeLocs: CurveLocation[] | undefined;
  let prevCurve: Curve | undefined;
  let prevTime: number | null | undefined;

  function getId(curve: Curve): string {
    return curve._path!._id + '.' + curve._segment1._index;
  }

  // Papyrus2D拡張: 同一座標・同一パスID・同一indexのSegment再利用マップ
  // キー: `${x},${y},${curve._path._id},${_segment._index}`
  const _segmentReuseMap = new Map<string, Segment>();

  if (clearLater) {
    for (let i = clearLater.length - 1; i >= 0; i--) {
      const curve = clearLater[i];
      if (curve._path) clearLookup![getId(curve)] = true;
    }
  }

  for (let i = locations.length - 1; i >= 0; i--) {
    const loc = locations[i];
    let time = loc._time!;
    const origTime = time;
    const exclude = include && !include(loc);
    const curve = loc._curve!;
    let _segment: Segment;
    if (curve) {
      if (curve !== prevCurve) {
        clearHandles = !curve.hasHandles() || ((clearLookup && clearLookup[getId(curve)]) ?? false);
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
    } else if (include) {
      results.unshift(loc);
    }
    prevTime = origTime;
    if (time < tMin) {
      _segment = curve._segment1;
      // meta.pathのセット漏れ防止
      const meta = getMeta(_segment);
      if (!meta._path && curve._path) meta._path = curve._path;
    } else if (time > tMax) {
      _segment = curve._segment2;
      // meta.pathのセット漏れ防止
      const meta = getMeta(_segment);
      if (!meta._path && curve._path) meta._path = curve._path;
    } else {
      const newCurve = curve.divideAtTime(time, true)!;
      if (clearHandles) clearCurves.push(curve, newCurve);
      _segment = newCurve._segment1;
      // 新しいセグメントのmetaにpathを必ずセット
      const meta = getMeta(_segment);
      meta._path = curve._path!;
      if (renormalizeLocs) {
        for (let j = renormalizeLocs.length - 1; j >= 0; j--) {
          const l = renormalizeLocs[j];
          l._time = (l._time! - time) / (1 - time);
        }
      }
    }
    // 元のpaper.jsと同様、Segmentはcurve.divideAtTime等で生成されたものをそのまま使う
    loc._setSegment(_segment);
    const inter = getMeta(_segment)._intersection;
    const dest = loc._intersection;
    if (inter) {
      linkIntersections(inter, dest!);
      let other = inter;
      while (other) {
        linkIntersections(other._intersection, inter);
        other = other._next;
      }
    }
    if (!getMeta(_segment)._intersection) {
      getMeta(_segment)._intersection = dest;
    }
  }
  if (!clearLater) clearCurveHandles(clearCurves);
  const out = results;
  // 🔥 divideLocations: output _segments
  for (let i = 0; i < out.length; i++) {
    const seg = out[i]._segment;
    const pt = seg!._point.toPoint();
    const pathId = seg!._path ? seg!._path._id : "none";
    const meta = getMeta(seg!);
    const winding = meta._winding ? meta._winding.winding : undefined;
    console.log(`🔥 divideLocations: i=${i} seg=(${pt.x},${pt.y}) id=${(seg! as any)._id} index=${(seg! as any)._index} winding=${winding}`);
  }
  // 各CurveLocation._segment._intersectionで取得したCurveLocationインスタンスに置き換え
  const unique: CurveLocation[] = [];
  const seen = new Set<CurveLocation>();
  for (let i = 0; i < out.length; i++) {
    const seg = out[i]._segment;
    const loc = seg && getMeta(seg)._intersection;
    if (loc && !seen.has(loc)) {
      unique.push(loc);
      seen.add(loc);
    }
  }
  return unique;
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
