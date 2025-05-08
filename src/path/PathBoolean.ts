/**
 * PathBoolean: Boolean演算クラス
 * paper.jsのPathItem.Boolean.jsを参考に実装
 */

import { Point } from '../basic/Point';
import { Path } from './Path';
import { Segment } from './Segment';
import { Curve } from './Curve';
import { CompoundPath } from './CompoundPath';
import type { PathItem } from './PathItem';
import { reorientPaths } from './PathBooleanReorient';
import { CollisionDetection } from '../util/CollisionDetection';
import { preparePath } from './PathBooleanPreparation';
import { tracePaths } from './PathBooleanTracePaths';
import { propagateWinding } from './PathBooleanWinding';
import { getMeta } from './SegmentMeta';
import { getPathMeta } from './PathMeta';
import { getIntersections, divideLocations } from './PathBooleanIntersections';

// SegmentInfoインターフェースとasSegmentInfo関数はPathBooleanWinding.tsに移動しました

/**
 * 交点がない場合のパス処理
 */
function handleNoIntersections(
  path1: Path,
  path2: Path,
  operation: 'unite' | 'intersect' | 'subtract' | 'exclude' | 'divide'
): Path[] {
  // 演算子に応じたフィルタ関数を定義
  const operators: Record<string, Record<string, boolean>> = {
    unite: { '1': true, '2': true },
    intersect: { '2': true },
    subtract: { '1': true },
    exclude: { '1': true, '-1': true },
  };

  // 現在の演算に対応するフィルタ関数
  const operator = operators[operation];

  // paper.jsと同様に、operatorにoperationプロパティを追加
  operator[operation] = true;

  // path2の処理
  if (path1 === path2) {
    return [path1];
  }

  // reorientPathsを使用して結果を決定
  const result = reorientPaths(path2 ? [path1, path2] : [path1], (w: number) => !!operator[w]);
  // 🔥 デバッグ: reorientPaths後の各パスの winding, area, pathData を出力
  for (const p of path2 ? [path1, path2] : [path1]) {
    if (!p) continue;
    const id = p._id;
    const area = p.getArea && p.getArea();
    const clockwise = p.isClockwise && p.isClockwise();
    const segs = p.getSegments && p.getSegments().length;
    const bounds = p.getBounds && p.getBounds();
    const pathData = p.getPathData ? p.getPathData() : '';
  }
  for (const p of result) {
    if (!p) continue;
    // @ts-ignore
    const pathData = p.getPathData ? p.getPathData() : '';
  }
  return result;
}

/**
 * 結果Path構築と重複統合
 * paper.jsのcreateResult関数を忠実に移植
 */
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
  // 🔥 デバッグ: createResultに渡されたpathsの順序・始点
  for (let i = 0; i < paths.length; i++) {
    if (paths[i] && typeof paths[i].getSegments === 'function') {
      const segs = paths[i].getSegments();
      if (segs && segs.length > 0) {
        const pt = segs[0].point || segs[0]._point;
        if (pt) {
          // eslint-disable-next-line no-console
          console.log(`🔥 createResult paths[${i}] start: (${pt.x},${pt.y})`);
        }
      }
    } else {
      // eslint-disable-next-line no-console
      console.log(`🔥 createResult paths[${i}] is null or invalid`);
    }
  }
  const result = new CompoundPath();
  result.addChildren(paths);
  // 🔥 CompoundPathのchildren順序を出力
  for (let i = 0; i < result._children.length; i++) {
    const child = result._children[i];
    if (child && typeof child.getSegments === 'function') {
      const segs = child.getSegments();
      if (segs && segs.length > 0) {
        const pt = segs[0].point || segs[0]._point;
        if (pt) {
          // eslint-disable-next-line no-console
          console.log(`🔥 CompoundPath children[${i}] start: (${pt.x},${pt.y})`);
        }
      }
    }
  }

  // パスを簡略化（reduce相当の処理）
  const simplified = result.reduce({ simplify });
  // CompoundPath型の特別処理は不要

  // 挿入オプションが明示的にfalseでない場合、結果を挿入
  if (!(options && options.insert === false)) {
    // path1とpath2が存在し、兄弟関係にある場合、
    // path1のインデックスがpath2より小さければpath2の上に、
    // そうでなければpath1の上に挿入
    if (path2 && path1 && path1.isSibling!(path2) && path1.getIndex!() < path2.getIndex!()) {
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

/**
 * Boolean演算の実行
 * paper.jsの関数を移植
 */
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
      getPathMeta(path)._overlapsOnly = true;
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
    ) as { hor: number[], ver: number[] }[]; // both type
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
        inter = getMeta(segment)._intersection;
      if (!getMeta(segment)._winding) {
        propagateWinding(segment, _path1, _path2, curveCollisionsMap, operator);
      }
      // See if all encountered segments in a path are overlaps.
      if (!(inter && inter._overlap)) getPathMeta(segment._path!)._overlapsOnly = false;
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
      var path: Path = crossings[i].split();
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

/**
 * パスの合成（unite）
 */
export function unite(path1: PathItem, path2: PathItem): PathItem {
  return traceBoolean(path1, path2, 'unite');
}

/**
 * パスの交差（intersect）
 */
export function intersect(path1: PathItem, path2: PathItem): PathItem {
  const result = traceBoolean(path1, path2, 'intersect');
  // 🔥PathBoolean.intersect result
  return result;
}

/**
 * パスの差分（subtract）
 */
export function subtract(path1: PathItem, path2: PathItem): PathItem {
  return traceBoolean(path1, path2, 'subtract');
}

/**
 * パスの排他的論理和（exclude）
 */
export function exclude(path1: PathItem, path2: PathItem): PathItem {
  return traceBoolean(path1, path2, 'exclude');
}

/**
 * パスの分割（divide）
 */
export function divide(path1: PathItem, path2: PathItem): PathItem {
  return traceBoolean(path1, path2, 'divide');
}
