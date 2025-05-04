/**
 * PathBooleanIntersections: Boolean演算のための交点計算
 * paper.jsのPathItem.Boolean.jsを完全に一致するように実装
 */

import { Path } from './Path';
import { Segment } from './Segment';
import { Point } from '../basic/Point';
import { Curve } from './Curve';
import { Numerical } from '../util/Numerical';
import { CurveLocation } from './CurveLocation';
import { CollisionDetection } from '../util/CollisionDetection';

/**
 * 交点情報
 * paper.jsの内部表現に合わせたインターフェース
 */
export interface Intersection {
  // 交点の座標
  point: Point;
  // 交点のパス1上のカーブインデックス
  curve1Index: number;
  // 交点のパス2上のカーブインデックス
  curve2Index: number;
  // 交点のパス1上のカーブパラメータ
  t1?: number | null;
  // 交点のパス2上のカーブパラメータ
  t2?: number | null;
  // 交点の種類（entry/exit）
  type?: 'entry' | 'exit';
  // 交点のwinding number
  winding?: number;
  // 交点の処理済みフラグ
  visited?: boolean;
  // 次の交点への参照（リンクリスト構造）
  next?: Intersection;
  // 前の交点への参照（リンクリスト構造）
  _previous?: Intersection;
  // 交点のセグメント
  segment?: Segment;
  // 交点が重なりかどうか
  _overlap?: boolean;
  // 交点の情報
  _intersection?: Intersection;
}

/**
 * Segmentの拡張インターフェース（TypeScript制約のため）
 * paper.jsではSegmentに直接プロパティを追加しているが、TypeScriptでは型定義が必要
 */
interface SegmentWithIntersection extends Segment {
  _intersection?: Intersection;
}

/**
 * 交差点と重なりを区別するフィルター関数
 * paper.jsのfilterIntersection関数と完全に同じ
 */
export function filterIntersection(inter: CurveLocation): boolean {
  // 重なりまたは交差のみを返す
  return inter.hasOverlap() || inter.isCrossing();
}

/**
 * 2つのパスの交点を計算
 * paper.jsのCurveLocation.expand()を使用した実装に合わせる
 */
export function getIntersections(path1: Path, path2: Path): Intersection[] {
  // paper.jsと同様に、CurveLocation.expand()を使用して交点を展開
  const rawIntersections = path1.getIntersections(path2, filterIntersection);
  const expandedIntersections = CurveLocation.expand(rawIntersections);
  
  // Intersection型に変換
  const intersections: Intersection[] = [];
  
  for (const loc of expandedIntersections) {
    // 交点情報を抽出
    const point = loc.getPoint();
    const curve = loc.getCurve();
    const curveIndex = curve ? path1.getCurves().indexOf(curve) : 0;
    
    // 交差するカーブの情報
    const intersection = loc.getIntersection();
    const otherCurve = intersection ? intersection.getCurve() : null;
    const otherCurveIndex = otherCurve ? path2.getCurves().indexOf(otherCurve) : 0;
    
    // 交点情報を作成
    intersections.push({
      point,
      curve1Index: curveIndex,
      curve2Index: otherCurveIndex,
      t1: loc.getTime(),
      t2: intersection ? intersection.getTime() : null,
      visited: false
    });
  }
  
  return intersections;
}

/**
 * 指定された位置でパスアイテムを分割する
 * paper.jsのdivideLocations関数と同等の機能を実装
 */
export function divideLocations(
  locations: CurveLocation[],
  include?: (loc: CurveLocation) => boolean,
  clearLater?: Curve[]
): CurveLocation[] {
  const results = include ? [] as CurveLocation[] : null;
  const tMin = Numerical.CURVETIME_EPSILON;
  const tMax = 1 - tMin;
  let clearHandles = false;
  const clearCurves = clearLater || [];
  const clearLookup: Record<string, boolean> = clearLater ? {} : {};
  let renormalizeLocs: CurveLocation[] = [];
  let prevCurve: Curve | null = null;
  let prevTime: number | null = null;

  // カーブのIDを取得する関数
  function getId(curve: Curve): string {
    return curve._path._id + '.' + curve._segment1._index;
  }

  // clearLaterが指定されている場合、ルックアップテーブルを作成
  if (clearLater) {
    for (let i = clearLater.length - 1; i >= 0; i--) {
      const curve = clearLater[i];
      if (curve._path) {
        clearLookup[getId(curve)] = true;
      }
    }
  }

  // 右から左に向かって処理（paper.jsと同じ順序）
  for (let i = locations.length - 1; i >= 0; i--) {
    const loc = locations[i];
    const time = loc.getTime() || 0;
    const origTime = time;
    const exclude = include ? !include(loc) : false;
    const curve = loc.getCurve();
    let segment: Segment | null = null;

    if (curve) {
      if (curve !== prevCurve) {
        // 新しいカーブの場合、clearHandles設定を更新
        clearHandles = !curve.hasHandles() ||
                      clearLookup[getId(curve)] === true;
        renormalizeLocs = [];
        prevTime = null;
        prevCurve = curve;
      } else if (prevTime !== null && prevTime >= tMin) {
        // 同じカーブを複数回分割する場合、時間パラメータを再スケール
        loc._time = time / prevTime;
      }
    }

    if (exclude) {
      // 除外された位置を後で正規化するために保存
      renormalizeLocs.push(loc);
      continue;
    } else if (include && results) {
      results.unshift(loc);
    }

    prevTime = origTime;
    if (curve) {
      if (time < tMin) {
        segment = curve._segment1;
      } else if (time > tMax) {
        segment = curve._segment2;
      } else {
        // カーブを時間で分割
        // paper.jsと同様に、_setHandlesパラメータを渡す
        // divideAtTimeは新しいカーブオブジェクトを返す（Paper.jsと同様）
        const newCurve = curve.divideAtTime(time, clearHandles);
        
        // paper.jsと同様に、clearHandlesがtrueの場合、元のカーブと新しいカーブをclearCurvesに追加
        if (clearHandles && newCurve) {
          // 分割が成功した場合、元のカーブと新しいカーブを追加
          clearCurves.push(curve);
          clearCurves.push(newCurve);
        }
        
        // 分割が成功した場合、新しいセグメントを取得
        if (newCurve) {
          // 新しいセグメントは新しいカーブの最初のセグメント
          segment = newCurve._segment1;
          
          // 同じカーブ内の他の位置の時間パラメータを正規化
          for (let j = renormalizeLocs.length - 1; j >= 0; j--) {
            const l = renormalizeLocs[j];
            l._time = ((l._time || 0) - time) / (1 - time);
          }
        }
      }
    }

    if (segment) {
      loc._setSegment(segment);
      
      // 交点間のリンクを作成
      // paper.jsと同様に、Segmentに直接_intersectionプロパティを追加
      // TypeScript制約: 型定義のためにキャストは必要だが、コメントで説明
      const segmentWithInter = segment as unknown as SegmentWithIntersection;
      const inter = segmentWithInter._intersection;
      const dest = loc._intersection;
      
      if (inter) {
        // paper.jsと同様に、直接リンク処理を行う
        // TypeScript制約: 型の一致を確保するためにキャストが必要
        linkIntersections(inter as unknown as Intersection, dest as unknown as Intersection);
        // 新しいリンクを追加するたびに、他のすべてのエントリから新しいエントリへのリンクを追加
        let other = inter as unknown as Intersection;
        while (other) {
          if (other._intersection) {
            linkIntersections(other._intersection, inter as unknown as Intersection);
          }
          other = other.next!; // next!を使用してnullチェックエラーを回避
        }
      } else {
        // paper.jsと同様に、直接プロパティを設定
        segmentWithInter._intersection = dest as unknown as Intersection;
      }
    }
  }

  // 後で処理するために保存していない場合は、すぐにカーブハンドルをクリア
  if (!clearLater) {
    clearCurveHandles(clearCurves);
  }

  return results || locations;
}

/**
 * 交点でパスを分割
 * paper.jsのdivideLocations関数を使用した実装
 */
export function dividePathAtIntersections(path: Path, intersections: Intersection[]): Path {
  if (intersections.length === 0) return path;
  
  // CurveLocationの配列に変換
  const locations: CurveLocation[] = [];
  for (const inter of intersections) {
    const curve = path.getCurves()[inter.curve1Index];
    const loc = new CurveLocation(curve, inter.t1 || 0);
    // paper.jsと同様に、直接プロパティを設定
    // TypeScript制約: 型定義のためにキャストは必要だが、コメントで説明
    (loc as any)._intersection = inter; // TypeScript制約: paper.jsと同様に直接プロパティを設定
    locations.push(loc);
  }
  
  // divideLocations関数を使用して交点でパスを分割
  divideLocations(locations);
  
  return path;
}

/**
 * 交点情報をリンクリストとして連結する
 * paper.jsのlinkIntersections関数と完全に同じ実装
 */
export function linkIntersections(from: Intersection, to: Intersection): void {
  // 既存のチェーンに既にtoが含まれていないか確認
  let prev = from;
  while (prev) {
    if (prev === to) return;
    prev = prev._previous!;
  }

  // 既存のチェーンの末尾を探す
  while (from.next && from.next !== to) {
    from = from.next;
  }

  // チェーンの末尾に到達したら、toを連結
  if (!from.next) {
    // toのチェーンの先頭に移動
    let toStart = to;
    while (toStart._previous) {
      toStart = toStart._previous;
    }
    from.next = toStart;
    toStart._previous = from;
  }
}

/**
 * カーブのハンドルをクリア
 * paper.jsのclearCurveHandlesメソッドと完全に同じ実装
 */
export function clearCurveHandles(curves: Curve[]): void {
  // 各カーブのハンドルをクリア
  for (let i = curves.length - 1; i >= 0; i--) {
    curves[i].clearHandles();
  }
}