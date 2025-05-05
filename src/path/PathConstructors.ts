/**
 * PathConstructors.ts - Path静的コンストラクタメソッド
 * Paper.jsのPath.Constructors.jsを参考に実装
 */

import { Point } from '../basic/Point';
import { Size } from '../basic/Size';
import { Rectangle } from '../basic/Rectangle';
import { Numerical } from '../util/Numerical';
import { Segment } from './Segment';
import { Path } from './Path';

// KAPPAは円や楕円をベジェ曲線で近似する際の制御点の係数
const kappa = Numerical.KAPPA;

/**
 * 楕円の基本セグメント（単位円）を生成する関数
 * グローバルな初期化ではなく必要時に生成することで循環参照を回避
 */
function getEllipseSegments(): Segment[] {
  return [
    new Segment(new Point(-1, 0), new Point(0, kappa), new Point(0, -kappa)),
    new Segment(new Point(0, -1), new Point(-kappa, 0), new Point(kappa, 0)),
    new Segment(new Point(1, 0), new Point(0, -kappa), new Point(0, kappa)),
    new Segment(new Point(0, 1), new Point(kappa, 0), new Point(-kappa, 0))
  ];
}

// 型定義
interface PointLike {
  x: number;
  y: number;
}

interface SizeLike {
  width: number;
  height: number;
}

interface RectangleLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FromToObject {
  from: Point | PointLike;
  to: Point | PointLike;
}

interface PointSizeObject {
  point: Point | PointLike;
  size: Size | SizeLike;
}

interface CenterRadiusObject {
  center: Point | PointLike;
  radius: number | Size | SizeLike;
}

type RectangleArg = Rectangle | RectangleLike | FromToObject | PointSizeObject;

/**
 * セグメントからパスを作成する内部ヘルパー関数
 */
function createPath(segments: Segment[], closed: boolean): Path {
  const path = new Path(segments, closed);
  return path;
}

/**
 * 楕円パスを作成する内部ヘルパー関数
 */
function createEllipse(center: Point, radius: Point | Size): Path {
  // 基本セグメントを取得（必要時だけ生成）
  const baseSegments = getEllipseSegments();
  const segments = new Array(4);
  
  for (let i = 0; i < 4; i++) {
    const segment = baseSegments[i];
    // Sizeの場合はPointに変換
    const radiusPoint = radius instanceof Size
      ? new Point(radius.width, radius.height)
      : radius;
    
    segments[i] = new Segment(
      segment.getPoint().multiply(radiusPoint).add(center),
      segment.getHandleIn().multiply(radiusPoint),
      segment.getHandleOut().multiply(radiusPoint)
    );
  }
  return createPath(segments, true);
}

/**
 * PointLikeオブジェクトからPointを作成するヘルパー関数
 */
function pointFrom(obj: Point | PointLike): Point {
  if (obj instanceof Point) {
    return obj;
  }
  return new Point(obj.x, obj.y);
}

/**
 * SizeLikeオブジェクトからSizeを作成するヘルパー関数
 */
function sizeFrom(obj: Size | SizeLike | number): Size {
  if (obj instanceof Size) {
    return obj;
  }
  if (typeof obj === 'number') {
    return new Size(obj, obj);
  }
  return new Size(obj.width, obj.height);
}

/**
 * Path静的コンストラクタメソッド
 */
export const PathConstructors = {
  /**
   * 2点間の直線パスを作成
   * @param from 始点
   * @param to 終点
   * @returns 新しいパス
   */
  Line: function(from: Point | PointLike, to: Point | PointLike): Path {
    return createPath([
      new Segment(pointFrom(from)),
      new Segment(pointFrom(to))
    ], false);
  },

  /**
   * 円形のパスを作成
   * @param center 中心点
   * @param radius 半径
   * @returns 新しいパス
   */
  Circle: function(center: Point | PointLike, radius: number): Path {
    const centerPoint = pointFrom(center);
    // paper.jsと同様に、半径をSizeオブジェクトとして渡す
    // 面積計算が正しくなるように実装
    return createEllipse(centerPoint, new Size(radius, radius));
  },

  /**
   * 矩形のパスを作成
   * @param rectangle 矩形オブジェクト
   * @param radius 角の丸み（オプション）
   * @returns 新しいパス
   */
  Rectangle: function(rectangle: RectangleArg, radius?: number | Size | SizeLike): Path {
    // 矩形の取得
    let rect: Rectangle;
    
    if (rectangle instanceof Rectangle) {
      rect = rectangle;
    } else if ('x' in rectangle && 'y' in rectangle && 'width' in rectangle && 'height' in rectangle) {
      // RectangleLike
      rect = new Rectangle(
        rectangle.x, 
        rectangle.y, 
        rectangle.width, 
        rectangle.height
      );
    } else if ('from' in rectangle && 'to' in rectangle) {
      // FromToObject
      const from = pointFrom(rectangle.from);
      const to = pointFrom(rectangle.to);
      rect = new Rectangle(
        Math.min(from.x, to.x),
        Math.min(from.y, to.y),
        Math.abs(to.x - from.x),
        Math.abs(to.y - from.y)
      );
    } else if ('point' in rectangle && 'size' in rectangle) {
      // PointSizeObject
      const point = pointFrom(rectangle.point);
      const size = sizeFrom(rectangle.size);
      rect = new Rectangle(point.x, point.y, size.width, size.height);
    } else {
      throw new Error('Invalid Rectangle constructor arguments');
    }

    const bl = new Point(rect.x, rect.y + rect.height);
    const tl = new Point(rect.x, rect.y);
    const tr = new Point(rect.x + rect.width, rect.y);
    const br = new Point(rect.x + rect.width, rect.y + rect.height);
    
    let segments: Segment[];
    
    if (!radius || (radius instanceof Size && radius.width === 0 && radius.height === 0) || 
        (typeof radius === 'number' && radius === 0)) {
      // 角丸なしの矩形
      // paper.jsと同じ順序でセグメントを作成（左下、左上、右上、右下）
      // 面積計算が正しくなるように実装
      segments = [
        new Segment(bl),
        new Segment(tl),
        new Segment(tr),
        new Segment(br)
      ];
    } else {
      // 角丸あり矩形
      const radiusSize = sizeFrom(radius);
      
      // 半径が矩形の半分を超えないようにする
      const rx = Math.min(radiusSize.width, rect.width / 2);
      const ry = Math.min(radiusSize.height, rect.height / 2);
      
      const hx = rx * kappa;
      const hy = ry * kappa;
      
      segments = [
        new Segment(new Point(bl.x + rx, bl.y), null, new Point(-hx, 0)),
        new Segment(new Point(bl.x, bl.y - ry), new Point(0, hy)),
        new Segment(new Point(tl.x, tl.y + ry), null, new Point(0, -hy)),
        new Segment(new Point(tl.x + rx, tl.y), new Point(-hx, 0), null),
        new Segment(new Point(tr.x - rx, tr.y), null, new Point(hx, 0)),
        new Segment(new Point(tr.x, tr.y + ry), new Point(0, -hy), null),
        new Segment(new Point(br.x, br.y - ry), null, new Point(0, hy)),
        new Segment(new Point(br.x - rx, br.y), new Point(hx, 0))
      ];
    }
    
    return createPath(segments, true);
  },

  /**
   * 楕円形のパスを作成
   * @param rectangle 楕円を囲む矩形
   * @returns 新しいパス
   */
  Ellipse: function(rectangle: RectangleArg | CenterRadiusObject): Path {
    let rect: Rectangle;
    
    if (rectangle instanceof Rectangle) {
      rect = rectangle;
    } else if ('x' in rectangle && 'y' in rectangle && 'width' in rectangle && 'height' in rectangle) {
      // RectangleLike
      rect = new Rectangle(
        rectangle.x, 
        rectangle.y, 
        rectangle.width, 
        rectangle.height
      );
    } else if ('center' in rectangle && 'radius' in rectangle) {
      // CenterRadiusObject
      const center = pointFrom(rectangle.center);
      const radius = sizeFrom(rectangle.radius);
      
      rect = new Rectangle(
        center.x - radius.width, 
        center.y - radius.height,
        radius.width * 2, 
        radius.height * 2
      );
    } else if ('point' in rectangle && 'size' in rectangle) {
      // PointSizeObject
      const point = pointFrom(rectangle.point);
      const size = sizeFrom(rectangle.size);
      rect = new Rectangle(point.x, point.y, size.width, size.height);
    } else {
      throw new Error('Invalid Ellipse constructor arguments');
    }
    
    const center = new Point(rect.x + rect.width / 2, rect.y + rect.height / 2);
    const radius = new Point(rect.width / 2, rect.height / 2);
    
    return createEllipse(center, radius);
  },

  /**
   * 円弧のパスを作成
   * @param from 始点
   * @param through 通過点
   * @param to 終点
   * @returns 新しいパス
   */
  Arc: function(from: Point | PointLike, through: Point | PointLike, to: Point | PointLike): Path {
    const fromPoint = pointFrom(from);
    const throughPoint = pointFrom(through);
    const toPoint = pointFrom(to);
    
    const path = new Path();
    path.moveTo(fromPoint);
    
    // arcToメソッドがない場合は、cubicCurveToで代用
    if ('arcTo' in path) {
      (path as any).arcTo(throughPoint, toPoint);
    } else {
      // 簡易的な円弧の近似（実際にはもっと複雑な計算が必要）
      const v1 = fromPoint.subtract(throughPoint);
      const v2 = toPoint.subtract(throughPoint);
      const handleOut = v1.multiply(0.5);
      const handleIn = v2.multiply(0.5);
      
      // 型アサーションでType Errorを回避
      (path as Path).cubicCurveTo(
        fromPoint.subtract(handleOut),
        toPoint.add(handleIn),
        toPoint
      );
    }
    
    return path;
  },

  /**
   * 正多角形のパスを作成
   * @param center 中心点
   * @param sides 辺の数
   * @param radius 半径
   * @returns 新しいパス
   */
  RegularPolygon: function(center: Point | PointLike, sides: number, radius: number): Path {
    const centerPoint = pointFrom(center);
    const step = 360 / sides;
    const three = sides % 3 === 0;
    const vector = new Point(0, three ? -radius : radius);
    const offset = three ? -1 : 0.5;
    const segments: Segment[] = [];
    
    for (let i = 0; i < sides; i++) {
      segments.push(new Segment(centerPoint.add(
        vector.rotate((i + offset) * step)
      )));
    }
    
    return createPath(segments, true);
  },

  /**
   * 星形のパスを作成
   * @param center 中心点
   * @param points 星の頂点の数
   * @param radius1 内側の半径
   * @param radius2 外側の半径
   * @returns 新しいパス
   */
  Star: function(center: Point | PointLike, points: number, radius1: number, radius2: number): Path {
    const centerPoint = pointFrom(center);
    points = points * 2; // 内外の頂点の合計数
    const step = 360 / points;
    const vector = new Point(0, -1);
    const segments: Segment[] = [];
    
    for (let i = 0; i < points; i++) {
      segments.push(new Segment(centerPoint.add(
        vector.rotate(step * i).multiply(i % 2 ? radius2 : radius1)
      )));
    }
    
    return createPath(segments, true);
  }
};