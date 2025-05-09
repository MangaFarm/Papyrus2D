/**
 * PathBooleanTracePaths: Boolean演算のパストレース機能
 * paper.jsのPathItem.Boolean.jsのtracePathsアルゴリズムを忠実に移植
 */

import { Path } from './Path';
import { Segment } from './Segment';
import { Point } from '../basic/Point';
import { CurveLocation } from './CurveLocation';
import { WindingInfo } from './SegmentAnalysis';

type Branch = {
  start: number;
  crossings: Segment[];
  visited: Segment[];
  handleIn: Point | null;
};

/*
function show(n: number, paths: Path[]) {
  if (paths.length === 0) {
    console.log(`🔥[${n}]`, "no paths");
    return;
  }
  const path = paths[0];
  const segments = path.getSegments();
  console.log(`🔥[${n}]`, segments.length, path.getSegments().map(s => s && s.toString()));
}
*/

/**
 * マーチングアルゴリズムによるパス構築
 * paper.jsのtracePathsアルゴリズムを忠実に移植
 */
export function tracePaths(segments: Segment[], operator: Record<string, boolean> | null): Path[] {
  var paths: Path[] = [],
    starts: Segment[];

  function isValid(seg: Segment | null): boolean {
    var winding = seg?._analysis._winding;
    return !!(seg && !seg._analysis._visited && (!operator
            || operator[winding?.winding!]
                // Unite operations need special handling of segments
                // with a winding contribution of two (part of both
                // areas), which are only valid if they are part of the
                // result's contour, not contained inside another area.
                && !(operator.unite && winding!.winding === 2
                    // No contour if both windings are non-zero.
                    && winding!.windingL && winding!.windingR)));
  }

  function isStart(seg: Segment | null): boolean {
    if (seg) {
      for (var i = 0, l = starts.length; i < l; i++) {
        if (seg === starts[i]) return true;
      }
    }
    return false;
  }

  function visitPath(path: Path): void {
    var segments = path._segments;
    for (var i = 0, l = segments.length; i < l; i++) {
      segments[i]._analysis._visited = true;
    }
  }

  // If there are multiple possible intersections, find the ones that's
  // either connecting back to start or are not visited yet, and will be
  // part of the boolean result:
  function getCrossingSegments(segment: Segment, collectStarts: boolean): Segment[] {
    var inter = segment._analysis._intersection!,
      start = inter,
      crossings: Segment[] = [];
    if (collectStarts) starts = [segment];

    function collect(inter: CurveLocation, end?: CurveLocation): void {
      while (inter && inter !== end) {
        var other = inter._segment!,
          path = other._path!;
        if (path) {
          var next = other.getNext() || path.getFirstSegment(),
            nextInter = next!._analysis._intersection!;
          if (
            other !== segment &&
            (isStart(other) ||
              isStart(next!) ||
              (next &&
                isValid(other) &&
                (isValid(next!) || (nextInter && isValid(nextInter._segment!)))))
          ) {
            crossings.push(other);
          }
          if (collectStarts) starts.push(other);
        }
        inter = inter._next!;
      }
    }

    if (inter) {
      collect(inter);
      while (inter && inter._previous) inter = inter._previous;
      collect(inter, start);
    }
    return crossings;
  }

  // Sort segments to give non-ambiguous segments the preference as
  // starting points when tracing: prefer segments with no intersections
  // over intersections, and process intersections with overlaps last:
  segments.sort(function (seg1: Segment, seg2: Segment): number {
    var inter1 = seg1._analysis._intersection!,
      inter2 = seg2._analysis._intersection!,
      over1 = !!(inter1 && inter1._overlap),
      over2 = !!(inter2 && inter2._overlap),
      path1 = seg1._path!,
      path2 = seg2._path!;
    // Use bitwise-or to sort cases where only one segment is an overlap
    // or intersection separately, and fall back on natural order within
    // the path.
    return (over1 ? 1 : 0) ^ (over2 ? 1 : 0)
      ? over1
        ? 1
        : -1
      : // NOTE: inter1 & 2 are objects, convert to boolean first
        // as otherwise toString() is called on them.
        (!inter1 ? 1 : 0) ^ (!inter2 ? 1 : 0)
        ? inter1
          ? 1
          : -1
        : // All other segments, also when comparing two overlaps
          // or two intersections, are sorted by their order.
          // Sort by path id to group segments on the same path.
          path1 !== path2
          ? path1._id - path2._id
          : seg1._index! - seg2._index!;
  });

  for (let i: number = 0, l: number = segments.length; i < l; i++) {
    let seg: Segment | null = segments[i],
      valid: boolean = isValid(seg),
      path: Path | null = null,
      finished: boolean = false,
      closed: boolean = true,
      branches: Branch[] = [],
      branch: Branch | null = null,
      visited: Segment[] | null = null,
      handleIn: Point | null = null;
    // If all encountered segments in a path are overlaps, we may have
    // two fully overlapping paths that need special handling.
    if (valid && seg._path!._analysis._overlapsOnly) {
      // TODO: Don't we also need to check for multiple overlaps?
      const path1: Path = seg._path!,
        path2: Path = seg._analysis._intersection!._segment!._path!;
      if (path1.compare(path2)) {
        // Only add the path to the result if it has an area.
        if (path1.getArea()) paths.push(path1.clone(false));
        // Now mark all involved segments as visited.
        visitPath(path1);
        visitPath(path2);
        valid = false;
      }
    }
    // Do not start with invalid segments (segments that were already
    // visited, or that are not going to be part of the result).
    let counter = 0;
    while (valid) {
      // For each segment we encounter, see if there are multiple
      // crossings, and if so, pick the best one:
      const first: boolean = !path;
      let crossings: Segment[] = getCrossingSegments(seg!, first),
        // Get the other segment of the first found crossing.
        other: Segment | undefined = crossings.shift(),
        finished2: boolean = !first && (isStart(seg) || isStart(other ?? null)),
        cross: Segment | undefined | false = !finished2 && other;
      finished = finished2;
      if (first) {
        path = new Path();
        // Clear branch to start a new one with each new path.
        branch = null;
      }
      if (finished) {
        // If we end up on the first or last segment of an operand,
        // copy over its closed state, to support mixed open/closed
        // scenarios as described in #1036
        if (seg!.isFirst() || seg!.isLast()) closed = seg!._path!._closed;
        seg!._analysis._visited = true;
        break;
      }
      if (cross && branch) {
        // If we're about to cross, start a new branch and add the
        // current one to the list of branches.
        branches.push(branch);
        branch = null;
      }
      if (!branch) {
        // Add the branch's root segment as the last segment to try,
        // to see if we get to a solution without crossing.
        if (cross) crossings.push(seg!);
        branch = {
          start: path!.getSegments().length,
          crossings: crossings,
          visited: (visited = []),
          handleIn: handleIn,
        };
      }
      if (cross) seg = other!;
      // If an invalid segment is encountered, go back to the last
      // crossing and try other possible crossings, as well as not
      // crossing at the branch's root.
      if (!isValid(seg)) {
        // Remove the already added segments, and mark them as not
        // visited so they become available again as options.
        path!.removeSegments(branch.start);
        for (let j: number = 0, k: number = visited!.length; j < k; j++) {
          visited![j]._analysis._visited = false;
        }
        visited!.length = 0;
        // Go back to the branch's root segment where the crossing
        // happened, and try other crossings. Note that this also
        // tests the root segment without crossing as it is added to
        // the list of crossings when the branch is created above.
        do {
          seg = branch && branch.crossings.shift()!;
          if (!seg || !seg._path) {
            seg = null;
            // If there are no segments left, try previous
            // branches until we find one that works.
            branch = branches.pop()!;
            if (branch) {
              visited = branch.visited;
              handleIn = branch.handleIn;
            }
          }
        } while (branch && !isValid(seg));
        if (!seg) break;
      }
      // Add the segment to the path, and mark it as visited.
      // But first we need to look ahead. If we encounter the end of
      // an open path, we need to treat it the same way as the fill of
      // an open path would: Connecting the last and first segment
      // with a straight line, ignoring the handles.
      const next: Segment | null = seg!.getNext();
      const newSeg: Segment = new Segment(seg!._point.toPoint(), handleIn,
        next && seg!._handleOut.toPoint());
      path!.add(newSeg);
      seg!._analysis._visited = true;
      visited!.push(seg!);
      seg = next || seg!._path!.getFirstSegment() || null;
      handleIn = next && next._handleIn.toPoint();
    }
    if (finished) {
      if (closed) {
        path!.getFirstSegment()?.setHandleIn(handleIn!);
        path!.setClosed(true);
      }
      // Only add finished paths that cover an area to the result.
      if (path!.getArea() !== 0) {
        paths.push(path!);
      }
    }
  }
  // show(2, paths);
  return paths;
}
