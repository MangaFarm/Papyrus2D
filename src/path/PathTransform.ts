import { Matrix } from '../basic/Matrix';
import { Point } from '../basic/Point';
import type { Path } from './Path';
import type { Segment } from './Segment';
import type { Curve } from './Curve';

/**
 * Pathのトランスフォーム系関数群
 * - paper.js Path.jsの該当部分を移植
 * - Path.tsから呼び出される
 */

export function transform(path: Path, matrix: Matrix): Path {
  path._matrix = matrix;
  path._matrixDirty = true;
  path._length = path._area = undefined;
  path._bounds = undefined;
  return path;
}

export function translate(path: Path, dx: number, dy: number): Path {
  if (!path._matrix) {
    path._matrix = Matrix.identity();
  }
  path._matrix = path._matrix.translate(dx, dy);
  path._matrixDirty = true;
  path._length = path._area = undefined;
  path._bounds = undefined;
  return path;
}

export function rotate(path: Path, angle: number, center?: Point): Path {
  if (!path._matrix) {
    path._matrix = Matrix.identity();
  }
  path._matrix = path._matrix.rotate(angle, center);
  path._matrixDirty = true;
  path._length = path._area = undefined;
  path._bounds = undefined;
  return path;
}

export function scale(path: Path, sx: number, sy?: number, center?: Point): Path {
  if (!path._matrix) {
    path._matrix = Matrix.identity();
  }
  path._matrix = path._matrix.scale(sx, sy, center);
  path._matrixDirty = true;
  path._length = path._area = undefined;
  path._bounds = undefined;

  // カーブのキャッシュもクリア
  if (path._curves) {
    for (let i = 0, l = path._curves.length; i < l; i++) {
      path._curves[i]._changed();
    }
  }

  // セグメントを直接変換して、カーブの長さを正しく更新
  const segments = path._segments;
  const actualSy = sy === undefined ? sx : sy;
  const centerPoint = center || new Point(0, 0);

  for (let i = 0, l = segments.length; i < l; i++) {
    const segment = segments[i];

    // SegmentPointオブジェクトを直接操作
    const point = segment._point;
    const handleIn = segment._handleIn;
    const handleOut = segment._handleOut;

    // 点を変換
    const px = point._x;
    const py = point._y;
    point._set(
      centerPoint.x + (px - centerPoint.x) * sx,
      centerPoint.y + (py - centerPoint.y) * actualSy
    );

    // ハンドルを変換（ハンドルは相対座標なので中心点は考慮しない）
    handleIn._set(handleIn._x * sx, handleIn._y * actualSy);
    handleOut._set(handleOut._x * sx, handleOut._y * actualSy);
  }

  return path;
}