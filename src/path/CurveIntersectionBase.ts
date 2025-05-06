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
): CurveLocation | null {
  // Paper.jsと同様の実装
  // 端点の除外判定
  const excludeStart = !overlap && c1.getPrevious() === c2;
  const excludeEnd = !overlap && c1 !== c2 && c1.getNext() === c2;
  const tMin = Numerical.CURVETIME_EPSILON;
  const tMax = 1 - tMin;

  // eslint-disable-next-line no-console

  // 範囲チェック - paper.jsと同様の条件判定
  // t1, t2がnullや0〜1範囲外の場合はスキップ
  console.log(`🔥 addLocation: t1=${t1} t2=${t2}`);
  if (
    t1 !== null && t2 !== null &&
    t1 >= 0 && t1 <= 1 &&
    t2 >= 0 && t2 <= 1
  ) {
    if (
      t1 >= (excludeStart ? tMin : -Numerical.GEOMETRIC_EPSILON) &&
      t1 <= (excludeEnd ? tMax : 1 + Numerical.GEOMETRIC_EPSILON) &&
      t2 >= (excludeEnd ? tMin : -Numerical.GEOMETRIC_EPSILON) &&
      t2 <= (excludeStart ? tMax : 1 + Numerical.GEOMETRIC_EPSILON)
    ) {
      // Paper.jsと同様に、交点の座標をnullで初期化
      // 後で必要に応じて計算される
      const point: Point | null = null;

      // 交点座標を計算
      const pt1 = (c1 && t1 !== null) ? c1.getPointAtTime(t1) : null;
      const pt2 = (c2 && t2 !== null) ? c2.getPointAtTime(t2) : null;
      // Paper.jsと同様に2つのCurveLocationを作成し、相互参照を設定
      // Point型でなければtoPoint()で変換
      // Point型でなければtoPoint()で変換（SegmentPoint型や未初期化も含む）
      function ensurePoint(obj: any): Point {
        if (!obj) return new Point(0, 0);
        if (obj instanceof Point) return obj;
        if (typeof obj.x === 'number' && typeof obj.y === 'number') return new Point(obj.x, obj.y);
        if (typeof obj.toPoint === 'function') return obj.toPoint();
        return new Point(0, 0);
      }
      const pt1Final = ensurePoint(pt1);
      const pt2Final = ensurePoint(pt2);
      const loc1 = new CurveLocation(c1, t1, pt1Final, null);
      const loc2 = new CurveLocation(c2, t2, pt2Final, null);

      // paper.js同様、segment, path, meta情報を必ずセット
      if (c1 && c1._segment1) {
        loc1._segment = c1._segment1;
        const meta1 = getMeta(c1._segment1);
        if (meta1) meta1.path = c1._path;
        // _segment._intersectionにloc1をセット
        (c1._segment1 as any)._intersection = loc1;
      }
      if (c2 && c2._segment1) {
        loc2._segment = c2._segment1;
        const meta2 = getMeta(c2._segment1);
        if (meta2) meta2.path = c2._path;
        // _segment._intersectionにloc2をセット
        (c2._segment1 as any)._intersection = loc2;
      }
      // intersection.segmentもセット
      // IntersectionInfo型の場合のみsegmentをセット
      if (loc1._intersection && '_segment' in loc2) {
        (loc1._intersection as any).segment = loc2._segment;
      }
      if (loc2._intersection && '_segment' in loc1) {
        (loc2._intersection as any).segment = loc1._segment;
      }
      // デバッグ: 生成したCurveLocationの内容
      console.log(`🔥 addLocation: loc1 _point=(${loc1._point.x},${loc1._point.y}) _curve=${!!loc1._curve} _time=${loc1._time}`);
      console.log(`🔥 addLocation: loc2 _point=(${loc2._point.x},${loc2._point.y}) _curve=${!!loc2._curve} _time=${loc2._time}`);

      // 相互参照を設定
      loc1._intersection = loc2;
      loc2._intersection = loc1;

      // 交点情報は_intersectionに格納されているので、追加のプロパティは不要
      // loc1._curve は c1、loc2._curve は c2 として設定済み
      // loc1._time は t1、loc2._time は t2 として設定済み

      // includeコールバックがなければ、または条件を満たせば追加
      if (!include) {
        // eslint-disable-next-line no-console
        
        insertLocation(locations, loc1, true);
        insertLocation(locations, loc2, true);
        return loc1;
      } else {
        const result = include(loc1);
        // eslint-disable-next-line no-console
        if (result) {
          // eslint-disable-next-line no-console
          
          insertLocation(locations, loc1, true);
          insertLocation(locations, loc2, true);
          return loc1;
        }
      }
    } else {
      // eslint-disable-next-line no-console
      
    }
  } else {
    // eslint-disable-next-line no-console
    
  }
  return null;
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
          locations.push(location);
          return length;
        }

        return i;
      }
    }
  }

  // 重複がない場合は追加
  // eslint-disable-next-line no-console
  
  locations.push(location);
  return length;
}