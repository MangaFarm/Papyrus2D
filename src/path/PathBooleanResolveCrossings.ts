/**
 * PathBooleanResolveCrossings: 交差解決のための関数
 * paper.jsのPathItem.Boolean.jsのresolveCrossings関数とその関連関数を移植
 */

import { Path } from './Path';
import { PathItem } from './PathItem';
import { Numerical } from '../util/Numerical';
import { CurveLocation } from './CurveLocation';
import { Segment } from './Segment';
import { Curve } from './Curve';
import { tracePaths } from './PathBooleanTracePaths';
import { getMeta, IntersectionInfo } from './SegmentMeta';
import { CompoundPath } from './CompoundPath';
import { divideLocations, clearCurveHandles } from './PathBooleanIntersections';

/**
 * パスの交差を解決する
 * paper.jsのresolveCrossings関数を移植
 *
 * @param path 交差を解決するパス
 * @returns 交差が解決されたパス
 */
export function resolveCrossings(path: PathItem): PathItem {
  // paper.jsのresolveCrossingsアルゴリズムに完全一致させる

  let paths: Path[] = path instanceof CompoundPath ? path._children : [path as Path];

  function hasOverlap(seg: Segment, path: Path): boolean {
    const meta = getMeta(seg);
    const inter = meta._intersection;
    return !!(inter && inter._overlap && meta!._path === path);
  }

  // 交差点・重なり点の検出とフラグ
  let hasOverlaps = false;
  let hasCrossings = false;
  let intersections = (path as PathItem & {
    getIntersections: (
      arg: null,
      callback: (inter: CurveLocation) => boolean
    ) => CurveLocation[];
  }).getIntersections(null, function(inter: CurveLocation) {
    const isOverlap = inter.hasOverlap();
    const isCrossing = inter.isCrossing();
    return isOverlap && (hasOverlaps = true) ||
           isCrossing && (hasCrossings = true);
  });
  
  // paper.jsと同様にCurveLocation.expandを使用
  intersections = CurveLocation.expand(intersections);

  // 交差点がなければ元のパスを返す
  if (!intersections || intersections.length === 0) {
    return path;
  }

  // 曲線ハンドルクリア用
  const clearCurves = hasOverlaps && hasCrossings ? [] : undefined;

  // 重なり処理
  if (hasOverlaps) {
    const overlaps = divideLocations(intersections, function(inter: CurveLocation) {
      return inter.hasOverlap();
    }, clearCurves);

    for (let i = overlaps.length - 1; i >= 0; i--) {
      const overlap = overlaps[i];
      const path = overlap._path!;
      const seg = overlap._segment!;
      const prev = seg.getPrevious()!;
      const next = seg.getNext()!;
      if (hasOverlap(prev, path) && hasOverlap(next, path)) {
        seg.remove();
        // paper.jsでは new Point(0, 0) などを使うため、Point型で明示
        prev._handleOut._set(0, 0);
        next._handleIn._set(0, 0);
        const prevCurve = prev.getCurve();
        if (prev !== seg) {
          if (!prevCurve) {
            console.log('[resolveCrossings] prev.getCurve() is null', prev, prev?._index, prev?._path);
            // paper.js: do nothing if prevCurve is null
          } else if (typeof prevCurve.hasLength !== 'function') {
            console.log('[resolveCrossings] prev.getCurve() is not Curve', prevCurve, typeof prevCurve, prevCurve && Object.keys(prevCurve));
          } else if (!prevCurve.hasLength()) {
            // prev._handleInはSegmentPoint型
            next._handleIn._set(prev._handleIn.getX(), prev._handleIn.getY());
            prev.remove();
          }
        }
      }
    }
  }

  // 交差処理
  if (hasCrossings) {
    const divideResult = divideLocations(intersections, hasOverlaps ? function(inter: CurveLocation) {
      const curve1 = inter.getCurve();
      const seg1 = inter.getSegment();
      const other = inter._intersection;
      const curve2 = other?._curve;
      const seg2 = other?._segment;
      if (curve1 && curve2 && curve1._path && curve2._path) {
        return true;
      }
      if (seg1) getMeta(seg1)._intersection = null;
      if (seg2) getMeta(seg2)._intersection = null;
      return false;
    } : undefined, clearCurves);

    // デバッグ: divideLocations後のパス情報
    for (const p of paths) {
      console.log('[resolveCrossings] after divideLocations:', p._id, 'segments:', p._segments?.length, 'curves:', p._curves?.length);
    }

    if (clearCurves) {
      clearCurveHandles(clearCurves);
    }

    // tracePaths呼び出し - paper.jsと同様の方法で
    let allSegments: Segment[] = [];
    for (let i = 0, l = paths.length; i < l; i++) {
      allSegments = allSegments.concat(paths[i]._segments);
    }
    paths = tracePaths(allSegments, {});
    if (paths.length > 0) {
    }
  }

  // 結果のパス構成
  let result: PathItem;
  const length = paths.length;
  if (path instanceof CompoundPath) {
    if (paths !== path._children) {
      path._children = paths;
    }
    result = path;
  } else if (length === 1 && !(path instanceof CompoundPath)) {
    if (paths[0] !== path) {
      (path as Path).setSegments(paths[0].removeSegments());
    }
    result = path;
  } else {
    const compoundPath = new CompoundPath();
    compoundPath.addChildren(paths);
    const reduced = compoundPath.reduce();
    reduced.copyAttributes(path);
    result = reduced;
    // paper.jsではreplaceWith()を使用するが、Papyrus2Dでは直接置き換えは行わない
    // TypeScriptの制約上、replaceWithメソッドの実装が必要だが、
    // 今回はresolveCrossingsの挙動を合わせることが目的なので省略
  }
  return result;
}

/**
 * 指定された位置でパスを分割する
 * paper.jsのdivideLocations関数を移植
 */


