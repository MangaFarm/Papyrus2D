/**
 * PathBoolean: Boolean演算クラス
 * paper.jsのPathItem.Boolean.jsを参考に実装
 */

import { Point } from '../basic/Point';
import { Path } from './Path';
import { Segment } from './Segment';
import { Curve } from './Curve';
import { CurveLocation } from './CurveLocation';
import { CompoundPath } from './CompoundPath';
import type { PathItem } from './PathItem';
import { reorientPaths } from './PathBooleanReorient';
import { CollisionDetection } from '../util/CollisionDetection';
import { preparePath } from './PathBooleanPreparation';
import { tracePaths } from './PathBooleanTracePaths';
import { propagateWinding } from './PathBooleanWinding';
import { divideLocations } from './PathBooleanIntersections';

function createResult(
  paths: Path[],
  simplify: boolean,
  path1: PathItem,
  path2?: PathItem,
  options?: { insert?: boolean }
): PathItem {
  // パスの配列が空の場合のフォールバック処理
  if (paths.length === 0) {
    // paper.jsの実装に合わせて、空のパスを作成
    const emptyPath = new Path();

    // path1の属性をコピー
    if (path1) {
      emptyPath.copyAttributes(path1, true);
    }

    // 挿入オプションが明示的にfalseでない場合、結果を挿入
    if (!(options && options.insert === false)) {
      if (path1) {
        emptyPath.insertAbove(path1);
      }
    }

    return emptyPath;
  }

  // pathsが空でない場合の冗長なループは削除

  // 結果のCompoundPathを作成
  const result = new CompoundPath();
  result.addChildren(paths);

  // パスを簡略化（reduce相当の処理）
  const simplified = result.reduce({ simplify });
  // CompoundPath型の特別処理は不要

  // 挿入オプションが明示的にfalseでない場合、結果を挿入
  if (!(options && options.insert === false)) {
    // path1とpath2が存在し、兄弟関係にある場合、
    // path1のインデックスがpath2より小さければpath2の上に、
    // そうでなければpath1の上に挿入
    if (path2 && path1 && path1.isSibling!(path2) && path1.getIndex()! < path2.getIndex()!) {
      simplified.insertAbove!(path2);
    } else if (path1) {
      simplified.insertAbove!(path1);
    }
  }

  // path1の属性をコピー
  if (path1) {
    simplified.copyAttributes(path1, true);
  }

  return simplified;
}

function traceBoolean(
  path1: PathItem,
  path2: PathItem,
  operation: 'unite' | 'intersect' | 'subtract' | 'exclude' | 'divide',
  options?: { insert?: boolean; trace?: boolean; stroke?: boolean }
): PathItem {
  const operators = {
    unite:     { '1': true, '2': true },
    intersect: { '2': true },
    subtract:  { '1': true },
    // exclude only needs -1 to support reorientPaths() when there are
    // no crossings. The actual boolean code uses unsigned winding.
    exclude:   { '1': true, '-1': true }
  };

  // Only support subtract and intersect operations when computing stroke
  // based boolean operations (options.split = true).
  if (
    options &&
    (options.trace == false || options.stroke) &&
    /^(subtract|intersect)$/.test(operation)
  )
    return splitBoolean(path1, path2, operation);
  // We do not modify the operands themselves, but create copies instead,
  // fas produced by the calls to preparePath().
  // NOTE: The result paths might not belong to the same type i.e.
  // subtract(A:Path, B:Path):CompoundPath etc.
  let _path1: PathItem = preparePath(path1, true);
  let _path2: PathItem | null = path2 && path1 !== path2 ? preparePath(path2, true) : null;
    // Retrieve the operator lookup table for winding numbers.
  const operator = operators[operation];
  // Add a simple boolean property to check for a given operation,
  // e.g. `if (operator.unite)`
  operator[operation] = true;
  // Give both paths the same orientation except for subtraction
  // and exclusion, where we need them at opposite orientation.
  if (
    _path2 &&
    (operator.subtract || operator.exclude) ^ +(+_path2.isClockwise() ^ +_path1.isClockwise())
  )
    _path2.reverse();
  // Split curves at crossings on both paths. Note that for self-
  // intersection, path2 is null and getIntersections() handles it.
  var crossings = divideLocations(
      CurveLocation.expand(_path1.getIntersections(_path2!, filterIntersection, null, false))
    ),
    paths1 = _path1.getPaths(),
    paths2 = _path2 && _path2.getPaths(),
    segments: Segment[] = [],
    curves: Curve[] = [],
    paths;

  function collectPaths(paths: Path[]) {
    for (var i = 0, l = paths.length; i < l; i++) {
      const path = paths[i];
      segments.push(...path._segments);
      curves.push(...path.getCurves());
      // See if all encountered segments in a path are overlaps, to
      // be able to separately handle fully overlapping paths.
      path._analysis._overlapsOnly = true;
    }
  }

  function getCurves(indices) {
    var list: Curve[] = [];
    for (var i = 0, l = indices && indices.length; i < l; i++) {
      list.push(curves[indices[i]]);
    }
    return list;
  }

  if (crossings.length) {
    // Collect all segments and curves of both involved operands.
    collectPaths(paths1);
    if (paths2) collectPaths(paths2);

    var curvesValues = new Array(curves.length);
    for (var i = 0, l = curves.length; i < l; i++) {
      curvesValues[i] = curves[i].getValues();
    }
    var curveCollisions = CollisionDetection.findCurveBoundsCollisions(
      curvesValues,
      curvesValues,
      0,
      true
    );
    var curveCollisionsMap = {};
    for (var i = 0; i < curves.length; i++) {
      var curve = curves[i],
        id = curve._path!._id,
        map = (curveCollisionsMap[id] = curveCollisionsMap[id] || {});
      map[curve.getIndex()] = {
        hor: getCurves(curveCollisions[i].hor),
        ver: getCurves(curveCollisions[i].ver),
      };
    }

    // Propagate the winding contribution. Winding contribution of
    // curves does not change between two crossings.
    // First, propagate winding contributions for curve chains starting
    // in all crossings:
    for (var i = 0, l = crossings.length; i < l; i++) {
      propagateWinding(crossings[i]._segment!, _path1, _path2, curveCollisionsMap, operator);
    }
    for (var i = 0, l = segments.length; i < l; i++) {
      var segment = segments[i],
        inter = segment._analysis._intersection;
      if (!segment._analysis._winding) {
        propagateWinding(segment, _path1, _path2, curveCollisionsMap, operator);
      }
      // See if all encountered segments in a path are overlaps.
      if (!(inter && inter._overlap)) segment._path!._analysis._overlapsOnly = false;
    }
    paths = tracePaths(segments, operator);
  } else {
    // When there are no crossings, the result can be determined through
    // a much faster call to reorientPaths():
    paths = reorientPaths(
      // Make sure reorientPaths() never works on original
      // _children arrays by calling paths1.slice()
      paths2 ? paths1.concat(paths2) : paths1.slice(),
      function (w) {
        return !!operator[w];
      }
    );
  }
  return createResult(paths, true, path1, path2, options);
}

function splitBoolean(path1, path2, operation) {
  var _path1 = preparePath(path1),
      _path2 = preparePath(path2),
      crossings = _path1.getIntersections(_path2, filterIntersection, null, false),
      subtract = operation === 'subtract',
      divide = operation === 'divide',
      added = {},
      paths: Path[] = [];

  function addPath(path) {
      // Simple see if the point halfway across the open path is inside
      // path2, and include / exclude the path based on the operator.
      if (!added[path._id] && (divide ||
              +_path2.contains(path.getPointAt(path.getLength() / 2))
                  ^ +subtract)) {
          paths.unshift(path);
          return added[path._id] = true;
      }
  }

  // Now loop backwards through all crossings, split the path and check
  // the new path that was split off for inclusion.
  for (var i = crossings.length - 1; i >= 0; i--) {
      var path: Path | null = crossings[i].split();
      if (path) {
          // See if we can add the path, and if so, clear the first handle
          // at the split, because it might have been a curve.
          if (addPath(path))
              path.getFirstSegment()!.setHandleIn(new Point(0, 0));
          // Clear the other side of the split too, which is always the
          // end of the remaining _path1.
          (_path1 as Path).getLastSegment()!.setHandleOut(new Point(0, 0));
      }
  }
  // At the end, add what's left from our path after all the splitting.
  addPath(_path1);
  return createResult(paths, false, path1, path2);
}

function filterIntersection(inter) {
  // TODO: Change isCrossing() to also handle overlaps (hasOverlap())
  // that are actually involved in a crossing! For this we need proper
  // overlap range detection / merging first... But as we call
  // #resolveCrossings() first in boolean operations, removing all
  // self-touching areas in paths, this works for the known use cases.
  // The ideal implementation would deal with it in a way outlined in:
  // https://github.com/paperjs/paper.js/issues/874#issuecomment-168332391
  return inter.hasOverlap() || inter.isCrossing();
}

export function unite(path1: PathItem, path2: PathItem): PathItem {
  return traceBoolean(path1, path2, 'unite');
}

export function intersect(path1: PathItem, path2: PathItem): PathItem {
  const result = traceBoolean(path1, path2, 'intersect');
  return result;
}

export function subtract(path1: PathItem, path2: PathItem): PathItem {
  return traceBoolean(path1, path2, 'subtract');
}

export function exclude(path1: PathItem, path2: PathItem): PathItem {
  return traceBoolean(path1, path2, 'exclude');
}

export function divide(path1: PathItem, path2: PathItem): PathItem {
  return traceBoolean(path1, path2, 'divide');
}

export function join(path1: Path, path2: Path, tolerance: number) {
  var epsilon = tolerance || 0;
  if (path2 && path2 !== path1) {
      var segments = path2._segments,
          last1 = path1.getLastSegment(),
          last2 = path2.getLastSegment();
      if (!last2) // an empty path?
          return path1;
      if (last1 && last1._point.isClose(last2._point, epsilon))
          path2.reverse();
      var first2 = path2.getFirstSegment();
      if (last1 && last1._point.isClose(first2!._point, epsilon)) {
          last1.setHandleOut(first2!._handleOut.toPoint());
          path1._add(segments.slice(1));
      } else {
          var first1 = path1.getFirstSegment();
          if (first1 && first1._point.isClose(first2!._point, epsilon))
              path2.reverse();
          last2 = path2.getLastSegment();
          if (first1 && first1._point.isClose(last2!._point, epsilon)) {
              first1.setHandleIn(last2!._handleIn.toPoint());
              // Prepend all segments from path except the last one.
              path1._add(segments.slice(0, segments.length - 1), 0);
          } else {
              path1._add(segments.slice());
          }
      }
      if (path2._closed)
          path1._add([segments[0]]);
      path2._remove(true, true);
  }
  // If the first and last segment touch, close the resulting path and
  // merge the end segments. Also do this if no path argument was provided
  // in which cases the path is joined with itself only if its ends touch.
  var first = path1.getFirstSegment(),
      last = path1.getLastSegment();
  if (first !== last && first!._point.isClose(last!._point, epsilon)) {
      first!.setHandleIn(last!._handleIn.toPoint());
      last!.remove();
      path1.setClosed(true);
  }
  return path1;
}
