/**
 * PathArc.ts
 * paper.jsのPath.arcToメソッドを移植したもの
 */

import { Point } from '../basic/Point';
import { Segment } from './Segment';
import { Path } from './Path';
import { Numerical } from '../util/Numerical';
import { Line } from '../basic/Line';

/**
 * 円弧を描画するためのユーティリティ関数
 */
export class PathArc {
  /**
   * 円弧を描画する
   * 
   * 3つの形式で呼び出すことができます：
   * 1. arcTo(to, clockwise) - 現在の点から指定された点までの円弧を描画
   * 2. arcTo(through, to) - 現在の点から、指定された中間点を通って、指定された終点までの円弧を描画
   * 3. arcTo(to, radius, rotation, clockwise, large) - SVGスタイルの円弧を描画
   * 
   * @param path 円弧を追加するパス
   * @param args 引数（複数の形式をサポート）
   * @returns 円弧が追加されたパス
   */
  static arcTo(path: Path, through: Point, to: Point): void {
    function getCurrentSegment(that: Path): Segment {
      var segments = that._segments;
      if (!segments.length)
          throw new Error('Use a moveTo() command first');
      return segments[segments.length - 1];
    }

    const current = getCurrentSegment(path);
    const from: Point = current._point.toPoint();

    // Calculate center, vector and extend for non SVG versions:
    // Construct the two perpendicular middle lines to
    // (from, through) and (through, to), and intersect them to get
    // the center.
    var l1 = new Line(from.add(through).divide(2),
                through.subtract(from).rotate(90), true),
        l2 = new Line(through.add(to).divide(2),
                to.subtract(through).rotate(90), true),
        line = new Line(from, to),
        throughSide = line.getSide(through);
    let center = l1.intersect(l2, true);
    // If the two lines are collinear, there cannot be an arc as the
    // circle is infinitely big and has no center point. If side is
    // 0, the connecting arc line of this huge circle is a line
    // between the two points, so we can use #lineTo instead.
    // Otherwise we bail out:
    if (!center) {
        if (!throughSide) {
            path.lineTo(to);
            return;
        }
        throw new Error(
                'Cannot create an arc with the given arguments');
    }
    let vector = from.subtract(center);
    let extent = vector.getDirectedAngle(to.subtract(center));
    var centerSide = line.getSide(center, true);
    if (centerSide === 0) {
        // If the center is lying on the line, we might have gotten
        // the wrong sign for extent above. Use the sign of the side
        // of the through point.
        extent = throughSide * Math.abs(extent);
    } else if (throughSide === centerSide) {
        // If the center is on the same side of the line (from, to)
        // as the through point, we're extending bellow 180 degrees
        // and need to adapt extent.
        extent += extent < 0 ? 360 : -360;
    }

    if (extent) {
      var epsilon = /*#=*/Numerical.ANGULAR_EPSILON,
          ext = Math.abs(extent),
          // Calculate amount of segments required to approximate over
          // `extend` degrees (extend / 90), but prevent ceil() from
          // rounding up small imprecisions by subtracting epsilon.
          count = ext >= 360
              ? 4
              : Math.ceil((ext - epsilon) / 90),
          inc = extent / count,
          half = inc * Math.PI / 360,
          z = 4 / 3 * Math.sin(half) / (1 + Math.cos(half)),
          segments: Segment[] = [];
      for (var i = 0; i <= count; i++) {
          // Explicitly use to point for last segment, since depending
          // on values the calculation adds imprecision:
          var pt = to,
              out: Point | null = null;
          if (i < count) {
              out = vector.rotate(90).multiply(z);
              pt = center.add(vector);
          }
          if (!i) {
              // Modify startSegment
              current.setHandleOut(out!);
          } else {
              // Add new Segment
              var _in = vector.rotate(-90).multiply(z);
              segments.push(new Segment(pt, _in, out));
          }
          vector = vector.rotate(inc);
      }
      // Add all segments at once at the end for higher performance
      path._add(segments);
  }
}

}