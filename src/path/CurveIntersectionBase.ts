/**
 * CurveIntersectionBase
 * 曲線交点計算の基本関数を提供するユーティリティ
 */

import { Curve } from './Curve';
import { CurveLocation } from './CurveLocation';
import { Numerical } from '../util/Numerical';
import { Point } from '../basic/Point';
import { CurveGeometry } from './CurveGeometry';

/**
 * 自己交差チェック
 * paper.jsのgetSelfIntersection実装を移植
 */
export function getSelfIntersection(
  v1: number[],
  c1: Curve,
  locations: CurveLocation[],
  include?: (loc: CurveLocation) => boolean
): CurveLocation[] {
  // paper.jsと同様の実装に修正
  const info = CurveGeometry.classify(v1);
  
  // ループ型の曲線の場合のみ交点を検出（paper.jsと同様）
  if (info.type === 'loop') {
    addLocation(locations, include,
      c1, info.roots![0],
      c1, info.roots![1]);
  }
  
  return locations;
}

/**
 * 交点情報を追加
 * paper.jsのaddLocation実装を移植
 */
export function addLocation(
  locations: CurveLocation[],
  include: ((loc: CurveLocation) => boolean) | undefined,
  c1: Curve,
  t1: number | null,
  c2: Curve,
  t2: number | null,
  overlap: boolean = false
): void {
  // Paper.jsと同様の実装
  // 端点の除外判定
  const excludeStart = !overlap && c1.getPrevious() === c2;
  const excludeEnd = !overlap && c1 !== c2 && c1.getNext() === c2;
  const tMin = Numerical.CURVETIME_EPSILON;
  const tMax = 1 - tMin;
  
  // 範囲チェック - paper.jsと同様の条件判定
  if (t1 !== null && t1 >= (excludeStart ? tMin : 0) && t1 <= (excludeEnd ? tMax : 1)) {
    if (t2 !== null && t2 >= (excludeEnd ? tMin : 0) && t2 <= (excludeStart ? tMax : 1)) {
      // Paper.jsと同様に、交点の座標をnullで初期化
      // 後で必要に応じて計算される
      const point: Point | null = null;
      
      // Paper.jsと同様に2つのCurveLocationを作成し、相互参照を設定
      // paper.jsでは、交点が見つかった時点でCurveLocationオブジェクトが作成され、
      // 後から曲線インデックスが設定される
      const loc1 = new CurveLocation(c1, t1, null, overlap);
      const loc2 = new CurveLocation(c2, t2, null, overlap);
      
      // 相互参照を設定
      loc1._intersection = loc2;
      loc2._intersection = loc1;
      
      // 拡張プロパティを設定（Papyrus2D互換性のため）
      loc1.curve2 = c2;
      loc1.t2 = t2;
      loc2.curve2 = c1;
      loc2.t2 = t1;
      
      // includeコールバックがなければ、または条件を満たせば追加
      if (!include || include(loc1)) {
        // Paper.jsと同様に、insertLocationを使用
        insertLocation(locations, loc1, true);
      }
    }
  }
}

/**
 * 重複する交点をフィルタリングしながら交点情報を挿入
 * paper.jsのCurveLocation.insert実装を移植
 */
export function insertLocation(locations: CurveLocation[], location: CurveLocation, includeOverlaps: boolean = false): number {
  const length = locations.length;
  
  // Paper.jsと同様に連結リストを構築
  if (length > 0) {
    let current = locations[length - 1];
    current._next = location;
    location._previous = current;
  }
  
  // Paper.jsと完全に同じ重複判定ロジックを実装
  const geomEpsilon = Numerical.GEOMETRIC_EPSILON;
  const curveEpsilon = Numerical.CURVETIME_EPSILON;
  
  // 既存の交点と比較して、近接している場合は追加しない
  for (let i = 0; i < length; i++) {
    const loc = locations[i];
    
    // 同じ曲線上の交点で、tパラメータが近い場合は重複とみなす
    if (loc.curve1 !== null && location.curve1 !== null &&
        loc.t1 !== null && location.t1 !== null &&
        loc.curve2 !== null && location.curve2 !== null &&
        loc.t2 !== null && location.t2 !== null) {
      // 曲線が同じかどうかをチェック（paper.jsと同様）
      const sameCurves =
        (loc.curve1 === location.curve1 && loc.curve2 === location.curve2) ||
        (loc.curve1 === location.curve2 && loc.curve2 === location.curve1);
      
      if (sameCurves) {
        // Paper.jsと同じ重複チェックロジック
        // 曲線が同じ場合、t1とt2を適切に比較
        let t1Diff: number, t2Diff: number;
        
        if (loc.curve1 === location.curve1) {
          t1Diff = Math.abs(loc.t1 - location.t1);
          t2Diff = Math.abs(loc.t2 - location.t2);
        } else {
          // 曲線が逆の場合、t1とt2を入れ替えて比較
          t1Diff = Math.abs(loc.t1 - location.t2);
          t2Diff = Math.abs(loc.t2 - location.t1);
        }
        
        // Paper.jsと同じ条件で重複判定
        if (t1Diff < curveEpsilon && t2Diff < curveEpsilon) {
          // 交点が既に存在する場合は、相互参照を更新
          if (location._intersection && loc._intersection) {
            // 既存の交点の相互参照を新しい交点の相互参照に更新
            loc._intersection._intersection = location._intersection;
            location._intersection._intersection = loc._intersection;
          }
          
          // 重複を許可する場合のみ追加
          if (includeOverlaps) {
            locations.push(location);
            return length;
          }
          return i;
        }
      }
    }
    
    // 点の距離が十分に近い場合は重複とみなす
    if (loc.point && location.point) {
      const dist = loc.point.subtract(location.point).getLength();
      if (dist < geomEpsilon) {
        // 交点が既に存在する場合は、相互参照を更新
        if (location._intersection && loc._intersection) {
          // 既存の交点の相互参照を新しい交点の相互参照に更新
          loc._intersection._intersection = location._intersection;
          location._intersection._intersection = loc._intersection;
        }
        
        // 重複を許可する場合のみ追加
        if (includeOverlaps) {
          locations.push(location);
          return length;
        }
        
        return i;
      }
    }
  }
  
  // 重複がない場合は追加
  locations.push(location);
  return length;
}