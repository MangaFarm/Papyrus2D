import { Path } from './Path';
import { Segment } from './Segment';
import { Curve } from './Curve';
import { Change } from './ChangeFlag';

type SegmentsWithCurves = Array<Segment> & { _curves?: Curve[] };

export function insertSegments(path: Path, segs: SegmentsWithCurves, index?: number): Segment[] {
  // Local short-cuts:
  var segments = path._segments,
    curves = path._curves,
    amount = segs.length,
    append = index == null,
    index = append ? segments.length : index;
  // Scan through segments to add first, convert if necessary and set
  // _path and _index references on them.
  for (var i = 0; i < amount; i++) {
    var segment = segs[i];
    // If the segments belong to another path already, clone them before
    // adding:
    if (segment._path) segment = segs[i] = segment.clone();
    segment._path = path;
    segment._index = index! + i;
  }
  if (append) {
    // Append them all at the end.
    segments.push(...segs);
  } else {
    // Insert somewhere else
    segments.splice(index!, 0, ...segs);
    // Adjust the indices of the segments above.
    for (var i = index! + amount, l = segments.length; i < l; i++) segments[i]._index = i;
  }
  // Keep the curves list in sync all the time in case it was requested
  // already.
  if (curves) {
    var total = path._countCurves(),
      // If we're adding a new segment to the end of an open path,
      // we need to step one index down to get its curve.
      start = index! > 0 && index! + amount - 1 === total ? index! - 1 : index,
      insert = start,
      end = Math.min(start! + amount, total);
    if (segs._curves) {
      // Reuse removed curves.
      curves.splice(start!, 0, ...segs._curves);
      insert! += segs._curves.length;
    }
    // Insert new curves, but do not initialize their segments yet,
    // since #_adjustCurves() handles all that for us.
    for (var i = insert!; i < end; i++) curves.splice(i, 0, new Curve(path, null, null));
    // Adjust segments for the curves before and after the removed ones
    path._adjustCurves(start!, end);
  }
  // Use SEGMENTS notification instead of GEOMETRY since curves are kept
  // up-to-date by _adjustCurves() and don't need notification.
  path._changed(/*#=*/ Change.SEGMENTS);
  return segs;
}

export function removeSegments(path: Path, start: number = 0, end?: number, _includeCurves?: boolean): SegmentsWithCurves {
  start = start || 0;
  end = end !== undefined ? end : path._segments.length;
  var segments = path._segments,
    curves = path._curves,
    count = segments.length, // segment count before removal
    removed: SegmentsWithCurves = segments.splice(start, end! - start),
    amount = removed.length;
  if (!amount) return removed;
  // Update selection state accordingly
  for (var i = 0; i < amount; i++) {
    var segment = removed[i];
    // Clear the indices and path references of the removed segments
    segment._index = segment._path = null;
  }
  // Adjust the indices of the segments above.
  for (var i = start, l = segments.length; i < l; i++) segments[i]._index = i;
  // Keep curves in sync
  if (curves) {
    // If we're removing the last segment, remove the last curve (the
    // one to the left of the segment, not to the right, as normally).
    // Also take into account closed paths, which have one curve more
    // than segments.
    var index = start > 0 && end === count + (path._closed ? 1 : 0) ? start - 1 : start,
      splicedCurves = curves.splice(index, amount);
    // Unlink the removed curves from the path.
    for (var i = splicedCurves.length - 1; i >= 0; i--) splicedCurves[i]._path = null;
    // Return the removed curves as well, if we're asked to include
    // them, but exclude the first curve, since that's shared with the
    // previous segment and does not connect the returned segments.
    if (_includeCurves) removed._curves = curves.slice(1);
    // Adjust segments for the curves before and after the removed ones
    path._adjustCurves(index, index);
  }
  // Use SEGMENTS notification instead of GEOMETRY since curves are kept
  // up-to-date by _adjustCurves() and don't need notification.
  path._changed(/*#=*/ Change.SEGMENTS);
  return removed;
}
