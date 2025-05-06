/**
 * PathBooleanTracePaths: Boolean演算のパストレース機能
 * paper.jsのPathItem.Boolean.jsのtracePathsアルゴリズムを忠実に移植
 */

import { Path } from './Path';
import { Segment } from './Segment';
import { Point } from '../basic/Point';
import { getMeta } from './SegmentMeta';
import { CurveLocation } from './CurveLocation';
import { getPathMeta } from './PathMeta';

/**
 * 交点情報
 * SegmentMeta.ts の IntersectionInfo を再エクスポート
 */

/**
 * マーチングアルゴリズムによるパス構築
 * paper.jsのtracePathsアルゴリズムを忠実に移植
 */
export function tracePaths(segments: Segment[], operator: Record<string, boolean>): Path[] {
  // 🔥 デバッグ: segments配列の内容
  // --- 以下、paper.jsのtracePaths本体を忠実に移植 ---
  var paths: Path[] = [],
    starts: Segment[];

  function isValid(seg: Segment | null): boolean {
    // 🔥 デバッグ出力
    var winding: {
      winding: number;
      windingL: number;
      windingR: number;
    };
    // _windingはpaper.jsでもオブジェクトで、winding, windingL, windingRを持つ
    // undefinedの場合は0扱い（paper.jsの実装に合わせる）
    const metaWinding = getMeta(seg!)._winding!;
    winding = {
      winding: metaWinding?.winding ?? 0,
      windingL: metaWinding?.windingL ?? 0,
      windingR: metaWinding?.windingR ?? 0,
    };
    // paper.js互換: open pathの単純ケースでsegments[0]に戻った場合は_visitedを無視してtrue
    if (seg && seg === segments[0]) {
      return true;
    }
    return !!(
      seg &&
      !getMeta(seg!)._visited &&
      (!operator ||
        (operator[winding.winding] &&
          // Unite operations need special handling of segments
          // with a winding contribution of two (part of both
          // areas), which are only valid if they are part of the
          // result's contour, not contained inside another area.
          !(
            operator.unite &&
            winding.winding === 2 &&
            // No contour if both windings are non-zero.
            winding.windingL &&
            winding.windingR
          )))
    );
  }

  function isStart(seg: Segment | null): boolean {
    if (seg) {
      for (var i = 0, l = starts.length; i < l; i++) {
        if (seg === starts[i]) return true;
        // 🔥 paper.js互換: 座標値が完全一致する場合もtrueとみなす
        const p1 = seg.getPoint();
        const p2 = starts[i].getPoint();
        // 許容誤差内で一致する場合もtrue
        const EPS = 1e-7;
        if (Math.abs(p1.x - p2.x) < EPS && Math.abs(p1.y - p2.y) < EPS) return true;
      }
    }
    return false;
  }

  function visitPath(path: Path): void {
    var segments = path._segments;
    for (var i = 0, l = segments.length; i < l; i++) {
      getMeta(segments[i])._visited = true;
    }
  }

  // If there are multiple possible intersections, find the ones that's
  // either connecting back to start or are not visited yet, and will be
  // part of the boolean result:
  function getCrossingSegments(segment: Segment, collectStarts: boolean): Segment[] {
    var inter = getMeta(segment)._intersection!,
      start = inter,
      crossings: Segment[] = [];
    if (collectStarts) starts = [segment];

    function collect(inter: CurveLocation, end?: CurveLocation): void {
      while (inter && inter !== end) {
        var other = inter._segment!,
          path = other._path!;
        if (path) {
          var next = other.getNext() || path.getFirstSegment(),
            nextInter = getMeta(next!)._intersection!;
          if (
            other !== segment &&
            (isStart(other) ||
              isStart(next!) ||
              (next &&
                isValid(other) &&
                (isValid(next!) || (nextInter && isValid(nextInter._segment!)))))
          ) {
            crossings.push(other);
// 🔥 デバッグ: collect時のother/next/nextInter/crossings/starts
          console.log('🔥 collect:', {
            other: other.getPoint().toString(),
            next: next ? next.getPoint().toString() : null,
            nextInter: nextInter ? (nextInter._segment ? nextInter._segment.getPoint().toString() : null) : null,
            crossings: crossings.map(s => s.getPoint().toString()),
            starts: starts.map(s => s.getPoint().toString())
          });
          }
          // paper.js互換: collectStarts時はstarts.push(other)する
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
    var inter1 = getMeta(seg1)._intersection!,
      inter2 = getMeta(seg2)._intersection!,
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
          : seg1._index - seg2._index;
  });

  for (var i = 0, l = segments.length; i < l; i++) {
    var seg = segments[i],
      valid = isValid(seg),
      path: Path | null = null,
      finished = false,
      closed = true,
      branches: Array<{
        start: number;
        crossings: Segment[];
        visited: Segment[];
        handleIn: Point | null;
      }> = [],
      branch: {
        start: number;
        crossings: Segment[];
        visited: Segment[];
        handleIn: Point | null;
      } | null = null,
      visited: Segment[] | null = null,
      handleIn: Point | null = null;
    // 🔥 デバッグ: isValid判定の詳細
    const metaWinding = getMeta(seg)._winding;
    // segの型をSegment | nullに統一
    let segOrNull: Segment | null = seg;
    // If all encountered segments in a path are overlaps, we may have
    // two fully overlapping paths that need special handling.
    if (valid && getPathMeta(seg._path!)!._overlapsOnly) {
      // TODO: Don't we also need to check for multiple overlaps?
      var path1 = seg._path!,
        path2 = getMeta(seg)._intersection!._segment!._path!;
      if (path1.compare!(path2)) {
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
    while (valid) {
      // 🔥 デバッグ: ループ進行の詳細
      // For each segment we encounter, see if there are multiple
      // crossings, and if so, pick the best one:
      var first = !path,
        crossings = getCrossingSegments(segOrNull!, first),
        // Get the other segment of the first found crossing.
        other = crossings.shift(),
        // 🔥 デバッグ: isStart判定の詳細
        finished = !first && (isStart(segOrNull!) || isStart(other!));
        // paper.js互換: open pathの単純ケースで最初のセグメント（segments[0]）に戻ったら_visitedを無視してfinished
        if (!finished && segOrNull && segOrNull === segments[0] && !first) {
          finished = true;
          closed = true; // 必ずパスを閉じる
        }
      var cross = !finished && other;
      if (first) {
        path = new Path();
        // Clear branch to start a new one with each new path.
        branch = null;
      }
      if (finished) {
        // 🔥 デバッグ: first/last判定とclosed伝播
        // If we end up on the first or last segment of an operand,
        // copy over its closed state, to support mixed open/closed
        // scenarios as described in #1036
        if (segOrNull!.isFirst() || segOrNull!.isLast()) closed = segOrNull!._path._closed;
        getMeta(segOrNull!)._visited = true;
        break;
      }
      // paper.js互換: open pathの単純ケースでsegments[0]に戻った場合も_visitedを必ずセット
      if (finished && segOrNull) {
        getMeta(segOrNull)._visited = true;
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
        if (cross) crossings.push(segOrNull!);
        branch = {
          start: path!._segments.length,
          crossings: crossings,
          visited: (visited = []),
          handleIn: handleIn,
        };
      }
      if (cross) segOrNull = other!;
      // If an invalid segment is encountered, go back to the last
      // crossing and try other possible crossings, as well as not
      // crossing at the branch's root.
      if (!isValid(segOrNull!)) {
        // Remove the already added segments, and mark them as not
        // visited so they become available again as options.
        path!.removeSegments(branch!.start);
        for (var j = 0, k = visited!.length; j < k; j++) {
          getMeta(visited![j])._visited = false;
        }
        visited!.length = 0;
        // Go back to the branch's root segment where the crossing
        // happened, and try other crossings. Note that this also
        // tests the root segment without crossing as it is added to
        // the list of crossings when the branch is created above.
        do {
          segOrNull = (branch && branch.crossings.shift()) || null;
          if (!segOrNull || !segOrNull._path) {
            segOrNull = null;
            // If there are no segments left, try previous
            // branches until we find one that works.
            branch = branches.pop()!;
            if (branch) {
              visited = branch.visited;
              handleIn = branch.handleIn;
            }
          }
        } while (branch && segOrNull && !isValid(segOrNull));
        if (!segOrNull) break;
      }
      // Add the segment to the path, and mark it as visited.
      // But first we need to look ahead. If we encounter the end of
      // an open path, we need to treat it the same way as the fill of
      // an open path would: Connecting the last and first segment
      // with a straight line, ignoring the handles.
      var next = segOrNull!.getNext();
      // 直前のセグメントと同じ座標なら追加しない（重複防止）
      const pt = segOrNull!._point!.toPoint();
      const segs = path!._segments;
      if (segs.length === 0 || !segs[segs.length - 1]._point.toPoint().equals(pt)) {
        path!.add(
          new Segment(
            pt,
            handleIn!,
            (next && segOrNull!._handleOut)!.toPoint()
          )
        );
      }
      getMeta(segOrNull!)._visited = true;
      visited!.push(segOrNull!);
      // If this is the end of an open path, go back to its first
      // segment but ignore its handleIn (see above for handleOut).
      segOrNull = next! || segOrNull!._path!.getFirstSegment()!;
      handleIn = next ? next._handleIn!.toPoint() : null;
    }
    if (finished) {
      if (closed) {
        // Carry over the last handleIn to the first segment.
        path!.getFirstSegment()!.setHandleIn(handleIn!);
        path!.setClosed(true); // 必ずtrueをセット
      }
      // Only add finished paths that cover an area to the result.
      if (path!.getArea() !== 0 && path!._segments.length > 2) {
        paths.push(path!);
      }
    }
  }
  // paper.js互換: 各パスの始点を「最小y,x座標のセグメント」に揃える
  for (const path of paths) {
    const segments = path.getSegments();
    if (segments.length === 0) continue;
    let minIdx = 0;
    let maxPt = segments[0]._point.toPoint();
    for (let i = 1; i < segments.length; i++) {
      const pt = segments[i]._point.toPoint();
      if (
        pt.y > maxPt.y ||
        (Math.abs(pt.y - maxPt.y) < 1e-7 && pt.x < maxPt.x)
      ) {
        minIdx = i;
        maxPt = pt;
      }
    }
    if (minIdx !== 0) {
      // segmentsをminIdx分だけ回転させて始点を揃える
      const rotated = segments.slice(minIdx).concat(segments.slice(0, minIdx));
      path.removeSegments(0);
      path.addSegments(rotated);
    }
  }
  return paths;
}
