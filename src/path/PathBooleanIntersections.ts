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
): Segment[] {
    // paper.js PathItem.Boolean.js: divideLocations
    const results = include ? [] as Segment[] : undefined;
    const tMin = Numerical.CURVETIME_EPSILON;
    const tMax = 1 - tMin;
    let clearHandles = false;
    const clearCurves = clearLater || [];
    const clearLookup = clearLater ? {} as Record<string, boolean> : undefined;
    let renormalizeLocs: CurveLocation[] = [];
    let prevCurve: Curve | undefined;
    let prevTime: number | undefined;

    function getId(curve: Curve) {
        return curve._path._id + '.' + curve._segment1._index;
    }

    if (clearLater && clearLookup) {
        for (let i = clearLater.length - 1; i >= 0; i--) {
            const curve = clearLater[i];
            if (curve._path)
                clearLookup[getId(curve)] = true;
        }
    }

    for (let i = locations.length - 1; i >= 0; i--) {
        const loc = locations[i];
        let time = (loc as any)._time;
        const origTime = time;
        const exclude = include && !include(loc);
        const curve = (loc as any)._curve as Curve | undefined;
        let segment: Segment | undefined;

        if (curve) {
            if (curve !== prevCurve) {
                clearHandles = !curve.hasHandles() || !!(clearLookup && clearLookup[getId(curve)]);
                renormalizeLocs = [];
                prevTime = undefined;
                prevCurve = curve;
            } else if (prevTime !== undefined && prevTime >= tMin) {
                time /= prevTime;
            }
        }
        if (exclude) {
            if (renormalizeLocs)
                renormalizeLocs.push(loc);
            continue;
        } else if (include && results) {
            if (results && segment) results.unshift(segment);
        }
        prevTime = origTime;
        if (time < tMin) {
            segment = (curve as any)._segment1;
        } else if (time > tMax) {
            segment = (curve as any)._segment2;
        } else {
            const newCurve = (curve as any).divideAtTime(time, true);
            if (!newCurve) {
                // paper.jsではnull判定せず!を使うので合わせる
                segment = (newCurve! as any)._segment1;
            } else {
                if (clearHandles)
                    clearCurves.push(curve!, newCurve!);
                segment = newCurve._segment1;
                for (let j = renormalizeLocs.length - 1; j >= 0; j--) {
                    const l = renormalizeLocs[j];
                    (l as any)._time = ((l as any)._time - time) / (1 - time);
                }
            }
        }
        (loc as any)._setSegment(segment);
        const inter = (segment as any)._intersection;
        const dest = (loc as any)._intersection;
        if (inter) {
            linkIntersections(inter, dest);
            let other = inter;
            while (other) {
                linkIntersections((other as any)._intersection, inter);
                other = (other as any)._next;
            }
            // segmentがSegment型でない場合は即例外
            if (!(segment instanceof Segment)) {
                throw new Error(`[Papyrus2D AssertionError] divideLocations: segment is not a valid Segment at i=${i}, segment=${segment}`);
            }
        } else {
            (segment as any)._intersection = dest;
        }
    }
    if (!clearLater)
        clearCurveHandles(clearCurves);
    // Segment型のみ返す
    let arr: any[];
    if (results) {
        arr = results;
    } else {
        // paper.js同様、locationsから_segmentを抽出
        arr = locations.map(l => (l as any)._segment);
    }
    // Segment型インスタンスのみ返す
    const filtered = arr.filter(seg => seg instanceof Segment);
    return filtered;
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
export function linkIntersections(from: Intersection, to: Intersection): void {
    // paper.js PathItem.Boolean.js: linkIntersections
    // Only create the link if it's not already in the existing chain, to
    // avoid endless recursions. First walk to the beginning of the chain,
    // and abort if we find `to`.
    let prev: any = from;
    while (prev) {
        if (prev === to)
            return;
        prev = prev._previous;
    }
    // Now walk to the end of the existing chain to find an empty spot, but
    // stop if we find `to`, to avoid adding it again.
    while ((from as any)._next && (from as any)._next !== to)
        from = (from as any)._next;
    // If we're reached the end of the list, we can add it.
    if (!(from as any)._next) {
        // Go back to beginning of the other chain, and link the two up.
        while ((to as any)._previous)
            to = (to as any)._previous;
        (from as any)._next = to;
        (to as any)._previous = from;
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