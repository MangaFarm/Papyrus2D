/**
 * PathArc.ts
 * paper.jsのPath.arcToメソッドを移植したもの
 */

import { Point } from '../basic/Point';
import { Matrix } from '../basic/Matrix';
import { Segment } from './Segment';
import { Path } from './Path';
import { Numerical } from '../util/Numerical';
import { Line } from '../basic/Line';
import { Size } from '../basic/Size';

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
  static arcTo(path: Path, ...args: any[]): Path {
    // 現在のセグメントを取得
    const segments = path.getSegments();
    if (segments.length === 0) {
      throw new Error('Use a moveTo() command first');
    }
    
    const current = segments[segments.length - 1];
    const from = current.getPoint();
    let to: Point;
    let through: Point | null = null;
    let clockwise = true;
    let center: Point | null = null;
    let extent = 0;
    let vector: Point | null = null;
    let matrix: Matrix | null = null;
    
    // 引数の解析
    if (typeof args[1] === 'boolean' || args[1] === undefined) {
      // 形式1: arcTo(to, clockwise)
      to = args[0] instanceof Point ? args[0].clone() : new Point(args[0].x, args[0].y);
      clockwise = args[1] !== undefined ? !!args[1] : true; // デフォルトはtrue
      
      // 中間点を計算
      const middle = from.add(to).divide(2);
      through = middle.add(middle.subtract(from).rotate(
        clockwise ? -90 : 90
      ));
    } else if (args[1] && (args[1] as any).x !== undefined) {
      // 形式2: arcTo(through, to)
      through = args[0] instanceof Point ? args[0].clone() : new Point(args[0].x, args[0].y);
      to = args[1] instanceof Point ? args[1].clone() : new Point(args[1].x, args[1].y);
    } else {
      // 形式3: arcTo(to, radius, rotation, clockwise, large)
      to = args[0] instanceof Point ? args[0].clone() : new Point(args[0].x, args[0].y);
      
      // fromとtoが等しい場合は何もしない
      if (from.equals(to)) {
        return path;
      }
      
      const radius = args[1] instanceof Size ? args[1] : new Size(args[1].width, args[1].height);
      
      // radiusが0の場合は直線を描画
      if (Numerical.isZero(radius.width) || Numerical.isZero(radius.height)) {
        path.lineTo(to);
        return path;
      }
      
      const rotation = args[2];
      clockwise = args[3] !== undefined ? !!args[3] : true;
      const large = !!args[4];
      
      // SVGスタイルの円弧計算
      const middle = from.add(to).divide(2);
      const pt = from.subtract(middle).rotate(-rotation);
      const x = pt.x;
      const y = pt.y;
      let rx = Math.abs(radius.width);
      let ry = Math.abs(radius.height);
      let rxSq = rx * rx;
      let rySq = ry * ry;
      const xSq = x * x;
      const ySq = y * y;
      
      // 半径が十分大きいことを確認
      let factor = Math.sqrt(xSq / rxSq + ySq / rySq);
      if (factor > 1) {
        rx *= factor;
        ry *= factor;
        rxSq = rx * rx;
        rySq = ry * ry;
      }
      
      factor = (rxSq * rySq - rxSq * ySq - rySq * xSq) / (rxSq * ySq + rySq * xSq);
      if (Math.abs(factor) < Numerical.EPSILON) {
        factor = 0;
      }
      if (factor < 0) {
        throw new Error('Cannot create an arc with the given arguments');
      }
      
      center = new Point(rx * y / ry, -ry * x / rx)
        .multiply((large === clockwise ? -1 : 1) * Math.sqrt(factor))
        .rotate(rotation).add(middle);
      
      // 行列を作成して単位円から楕円への変換を容易にする
      matrix = Matrix.identity();
      matrix = matrix.translate(center.x, center.y).rotate(rotation).scale(rx, ry);
      
      // fromとtoを単位円座標空間に変換し、そこから開始ベクトルと範囲を計算
      vector = matrix.inverseTransform(from);
      if (vector) {
        const transformedTo = matrix.inverseTransform(to);
        if (transformedTo) {
          extent = vector.getDirectedAngle(transformedTo);
          
          // 円弧の方向を調整
          if (!clockwise && extent > 0) {
            extent -= 360;
          } else if (clockwise && extent < 0) {
            extent += 360;
          }
        }
      }
    }
    
    if (through && !center) {
      // through点がある場合の処理
      // 2つの垂直二等分線を構築し、それらの交点を中心とする
      const l1 = new Line(from.add(through).divide(2),
        through.subtract(from).rotate(90));
      const l2 = new Line(through.add(to).divide(2),
        to.subtract(through).rotate(90));
      const line = new Line(from, to);
      const throughSide = line.getSide(through);
      
      const intersection = l1.intersect(l2);
      if (intersection) {
        center = intersection;
      }
      
      // 2つの線が同一直線上にある場合、円弧は無限大の円の一部となり、
      // 中心点がないため、直線を使用するか、エラーを投げる
      if (!center) {
        if (!throughSide) {
          path.lineTo(to);
          return path;
        }
        throw new Error('Cannot create an arc with the given arguments');
      }
      
      vector = from.subtract(center);
      extent = vector.getDirectedAngle(to.subtract(center));
      
      const centerSide = line.getSide(center);
      if (centerSide === 0) {
        // 中心が線上にある場合、through点の側に基づいて範囲の符号を決定
        extent = throughSide * Math.abs(extent);
      } else if (throughSide === centerSide) {
        // 中心がthrough点と同じ側にある場合、180度未満の範囲を拡張
        extent += extent < 0 ? 360 : -360;
      }
    }
    
    if (extent && vector && center) {
      // 円弧を描画
      const epsilon = Numerical.ANGULAR_EPSILON;
      const ext = Math.abs(extent);
      // 90度ごとにセグメントを分割（最大4セグメント）
      const count = ext >= 360 ? 4 : Math.ceil((ext - epsilon) / 90);
      const inc = extent / count;
      const half = inc * Math.PI / 360;
      const z = 4 / 3 * Math.sin(half) / (1 + Math.cos(half));
      
      const newSegments: Segment[] = [];
      let currentVector = vector.clone();
      
      for (let i = 0; i <= count; i++) {
        let pt: Point;
        let outHandle: Point | null = null;
        let inHandle: Point | null = null;
        
        if (i < count) {
          outHandle = currentVector.rotate(90).multiply(z);
          if (matrix) {
            pt = matrix.transform(currentVector);
            outHandle = matrix.transform(currentVector.add(outHandle)).subtract(pt);
          } else {
            pt = center.add(currentVector);
          }
        } else {
          // 最後のセグメントでは、正確な終点を使用
          pt = to.clone();
        }
        
        if (!i) {
          // 最初のセグメントのハンドルを設定
          current.setHandleOut(outHandle ? outHandle : new Point(0, 0));
        } else {
          // 新しいセグメントを追加
          inHandle = currentVector.rotate(-90).multiply(z);
          if (matrix) {
            inHandle = matrix.transform(currentVector.add(inHandle)).subtract(pt);
          }
          newSegments.push(new Segment(pt, inHandle, outHandle));
        }
        
        currentVector = currentVector.rotate(inc);
      }
      
      // すべてのセグメントを一度に追加
      path.addSegments(newSegments);
    }
    
    return path;
  }
}