/**
 * CurveIntersectionMain
 * 曲線交点計算のメイン関数を提供するユーティリティ
 */

import { Curve } from './Curve';
import { CurveLocation } from './CurveLocation';
import { Numerical } from '../util/Numerical';
import { Point } from '../basic/Point';
import { Line } from '../basic/Line';
import { Matrix } from '../basic/Matrix';
import { CollisionDetection } from '../util/CollisionDetection';
import { CurveSubdivision } from './CurveSubdivision';
import { CurveLocationUtils } from './CurveLocationUtils';
import { addLocation, getSelfIntersection } from './CurveIntersectionBase';
import { addLineIntersection, addCurveLineIntersections } from './CurveIntersectionSpecial';
import { addCurveIntersections } from './CurveIntersectionConvexHull';

/**
 * 曲線同士の交点計算
 * paper.jsのgetCurveIntersections実装を移植
 */
export function getCurveIntersections(
  v1: number[],
  v2: number[],
  c1: Curve,
  c2: Curve,
  locations: CurveLocation[],
  include?: (loc: CurveLocation) => boolean
): CurveLocation[] {
  // 境界ボックスが完全に外れている場合はチェックしない
  const epsilon = Numerical.GEOMETRIC_EPSILON;
  const min = Math.min;
  const max = Math.max;

  // Paper.jsと同様の境界ボックスチェック - 正確に同じ条件判定を使用
  if (max(v1[0], v1[2], v1[4], v1[6]) + epsilon >
      min(v2[0], v2[2], v2[4], v2[6]) &&
      min(v1[0], v1[2], v1[4], v1[6]) - epsilon <
      max(v2[0], v2[2], v2[4], v2[6]) &&
      max(v1[1], v1[3], v1[5], v1[7]) + epsilon >
      min(v2[1], v2[3], v2[5], v2[7]) &&
      min(v1[1], v1[3], v1[5], v1[7]) - epsilon <
      max(v2[1], v2[3], v2[5], v2[7])) {
    
    // オーバーラップの検出と処理
    const overlaps = getOverlaps(v1, v2);
    // eslint-disable-next-line no-console
    if (overlaps) {
      for (let i = 0; i < overlaps.length; i++) {
        const overlap = overlaps[i];
        addLocation(locations, include,
                c1, overlap[0],
                c2, overlap[1], true);
      }
      // eslint-disable-next-line no-console
    } else {
      const straight1 = Curve.isStraight(v1);
      const straight2 = Curve.isStraight(v2);
      const straight = straight1 && straight2;
      const flip = straight1 && !straight2;
      const before = locations.length;
      
      // 直線か曲線かに基づいて適切な交点計算メソッドを決定
      if (straight) {
        // 両方直線の場合
        addLineIntersection(
          flip ? v2 : v1, flip ? v1 : v2,
          flip ? c2 : c1, flip ? c1 : c2,
          locations, include, flip);
        // eslint-disable-next-line no-console
      } else if (straight1 || straight2) {
        // 片方が直線の場合
        addCurveLineIntersections(
          flip ? v2 : v1, flip ? v1 : v2,
          flip ? c2 : c1, flip ? c1 : c2,
          locations, include, flip);
        // eslint-disable-next-line no-console
      } else {
        // 両方曲線の場合
        addCurveIntersections(
          flip ? v2 : v1, flip ? v1 : v2,
          flip ? c2 : c1, flip ? c1 : c2,
          locations, include, flip, 0, 0, 0, 1, 0, 1);
        // eslint-disable-next-line no-console
      }
      
      // Paper.jsと同様に、端点が重なる特殊ケースの処理を追加
      // 直線同士の交点が見つからなかった場合や、曲線の場合は端点のチェックを行う
      if (!straight || locations.length === before) {
        // 各曲線の端点をチェック - paper.jsと同じループ実装を使用
        for (let i = 0; i < 4; i++) {
          const t1 = i >> 1, // 0, 0, 1, 1
                t2 = i & 1,  // 0, 1, 0, 1
                i1 = t1 * 6,
                i2 = t2 * 6,
                p1 = new Point(v1[i1], v1[i1 + 1]),
                p2 = new Point(v2[i2], v2[i2 + 1]);
         if (p1.isClose(p2, epsilon)) {
           // 端点が近い場合でも、常にoverlapとしてマークするのではなく、
           // 自己交差の場合はoverlapをfalseにする
           const isOverlap = c1 === c2 ? false : true;
           addLocation(locations, include, c1, t1, c2, t2, isOverlap);
         }
        }
        // eslint-disable-next-line no-console
      }
    }
  }
  
  return locations;
}

/**
 * paper.jsのgetOverlaps実装
 * PATHITEM_INTERSECTIONS.mdに記載されている実装を使用
 */
export function getOverlaps(v1: number[], v2: number[]): [number, number][] | null {
  // 線形曲線は、共線の場合にのみ重複可能
  function getSquaredLineLength(v: number[]): number {
    const x = v[6] - v[0];
    const y = v[7] - v[1];
    return x * x + y * y;
  }

  const abs = Math.abs;
  // paper.jsと完全に同じgetSignedDistance実装
  // paper.jsと同様にLine.getDistanceを使用
  const getDistance = Line.getDistance;
  
  const timeEpsilon = Numerical.CURVETIME_EPSILON;
  const geomEpsilon = Numerical.GEOMETRIC_EPSILON;
  let straight1 = Curve.isStraight(v1);
  let straight2 = Curve.isStraight(v2);
  let straightBoth = straight1 && straight2;
  
  // Paper.jsと同様に、常に短い方の曲線をl1とする
  const flip = getSquaredLineLength(v1) < getSquaredLineLength(v2);
  const l1 = flip ? v2 : v1;
  const l2 = flip ? v1 : v2;
  
  // l1の始点と終点の値を取得
  const px = l1[0], py = l1[1];
  const vx = l1[6] - px, vy = l1[7] - py;
  
  // 曲線2の始点と終点がl1に十分近いかチェック
  // paper.jsと同じgetSignedDistanceを使用
  if (getDistance(px, py, vx, vy, l2[0], l2[1], true) < geomEpsilon &&
      getDistance(px, py, vx, vy, l2[6], l2[7], true) < geomEpsilon) {
    // 両方の曲線が直線でない場合、ハンドルもチェック
    if (!straightBoth &&
        getDistance(px, py, vx, vy, l1[2], l1[3], true) < geomEpsilon &&
        getDistance(px, py, vx, vy, l1[4], l1[5], true) < geomEpsilon &&
        getDistance(px, py, vx, vy, l2[2], l2[3], true) < geomEpsilon &&
        getDistance(px, py, vx, vy, l2[4], l2[5], true) < geomEpsilon) {
      straight1 = straight2 = straightBoth = true;
    }
  } else if (straightBoth) {
    // 両方の曲線が直線で、互いに十分近くない場合、解はない
    return null;
  }
  
  if ((straight1 && !straight2) || (!straight1 && straight2)) {
    // 一方の曲線が直線の場合、もう一方も直線でなければオーバーラップできない
    return null;
  }

  const v = [v1, v2];
  let pairs: [number, number][] = [];
  
  // すべての端点を反復処理
  for (let i = 0; i < 4 && pairs.length < 2; i++) {
    const i1 = i & 1;  // 0, 1, 0, 1
    const i2 = i1 ^ 1; // 1, 0, 1, 0
    const t1 = i >> 1; // 0, 0, 1, 1
    const p = new Point(
      v[i2][t1 ? 6 : 0],
      v[i2][t1 ? 7 : 1]
    );
    const t2 = CurveLocationUtils.getTimeOf(v[i1], p);
    
    if (t2 != null) {  // 点が曲線上にある場合
      const pair: [number, number] = i1 ? [t1, t2] : [t2, t1];
      // 小さなオーバーラップをフィルタリング
      if (!pairs.length ||
          abs(pair[0] - pairs[0][0]) > timeEpsilon &&
          abs(pair[1] - pairs[0][1]) > timeEpsilon) {
        pairs.push(pair);
      }
    }
    // Paper.jsと同様に、3点をチェックしたが一致が見つからない場合は早期終了
    if (i > 2 && !pairs.length)
      break;
  }
  
  // Paper.jsと同様に、ペアの数をチェック
  if (pairs.length !== 2) {
    return null;
  } else if (!straightBoth) {
    // 直線ペアはさらなるチェックが不要
    // 2つのペアが見つかった場合、v1とv2の端点は同じはず
    const o1 = CurveSubdivision.getPart(v1, pairs[0][0], pairs[1][0]);
    const o2 = CurveSubdivision.getPart(v2, pairs[0][1], pairs[1][1]);
    // オーバーラップする曲線のハンドルも同じかチェック
    if (abs(o2[2] - o1[2]) > geomEpsilon ||
        abs(o2[3] - o1[3]) > geomEpsilon ||
        abs(o2[4] - o1[4]) > geomEpsilon ||
        abs(o2[5] - o1[5]) > geomEpsilon) {
      return null;
    }
  }
  
  return pairs;
}

/**
 * 2つの曲線の交点を計算
 */
export function getIntersections(
  curves1: Curve[] | number[],
  curves2: Curve[] | number[] | null,
  include?: (loc: CurveLocation) => boolean,
  matrix1?: Matrix | null | undefined,
  matrix2?: Matrix | null | undefined,
  _returnFirst?: boolean
): CurveLocation[] {
  const epsilon = Numerical.GEOMETRIC_EPSILON;
  const self = !curves2;
  
  if (Array.isArray(curves1) && typeof curves1[0] === 'number') {
    // 数値配列の場合、Curveオブジェクトに変換
    const v1 = curves1 as number[];
    const v2 = curves2 as number[] | null;
    
    if (v2 && typeof v2[0] === 'number') {
      // 両方数値配列の場合
      const curve1 = CurveSubdivision.fromValues(v1);
      const curve2 = CurveSubdivision.fromValues(v2);
      const locations: CurveLocation[] = [];
      
      return getCurveIntersections(v1, v2, curve1, curve2, locations, include);
    } else if (!v2) {
      // 自己交差チェックの場合
      const curve = CurveSubdivision.fromValues(v1);
      const locations: CurveLocation[] = [];
      return getSelfIntersection(v1, curve, locations, include);
    }
  }
  
  if (self) {
    curves2 = curves1;
  }
  
  const curveArray1 = curves1 as Curve[];
  const curveArray2 = curves2 as Curve[];

  // デバッグ: カーブ配列の内容を出力
  // eslint-disable-next-line no-console
  // eslint-disable-next-line no-console
  // eslint-disable-next-line no-console
  for (let i = 0; i < curveArray1.length; i++) {
    const seg1 = curveArray1[i]._segment1.point;
    const seg2 = curveArray1[i]._segment2.point;
  }
  for (let i = 0; i < curveArray2.length; i++) {
    const seg1 = curveArray2[i]._segment1.point;
    const seg2 = curveArray2[i]._segment2.point;
  }

  const length1 = curveArray1.length;
  const length2 = curveArray2!.length;
  const values1: number[][] = new Array(length1);
  const values2 = self ? values1 : new Array(length2);
  const locations: CurveLocation[] = [];
  
  // 各曲線の値を取得（行列変換を適用）
  for (let i = 0; i < length1; i++) {
    values1[i] = curveArray1[i].getValues();
    if (matrix1) {
      // 行列変換を適用
      matrix1._transformCoordinates(values1[i], values1[i], 4);
    }
  }
  
  if (!self) {
    for (let i = 0; i < length2; i++) {
      values2[i] = curveArray2![i].getValues();
      if (matrix2) {
        // 行列変換を適用
        matrix2._transformCoordinates(values2[i], values2[i], 4);
      }
    }
  }
  
  const boundsCollisions = CollisionDetection.findCurveBoundsCollisions(
    values1, self ? values1 : values2, epsilon
  );
  
  // 各曲線の交点を計算
  for (let index1 = 0; index1 < length1; index1++) {
    const curve1 = curveArray1[index1];
    const v1 = values1[index1];
    
    if (self) {
      // 自己交差チェック
      getSelfIntersection(v1, curve1, locations, include);
    }
    
    // 潜在的に交差する曲線とのチェック
    const collisions1 = boundsCollisions[index1];
    if (collisions1) {
      for (let j = 0; j < collisions1.length; j++) {
        // 既に交点が見つかっていて、最初の交点だけを返す場合は早期リターン
        if (_returnFirst && locations.length) {
          return locations;
        }
        
        const index2 = collisions1[j];
        // 自己交差の場合は、重複チェックを避けるために index2 > index1 の場合のみ処理
        if (!self || index2 > index1) {
          const curve2 = curveArray2![index2];
          const v2 = values2[index2];
          
          // 曲線の交点を計算
          getCurveIntersections(
            v1, v2, curve1, curve2, locations, include
          );
          
          // paper.jsでは曲線インデックスはCurveLocationに直接保存せず、
          // 必要に応じてCurveオブジェクトから取得する
          // ここでは特に何もする必要がない
        }
      }
    }
  }
  
  return locations;
}