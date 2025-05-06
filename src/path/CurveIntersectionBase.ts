/**
 * CurveIntersectionBase
 * 曲線交点計算の基本関数を提供するユーティリティ
 */

import { Curve } from './Curve';
import { CurveLocation } from './CurveLocation';
import { Numerical } from '../util/Numerical';
import { Point } from '../basic/Point';
import { CurveGeometry } from './CurveGeometry';
import { getMeta } from './SegmentMeta';

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
    // 自己交差の場合はoverlapをfalseに設定
    addLocation(locations, include,
      c1, info.roots![0],
      c1, info.roots![1],
      false);
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
  // paper.jsのaddLocationを忠実にTypeScript化
  // excludeStart/Endの判定
  const excludeStart = !overlap && c1.getPrevious() === c2;
  const excludeEnd = !overlap && c1 !== c2 && c1.getNext() === c2;
  const tMin = Numerical.CURVETIME_EPSILON;
  const tMax = 1 - tMin;

  // t1, t2が有効範囲かつ端点除外条件を満たす場合のみ追加
  if (
    t1 !== null && t1 >= (excludeStart ? tMin : 0) && t1 <= (excludeEnd ? tMax : 1) &&
    t2 !== null && t2 >= (excludeEnd ? tMin : 0) && t2 <= (excludeStart ? tMax : 1)
  ) {
    // 🔥DEBUG: addLocation呼び出し時の引数
    // eslint-disable-next-line no-console

    // CurveLocationを2つ生成し、相互参照
    const loc1 = new CurveLocation(c1, t1, null, null);
    const loc2 = new CurveLocation(c2, t2, null, null);
    // 🔥DEBUG: CurveLocation生成直後
    // eslint-disable-next-line no-console

    loc1._intersection = loc2;
    loc2._intersection = loc1;
    // includeコールバックがなければ、または条件を満たせばloc1のみ追加
    if (!include || include(loc1)) {
      insertLocation(locations, loc1, true);
    }
  }
}

/**
 * 重複する交点をフィルタリングしながら交点情報を挿入
 * paper.jsのCurveLocation.insert実装を移植
 */
export function insertLocation(locations: CurveLocation[], location: CurveLocation, includeOverlaps: boolean = false): number {
  const length = locations.length;

  // 🔥DEBUG: insertLocation呼び出し時
  // eslint-disable-next-line no-console

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
    if (loc._curve !== null && location._curve !== null &&
        loc._time !== null && location._time !== null &&
        loc._intersection?._curve !== null && location._intersection?._curve !== null &&
        loc._intersection?._time !== null && location._intersection?._time !== null) {
      // 曲線が同じかどうかをチェック（paper.jsと同様）
      const sameCurves =
        (loc._curve === location._curve && loc._intersection?._curve === location._intersection?._curve) ||
        (loc._curve === location._intersection?._curve && loc._intersection?._curve === location._curve);

      if (sameCurves) {
        // Paper.jsと同じ重複チェックロジック
        // 曲線が同じ場合、_timeとintersection._timeを適切に比較
        let t1Diff: number, t2Diff: number;

        if (loc._curve === location._curve) {
          t1Diff = Math.abs(loc._time! - location._time!);
          t2Diff = Math.abs(loc._intersection!._time! - location._intersection!._time!);
        } else {
          // 曲線が逆の場合、_timeとintersection._timeを入れ替えて比較
          t1Diff = Math.abs(loc._time! - location._intersection!._time!);
          t2Diff = Math.abs(loc._intersection!._time! - location._time!);
        }

        // Paper.jsと同じ条件で重複判定
        if (t1Diff < curveEpsilon && t2Diff < curveEpsilon) {
          // eslint-disable-next-line no-console
          
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
          // 🔥DEBUG: tパラメータ重複判定でreturn i
          // eslint-disable-next-line no-console
          return i;
        }
      }
    }

    // 点の距離が十分に近い場合は重複とみなす
    if (loc._point && location._point) {
      const dist = loc._point.subtract(location._point).getLength();
      if (dist < geomEpsilon) {
        // eslint-disable-next-line no-console
        
        // 交点が既に存在する場合は、相互参照を更新
        if (location._intersection && loc._intersection) {
          // 既存の交点の相互参照を新しい交点の相互参照に更新
          loc._intersection._intersection = location._intersection;
          location._intersection._intersection = loc._intersection;
        }

        // 重複を許可する場合のみ追加
        if (includeOverlaps) {
          // 🔥DEBUG: 重複なしでpush
          // eslint-disable-next-line no-console
          locations.push(location);
          return length;
        }

        // 🔥DEBUG: 点の距離重複判定でreturn i
        // eslint-disable-next-line no-console
        return i;
      }
    }
  }

  // 重複がない場合は追加
  // eslint-disable-next-line no-console
  
  locations.push(location);
  return length;
}