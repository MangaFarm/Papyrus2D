/**
 * PathBooleanResolveCrossings: 交差解決のための関数
 * paper.jsのPathItem.Boolean.jsのresolveCrossings関数とその関連関数を移植
 */

import { PathItemBase } from './PathItemBase';
import { Path } from './Path';
import { Segment } from './Segment';
import { CurveLocation } from './CurveLocation';
import { tracePaths } from './PathBooleanTracePaths';
import { CompoundPath } from './CompoundPath';
import { divideLocations, clearCurveHandles } from './PathBooleanIntersections';

/**
 * パスの交差を解決する
 * paper.jsのresolveCrossings関数を移植
 *
 * @param thisPath 交差を解決するパス
 * @returns 交差が解決されたパス
 */
export function resolveCrossings(thisPath: PathItemBase): PathItemBase {
  var children = thisPath.getChildren(),
    // Support both path and compound-path items
    paths = children || [thisPath];
console.log("🔥 [1]", paths.map(path => path.getSegments().map(s => s && s.toString())));

  function hasOverlap(seg: Segment | null, path: Path | null) {
    var inter = seg && seg._analysis._intersection;
console.log("🐕️", (inter && inter._point), (inter && inter._overlap), (inter && inter._path && inter._path._id), (path && path._id), (inter && inter._path === path), (inter && inter._overlap && inter._path === path));
    return inter && inter._overlap && inter._path === path;
  }

  // First collect all overlaps and crossings while taking note of the
  // existence of both.
  var hasOverlaps = false,
    hasCrossings = false,
    intersections = thisPath.getIntersections(thisPath, function (inter) {
      return (
        (inter.hasOverlap() && (hasOverlaps = true)) ||
        (inter.isCrossing() && (hasCrossings = true))
      );
    }, null, false);
    // We only need to keep track of curves that need clearing
    // outside of divideLocations() if two calls are necessary.
  const clearCurves: any[] | undefined = hasOverlaps && hasCrossings ? [] : undefined;
console.log("🔥intersections1", intersections.length);
  intersections = CurveLocation.expand(intersections);
console.log("🔥intersections2", intersections.length);
  if (hasOverlaps) {
    // First divide in all overlaps, and then remove the inside of
    // the resulting overlap ranges.
console.log("🔥 [2]", paths[0].getSegments().length, paths.map(path => path.getSegments().map(s => s && s.toString())));
    var overlaps = divideLocations(
      intersections,
      function (inter) {
        return inter.hasOverlap();
      },
      clearCurves
    );
console.log("🔥 [3]", paths[0].getSegments().length, paths.map(path => path.getSegments().map(s => s && s.toString())));
    for (var i = overlaps.length - 1; i >= 0; i--) {
      var overlap = overlaps[i],
        path = overlap._path,
        seg = overlap._segment!,
        prev = seg.getPrevious(),
        next = seg.getNext();
console.log("🔥overlap", i, overlap._point, (seg && seg._index), (prev && prev._index), (next && next._index));
      if (hasOverlap(prev, path) && hasOverlap(next, path)) {
console.log("ℹ️remove0", i, (seg.getPrevious() && seg.getPrevious()!._index), (seg.getNext() && seg.getNext()!._index));
        seg.remove();
console.log("ℹ️remove1", i, (seg.getPrevious() && seg.getPrevious()!._index), (seg.getNext() && seg.getNext()!._index));
        prev!._handleOut._set(0, 0);
        next!._handleIn._set(0, 0);
        // If the curve that is left has no length, remove it
        // altogether. Check for paths with only one segment
        // before removal, since `prev.getCurve() == null`.
        if (prev !== seg && !prev!.getCurve()!.hasLength()) {
          // Transfer handleIn when removing segment:
          next!._handleIn.setPoint(prev!._handleIn.toPoint());
          prev!.remove();
console.log("ℹ️remove2", i, (seg.getPrevious() && seg.getPrevious()!._index), (seg.getNext() && seg.getNext()!._index));
        }
      } else {
console.log("ℹ️overlap3");
      }
    }
  }
console.log("🔥 [4]", paths[0].getSegments().length, paths.map(path => path.getSegments().map(s => s && s.toString())));
  if (hasCrossings) {
    // Divide any remaining intersections that are still part of
    // valid paths after the removal of overlaps.
    divideLocations(
      intersections,
      hasOverlaps ?
        function (inter: CurveLocation): boolean {
          // Check both involved curves to see if they're still valid,
          // meaning they are still part of their paths.
          var curve1 = inter.getCurve(),
            seg1 = inter.getSegment(),
            // Do not call getCurve() and getSegment() on the other
            // intersection yet, as it too is in the intersections
            // array and will be divided later. But check if its
            // current curve is valid, as required by some rare edge
            // cases, related to intersections on the same curve.
            other = inter._intersection!,
            curve2 = other._curve,
            seg2 = other._segment;
          if (curve1 && curve2 && curve1._path && curve2._path) return true;
          // Remove all intersections that were involved in the
          // handling of overlaps, to not confuse tracePaths().
          if (seg1) seg1._analysis._intersection = null;
          if (seg2) seg2._analysis._intersection = null;
          return false;
        } : undefined,
      clearCurves
    );
    if (clearCurves) clearCurveHandles(clearCurves);
    // Finally resolve self-intersections through tracePaths()
    paths = tracePaths(paths.map(path => path.getSegments()).flat(), null);
  }
  // Determine how to return the paths: First try to recycle the
  // current path / compound-path, if the amount of paths does not
  // require a conversion.
  var length = paths.length,
    item;
  if (length > 1 && children) {
    if (paths !== children) thisPath.setChildren(paths);
    item = thisPath;
  } else if (length === 1 && !children) {
    if (paths[0] !== thisPath) {
      (thisPath as Path).setSegments(
        (paths[0] as Path).removeSegments());
    }
    item = thisPath;
  }
  // Otherwise create a new compound-path and see if we can reduce it,
  // and attempt to replace this item with it.
  if (!item) {
    item = new CompoundPath();
    item.addChildren(paths);
    item = item.reduce();
    item.copyAttributes(thisPath);
    thisPath.replaceWith(item);
  }
  return item;
}

/**
 * 指定された位置でパスを分割する
 * paper.jsのdivideLocations関数を移植
 */
