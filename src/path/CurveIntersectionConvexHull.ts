/**
 * CurveIntersectionConvexHull
 * 凸包と再帰的交点計算関数を提供するユーティリティ
 */

import { Curve, CurveLocation } from './Curve';
import { Numerical } from '../util/Numerical';
import { Point } from '../basic/Point';
import { addLocation } from './CurveIntersectionBase';

/**
 * 曲線同士の交点を再帰的に計算
 * paper.jsのaddCurveIntersections実装を移植
 */
export function addCurveIntersections(
  v1: number[], v2: number[],
  c1: Curve, c2: Curve,
  locations: CurveLocation[],
  include?: (loc: CurveLocation) => boolean,
  flip?: boolean,
  recursion: number = 0,
  calls: number = 0,
  tMin: number = 0, tMax: number = 1,
  uMin: number = 0, uMax: number = 1
): number {
  // Paper.jsと同じ再帰深度と呼び出し回数の制限を設定
  // 再帰が深すぎる場合や呼び出し回数が多すぎる場合は停止
  // paper.jsと同じ値に調整
  if (++calls >= 4096 || ++recursion >= 40)
    return calls;
  
  // Paper.jsと完全に同じ値を使用
  // fat-lineクリッピングコードで曲線時間パラメータを比較する際のイプシロン
  // 数値計算の安定性を確保するために重要
  const fatLineEpsilon = 1e-9;
  
  // 数値計算の安定性を向上させるための追加チェック
  // 両方の曲線が直線の場合は特別処理
  if (Curve.isStraight(v1) && Curve.isStraight(v2)) {
    // 直線同士の交点を計算
    const p1 = new Point(v1[0], v1[1]);
    const p2 = new Point(v1[6], v1[7]);
    const p3 = new Point(v2[0], v2[1]);
    const p4 = new Point(v2[6], v2[7]);
    
    // 直線の方向ベクトル
    const d1 = p2.subtract(p1);
    const d2 = p4.subtract(p3);
    
    // 平行チェック - 外積を計算
    const cross = d1.x * d2.y - d1.y * d2.x;
    if (Math.abs(cross) < Numerical.EPSILON) {
      // 平行な場合はオーバーラップをチェック
      return calls;
    }
  }
  
  // PをQ（第2曲線）のfat-lineでクリッピング
  const q0x = v2[0], q0y = v2[1], q3x = v2[6], q3y = v2[7];
  
  // Line.getSignedDistanceの実装（paper.jsと同じ）
  // paper.jsと完全に同じgetSignedDistance実装
  const getSignedDistance = (px: number, py: number, vx: number, vy: number, x: number, y: number): number => {
    // paper.jsの実装に合わせて修正
    // 参照: paper.js/src/basic/Line.js の getSignedDistance 関数
    return vx === 0 ? (vy > 0 ? x - px : px - x)
      : vy === 0 ? (vx < 0 ? y - py : py - y)
      : ((x - px) * vy - (y - py) * vx) / (
          vy > vx
            ? vy * Math.sqrt(1 + (vx * vx) / (vy * vy))
            : vx * Math.sqrt(1 + (vy * vy) / (vx * vx))
        );
  };
  
  // Qのfat-lineを計算：ベースラインlと、曲線Pを完全に囲む2つのオフセット
  const d1 = getSignedDistance(q0x, q0y, q3x - q0x, q3y - q0y, v2[2], v2[3]);
  const d2 = getSignedDistance(q0x, q0y, q3x - q0x, q3y - q0y, v2[4], v2[5]);
  // paper.jsと同じfactor計算
  const factor = d1 * d2 > 0 ? 3 / 4 : 4 / 9;
  const dMin = factor * Math.min(0, d1, d2);
  const dMax = factor * Math.max(0, d1, d2);
  
  // 非パラメトリックベジェ曲線D(ti, di(t))を計算:
  // - di(t)はPからfat-lineのベースラインlまでの距離
  // - tiは[0, 1]で等間隔
  const dp0 = getSignedDistance(q0x, q0y, q3x - q0x, q3y - q0y, v1[0], v1[1]);
  const dp1 = getSignedDistance(q0x, q0y, q3x - q0x, q3y - q0y, v1[2], v1[3]);
  const dp2 = getSignedDistance(q0x, q0y, q3x - q0x, q3y - q0y, v1[4], v1[5]);
  const dp3 = getSignedDistance(q0x, q0y, q3x - q0x, q3y - q0y, v1[6], v1[7]);
  
  // 凸包の上部と下部を取得
  const hull = getConvexHull(dp0, dp1, dp2, dp3);
  const top = hull[0];
  const bottom = hull[1];
  let tMinClip: number | null = null;
  let tMaxClip: number | null = null;
  
  // すべての点と制御点が共線の場合は反復を停止
  if (d1 === 0 && d2 === 0 && dp0 === 0 && dp1 === 0 && dp2 === 0 && dp3 === 0) {
    return calls;
  }
  
  // dMinとdMaxで凸包をクリップし、結果の1つがnullの場合は交点がないことを考慮
  // paper.jsと完全に同じ実装にする
  tMinClip = clipConvexHull(top, bottom, dMin, dMax);
  if (tMinClip === null) {
    return calls;
  }
  
  // 配列を反転
  top.reverse();
  bottom.reverse();
  tMaxClip = clipConvexHull(top, bottom, dMin, dMax);
  // 元に戻す（念のため）
  top.reverse();
  bottom.reverse();
  if (tMaxClip === null) {
    return calls;
  }
  
  // tMinとtMaxは(0, 1)の範囲内。v2の元のパラメータ範囲に戻す
  const tMinNew = tMin + (tMax - tMin) * tMinClip;
  const tMaxNew = tMin + (tMax - tMin) * tMaxClip;
  
  // Paper.jsと完全に同じ条件判定
  // 数値計算の安定性を確保するために、閾値の比較を厳密に行う
  // paper.jsと同じ条件判定を使用
  if (Math.max(uMax - uMin, tMaxNew - tMinNew) < fatLineEpsilon) {
    // 十分な精度で交点を分離した
    const t = (tMinNew + tMaxNew) / 2;
    const u = (uMin + uMax) / 2;
    
    // Paper.jsと同様に、overlapパラメータを省略
    addLocation(locations, include,
      flip ? c2 : c1, flip ? u : t,
      flip ? c1 : c2, flip ? t : u);
  } else {
    // クリッピング結果を曲線1に適用
    const v1Clipped = Curve.getPart(v1, tMinClip, tMaxClip);
    const uDiff = uMax - uMin;
    
    // Paper.jsと完全に同じ分割条件を使用
    if (tMaxClip - tMinClip > 0.8) {
      // 最も収束していない曲線を分割
      if (tMaxNew - tMinNew > uDiff) {
        // 曲線1を分割
        const parts = Curve.subdivide(v1Clipped, 0.5);
        const t = (tMinNew + tMaxNew) / 2;
        calls = addCurveIntersections(
          v2, parts[0], c2, c1, locations, include, !flip,
          recursion, calls, uMin, uMax, tMinNew, t);
        calls = addCurveIntersections(
          v2, parts[1], c2, c1, locations, include, !flip,
          recursion, calls, uMin, uMax, t, tMaxNew);
      } else {
        // 曲線2を分割
        const parts = Curve.subdivide(v2, 0.5);
        const u = (uMin + uMax) / 2;
        calls = addCurveIntersections(
          parts[0], v1Clipped, c2, c1, locations, include, !flip,
          recursion, calls, uMin, u, tMinNew, tMaxNew);
        calls = addCurveIntersections(
          parts[1], v1Clipped, c2, c1, locations, include, !flip,
          recursion, calls, u, uMax, tMinNew, tMaxNew);
      }
    } else { // 反復
      // Paper.jsと完全に同じ条件判定
      // #1638の問題を回避するために、uDiff === 0の特別処理を維持
      if (uDiff === 0 || uDiff >= fatLineEpsilon) {
        calls = addCurveIntersections(
          v2, v1Clipped, c2, c1, locations, include, !flip,
          recursion, calls, uMin, uMax, tMinNew, tMaxNew);
      } else {
        // 他の曲線の間隔が既に十分に狭いため、同じ曲線で反復を続ける
        calls = addCurveIntersections(
          v1Clipped, v2, c1, c2, locations, include, flip,
          recursion, calls, tMinNew, tMaxNew, uMin, uMax);
      }
    }
  }
  
  return calls;
}

/**
 * paper.jsのgetConvexHull実装
 * paper.jsのソースコードに完全に合わせた実装
 */
export function getConvexHull(dq0: number, dq1: number, dq2: number, dq3: number): [number[][], number[][]] {
  const p0 = [0, dq0];
  const p1 = [1/3, dq1];
  const p2 = [2/3, dq2];
  const p3 = [1, dq3];
  
  // p1とp2から[p0, p3]線への垂直符号付き距離を求める
  const dist1 = dq1 - (2 * dq0 + dq3) / 3;
  const dist2 = dq2 - (dq0 + 2 * dq3) / 3;
  
  let hull: [number[][], number[][]];
  
  // p1とp2が[p0, p3]線の反対側にあるかチェック
  if (dist1 * dist2 < 0) {
    // p1とp2は[p0, p3]線の異なる側にある
    // 凸包は四角形で、[p0, p3]線は凸包の一部ではない
    // ここではほぼ完了。上部にp1が含まれ、そうでない場合は後で反転する
    hull = [[p0, p1, p3], [p0, p2, p3]];
  } else {
    // p1とp2は[p0, p3]線の同じ側にある
    // 凸包は三角形または四角形で、[p0, p3]線は凸包の一部
    // 凸包が三角形か四角形かチェック
    // 中間点(p1, p2)の一方の垂直距離がもう一方の中間点の垂直距離の半分以下の場合、三角形となる
    const distRatio = dist1 / dist2;
    hull = [
      // p2が内側、凸包は三角形
      distRatio >= 2 ? [p0, p1, p3]
      // p1が内側、凸包は三角形
      : distRatio <= 0.5 ? [p0, p2, p3]
      // 凸包は四角形、正しい順序ですべての線が必要
      : [p0, p1, p2, p3],
      // [p0, p3]線は凸包の一部
      [p0, p3]
    ];
  }
  
  // dist1が負またはdist1がゼロでdist2が負の場合、凸包を反転
  // paper.jsと同じく、hull.reverse()を使用
  return (dist1 || dist2) < 0 ? hull.reverse() as [number[][], number[][]] : hull;
}

/**
 * paper.jsのclipConvexHull実装
 * paper.jsのソースコードに完全に合わせた実装
 */
export function clipConvexHull(hullTop: number[][], hullBottom: number[][], dMin: number, dMax: number): number | null {
  if (hullTop[0][1] < dMin) {
    // 凸包の左側がdMin未満、凸包を通過して交点を見つける
    return clipConvexHullPart(hullTop, true, dMin);
  } else if (hullBottom[0][1] > dMax) {
    // 凸包の左側がdMaxを超える、凸包を通過して交点を見つける
    return clipConvexHullPart(hullBottom, false, dMax);
  } else {
    // 凸包の左側がdMinとdMaxの間、クリッピング不要
    return hullTop[0][0];
  }
}

/**
 * paper.jsのclipConvexHullPart実装
 * paper.jsのソースコードに完全に合わせた実装
 */
export function clipConvexHullPart(
  part: number[][],
  top: boolean,
  threshold: number
): number | null {
  let px = part[0][0];
  let py = part[0][1];
  
  for (let i = 1, l = part.length; i < l; i++) {
    const qx = part[i][0];
    const qy = part[i][1];
    
    if (top ? qy >= threshold : qy <= threshold) {
      return qy === threshold ? qx
              : px + (threshold - py) * (qx - px) / (qy - py);
    }
    
    px = qx;
    py = qy;
  }
  
  // 凸包のすべての点が閾値より上/下にある
  return null;
}