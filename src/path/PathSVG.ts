/**
 * PathSVG.ts
 * SVGパスデータのエンコード/デコード・パース・エクスポート専用ユーティリティ
 * paper.js の Path.js/PathItem.js のSVG変換ロジックをTypeScriptで移植
 */

import { Path } from './Path';
import { Segment } from './Segment';
import { Point } from '../basic/Point';
import { Size } from '../basic/Size';
import { Numerical } from '../util/Numerical';
import { Matrix } from '../basic/Matrix';

/**
 * SVG出力用の数値フォーマッタ（paper.js互換、最小限）
 */
class Formatter {
  private multiplier: number;

  constructor(private precision: number) {
    this.multiplier = Math.pow(10, this.precision);
  }

  number(val: number): number {
    return this.precision < 16
            ? Math.round(val * this.multiplier) / this.multiplier : val;
  }

  pair(x: number, y: number): string {
    return this.number(x) + ',' + this.number(y);
  }
}

/**
 * SVGパスデータ文字列を生成
 */
export function toPathData(path: Path, matrix: Matrix, precision: number): string {
  // NOTE: #setPathData() is defined in PathItem.
  var segments = path._segments,
    length = segments.length,
    f = new Formatter(precision),
    coords = new Array(6),
    first = true,
    curX: number,
    curY: number,
    prevX: number,
    prevY: number,
    inX: number,
    inY: number,
    outX: number,
    outY: number,
    parts: string[] = [];

  function addSegment(segment: Segment, skipLine: boolean) {
    segment._transformCoordinates(matrix, coords, false);
    curX = coords[0];
    curY = coords[1];
    if (first) {
      parts.push('M' + f.pair(curX, curY));
      first = false;
    } else {
      inX = coords[2];
      inY = coords[3];
      if (inX === curX && inY === curY && outX === prevX && outY === prevY) {
        // l = relative lineto:
        if (!skipLine) {
          var dx = curX - prevX,
            dy = curY - prevY;
          let cmd;
          if (dx === 0) {
            cmd = 'v' + f.number(dy);
          } else if (dy === 0) {
            cmd = 'h' + f.number(dx);
          } else {
            cmd = 'l' + f.pair(dx, dy);
          }
          parts.push(cmd);
        }
      } else {
        // c = relative curveto:
        parts.push(
          'c' +
            f.pair(outX - prevX, outY - prevY) +
            ' ' +
            f.pair(inX - prevX, inY - prevY) +
            ' ' +
            f.pair(curX - prevX, curY - prevY)
        );
      }
    }
    prevX = curX;
    prevY = curY;
    outX = coords[4];
    outY = coords[5];
  }

  if (!length) return '';

  for (var i = 0; i < length; i++) addSegment(segments[i], false);
  // Close path by drawing first segment again
  if (path._closed && length > 0) {
    addSegment(segments[0], true);
    parts.push('z');
  }
  return parts.join('');
}

/**
 * SVGパスデータからPathを生成（fromSVGのエイリアス）
 */
export function fromPathData(svg: string): Path {
  // NOTE: #getPathData() is defined in CompoundPath / Path
  // This is a very compact SVG Path svg parser that works both for Path
  // and CompoundPath.

  const path = new Path();

  // First split the path data into parts of command-coordinates pairs
  // Commands are any of these characters: mzlhvcsqta
  var parts = svg && svg.match(/[mlhvcsqtaz][^mlhvcsqtaz]*/gi),
    coords,
    relative = false,
    previous,
    control,
    current = new Point(),
    start = new Point();

  function getCoord(index, coord) {
    var val = +coords[index];
    if (relative) val += current[coord];
    return val;
  }

  function getPoint(index) {
    return new Point(getCoord(index, 'x'), getCoord(index + 1, 'y'));
  }

  // First clear the previous content
  const l = parts ? parts.length : 0;
  for (let i = 0; i < l; i++) {
    var part = parts![i],
      command = part[0],
      lower = command.toLowerCase();
    // Match all coordinate values
    coords = part.match(/[+-]?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?/g);
    var length = coords && coords.length;
    relative = command === lower;
    // Fix issues with z in the middle of SVG path data, not followed by
    // a m command, see #413:
    if (previous === 'z' && !/[mz]/.test(lower)) path.moveTo(current);
    switch (lower) {
      case 'm':
      case 'l':
        var move = lower === 'm';
        for (var j = 0; j < length; j += 2) {
          current = getPoint(j);
          if (move) {
            path.moveTo(current);
          } else {
            path.lineTo(current);
          }
          if (move) {
            start = current;
            move = false;
          }
        }
        control = current;
        break;
      case 'h':
      case 'v':
        var coord = lower === 'h' ? 'x' : 'y';
        current = current.clone(); // Clone as we're going to modify it.
        for (var j = 0; j < length; j++) {
          current[coord] = getCoord(j, coord);
          path.lineTo(current);
        }
        control = current;
        break;
      case 'c':
        for (var j = 0; j < length; j += 6) {
          path.cubicCurveTo(getPoint(j), (control = getPoint(j + 2)), (current = getPoint(j + 4)));
        }
        break;
      case 's':
        // Smooth cubicCurveTo
        for (var j = 0; j < length; j += 4) {
          path.cubicCurveTo(
            /[cs]/.test(previous) ? current.multiply(2).subtract(control) : current,
            (control = getPoint(j)),
            (current = getPoint(j + 2))
          );
          previous = lower;
        }
        break;
      case 'q':
        for (var j = 0; j < length; j += 4) {
          path.quadraticCurveTo((control = getPoint(j)), (current = getPoint(j + 2)));
        }
        break;
      case 't':
        // Smooth quadraticCurveTo
        for (var j = 0; j < length; j += 2) {
          path.quadraticCurveTo(
            (control = /[qt]/.test(previous) ? current.multiply(2).subtract(control) : current),
            (current = getPoint(j))
          );
          previous = lower;
        }
        break;
      case 'a':
        for (var j = 0; j < length; j += 7) {
          const end = getPoint(j + 5);
          const { through, to } = arcToSvgLike(
            current, 
            end,
            new Size(+coords[j], +coords[j + 1]),
            +coords[j + 2],
            +coords[j + 4] ? true : false,
            +coords[j + 3] ? true : false
          );
          current = end;
          path.arcTo(through, to);
          previous = lower;
        }
        break;
      case 'z':
        // Merge first and last segment with Numerical.EPSILON tolerance
        // to address imprecisions in relative SVG data.
        path.closePath(/*#=*/ Numerical.EPSILON);
        // Correctly handle relative m commands, see #1101:
        current = start;
        break;
    }
    previous = lower;
  }
  return path;
}

/**
 * SVGのarcTo(5引数)をpapyrusのarcTo(through, to)に変換する関数
 * paper.jsのロジックをそのまま移植
 */
export function arcToSvgLike(
  from: Point,
  to: Point,
  radius: Size,
  rotation: number,
  clockwise: boolean,
  large: boolean
): { through: Point; to: Point } {
  // #3: arcTo(to, radius, rotation, clockwise, large)
  // Draw arc in SVG style, but only if `from` and `to` are not equal (#1613).
  // If rx = 0 or ry = 0 then this arc is treated as a
  // straight line joining the endpoints.
  // NOTE: radius.isZero() would require both values to be 0.
  if (Numerical.isZero(radius.width) || Numerical.isZero(radius.height))
    return { through: to, to: to };
  // See for an explanation of the following calculations:
  // https://www.w3.org/TR/SVG/implnote.html#ArcImplementationNotes
  var middle = from.add(to).divide(2),
    pt = from.subtract(middle).rotate(-rotation),
    x = pt.x,
    y = pt.y,
    rx = Math.abs(radius.width),
    ry = Math.abs(radius.height),
    rxSq = rx * rx,
    rySq = ry * ry,
    xSq = x * x,
    ySq = y * y;
  // "...ensure radii are large enough"
  var factor = Math.sqrt(xSq / rxSq + ySq / rySq);
  if (factor > 1) {
    rx *= factor;
    ry *= factor;
    rxSq = rx * rx;
    rySq = ry * ry;
  }
  factor = (rxSq * rySq - rxSq * ySq - rySq * xSq) / (rxSq * ySq + rySq * xSq);
  if (Math.abs(factor) < /*#=*/ Numerical.EPSILON) factor = 0;
  if (factor < 0) throw new Error('Cannot create an arc with the given arguments');
  let center = new Point((rx * y) / ry, (-ry * x) / rx)
    // "...where the + sign is chosen if fA != fS,
    // and the - sign is chosen if fA = fS."
    .multiply((large === clockwise ? -1 : 1) * Math.sqrt(factor))
    .rotate(rotation)
    .add(middle);
  // Now create a matrix that maps the unit circle to the ellipse,
  // for easier construction below.
  let matrix = Matrix.identity().translate(center.x, center.y).rotate(rotation).scale(rx, ry);
  // Transform from and to to the unit circle coordinate space
  // and calculate start vector and extend from there.
  let vector = matrix.inverseTransform(from);
  let extent = vector!.getDirectedAngle(matrix.inverseTransform(to)!);
  // "...if fS = 0 and extent is > 0, then subtract 360, whereas
  // if fS = 1 and extend is < 0, then add 360."
  if (!clockwise && extent > 0) extent -= 360;
  else if (clockwise && extent < 0) extent += 360;
  // through点の計算（SVG実装ノートに従い、円弧の中間点を求める）
  // ここでは単純に円弧の中間角度での点を返す
  const angleRad = ((extent / 2) * Math.PI) / 180;
  const unit = vector!.rotate(extent / 2);
  const throughUnit = new Point(unit.x, unit.y);
  const through = matrix.transform(throughUnit);
  return { through, to };
}
