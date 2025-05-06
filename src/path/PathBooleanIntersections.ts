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
    // eslint-disable-next-line
    var results: CurveLocation[] | undefined = include && [],
        tMin = /*#=*/Numerical.CURVETIME_EPSILON,
        tMax = 1 - tMin,
        clearHandles = false,
        clearCurves = clearLater || [],
        clearLookup = clearLater && {},
        renormalizeLocs,
        prevCurve,
        prevTime;

    function getId(curve) {
        return curve._path._id + '.' + curve._segment1._index;
    }

    if (clearLater) {
        for (let i = clearLater.length - 1; i >= 0; i--) {
            const curve = clearLater[i];
            if (curve._path)
                clearLookup![getId(curve)] = true;
        }
    }

    for (var i = locations.length - 1; i >= 0; i--) {
        var loc = locations[i],
            time = loc._time!,
            origTime = time,
            exclude = include && !include(loc),
            curve = loc._curve!,
            segment;
        if (curve) {
            if (curve !== prevCurve) {
                clearHandles = !curve.hasHandles()
                        || clearLookup && clearLookup[getId(curve)];
                renormalizeLocs = [];
                prevTime = null;
                prevCurve = curve;
            } else if (prevTime >= tMin) {
                time /= prevTime;
            }
        }
        if (exclude) {
            if (renormalizeLocs)
                renormalizeLocs.push(loc);
            continue;
        } else if (include) {
            results!.unshift(loc);
        }
        prevTime = origTime;
        if (time < tMin) {
            segment = curve._segment1;
        } else if (time > tMax) {
            segment = curve._segment2;
        } else {
            var newCurve = curve.divideAtTime(time, true)!;
            if (clearHandles)
                clearCurves.push(curve, newCurve);
            segment = newCurve._segment1;
            for (var j = renormalizeLocs.length - 1; j >= 0; j--) {
                var l = renormalizeLocs[j];
                l._time = (l._time - time) / (1 - time);
            }
        }
        loc._setSegment(segment);
        var inter = segment._intersection,
            dest = loc._intersection;
        if (inter) {
            linkIntersections(inter, dest!);
            var other = inter;
            while (other) {
                linkIntersections(other._intersection, inter);
                other = other._next;
            }
        } else {
            segment._intersection = dest;
        }
    }
    if (!clearLater)
        clearCurveHandles(clearCurves);
    return results || locations;
}

/**
 * 交点でパスを分割
 * paper.jsのdivideLocations関数を使用した実装
 */
export function dividePathAtIntersections(path: Path, locations: CurveLocation[]): Segment[] {
    // paper.jsと同じく、divideLocationsで分割した後の全セグメントを返す
    divideLocations(locations);
    return path.getSegments();
}

/**
 * 交点情報をリンクリストとして連結する
 * paper.jsのlinkIntersections関数と完全に同じ実装
 */
export function linkIntersections(from: CurveLocation, to: CurveLocation): void {
    // --- paper.js PathItem.Boolean.js linkIntersections そのまま移植 ---
    var prev: CurveLocation | null = from;
    while (prev) {
        if (prev === to)
            return;
        prev = prev._previous;
    }
    while (from._next && from._next !== to)
        from = from._next;
    if (!from._next) {
        while (to._previous)
            to = to._previous;
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