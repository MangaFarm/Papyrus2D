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
import { PathConstructors } from './PathConstructors';
import { Matrix } from '../basic/Matrix';
// Baseはpaper.jsのユーティリティ。ここでは引数配列から値を取り出すだけなので仮実装
const Base = {
  read(args: any[]): any {
    return args.shift();
  }
};

/**
 * SVG出力用の数値フォーマッタ（paper.js互換、最小限）
 */
class Formatter {
  private precision: number;
  constructor(precision: number) {
    this.precision = precision;
  }
  number(n: number): string {
    return +n.toFixed(this.precision) + '';
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
  var segments = this._segments,
    length = segments.length,
    f = new Formatter(precision),
    coords = new Array(6),
    first = true,
    curX,
    curY,
    prevX,
    prevY,
    inX,
    inY,
    outX,
    outY,
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
          parts.push(
            dx === 0 ? 'v' + f.number(dy) : dy === 0 ? 'h' + f.number(dx) : 'l' + f.pair(dx, dy)
          );
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
  if (this._closed && length > 0) {
    addSegment(segments[0], true);
    parts.push('z');
  }
  return parts.join('');
}

/**
 * SVGパスデータ文字列からPathを生成
 * ※最低限 M, L, C, Z, h, v, H, V, z, 複数サブパス対応
 */
export function fromPathData(data: string): Path {
  // NOTE: #getPathData() is defined in CompoundPath / Path
  // This is a very compact SVG Path Data parser that works both for Path
  // and CompoundPath.
  // ...（省略、既存内容そのまま）...
}

/**
 * SVGパスデータからPathを生成（fromSVGのエイリアス）
 */
export function fromSVG(svg: string): Path {
  return fromPathData(svg);
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
): { through: Point, to: Point } {
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
  factor = (rxSq * rySq - rxSq * ySq - rySq * xSq) /
          (rxSq * ySq + rySq * xSq);
  if (Math.abs(factor) < /*#=*/Numerical.EPSILON)
      factor = 0;
  if (factor < 0)
      throw new Error(
              'Cannot create an arc with the given arguments');
  let center = new Point(rx * y / ry, -ry * x / rx)
          // "...where the + sign is chosen if fA != fS,
          // and the - sign is chosen if fA = fS."
          .multiply((large === clockwise ? -1 : 1) * Math.sqrt(factor))
          .rotate(rotation).add(middle);
  // Now create a matrix that maps the unit circle to the ellipse,
  // for easier construction below.
  let matrix = Matrix.identity().translate(center.x, center.y).rotate(rotation)
          .scale(rx, ry);
  // Transform from and to to the unit circle coordinate space
  // and calculate start vector and extend from there.
  let vector = matrix.inverseTransform(from);
  let extent = vector!.getDirectedAngle(matrix.inverseTransform(to)!);
  // "...if fS = 0 and extent is > 0, then subtract 360, whereas
  // if fS = 1 and extend is < 0, then add 360."
  if (!clockwise && extent > 0)
      extent -= 360;
  else if (clockwise && extent < 0)
      extent += 360;
  // through点の計算（SVG実装ノートに従い、円弧の中間点を求める）
  // ここでは単純に円弧の中間角度での点を返す
  const angleRad = (extent / 2) * Math.PI / 180;
  const unit = vector!.rotate(extent / 2);
  const throughUnit = new Point(unit.x, unit.y);
  const through = matrix.transform(throughUnit);
  return { through, to };
}
