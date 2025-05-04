/**
 * PathBooleanIntersections: Boolean演算のための交点計算
 * paper.jsのPathItem.Boolean.jsを参考に実装
 */

import { Path } from './Path';
import { Segment } from './Segment';
import { Point } from '../basic/Point';
import { Curve } from './Curve';
import { Numerical } from '../util/Numerical';
import { CurveLocation } from './CurveLocation';

/**
 * 交点情報
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
  prev?: Intersection;
  // 交点のセグメント
  segment?: Segment;
  // 交点が重なりかどうか
  _overlap?: boolean;
}

/**
 * 2つのパスの交点を計算
 * paper.jsのfilterIntersection関数を参考に実装
 */
export function getIntersections(path1: Path, path2: Path): Intersection[] {
  // 交差点と重なりを区別するフィルター関数
  function filterIntersection(inter: CurveLocation): boolean {
    // 重なりまたは交差のみを返す
    return inter.hasOverlap() || inter.isCrossing();
  }
  
  // 交点計算（フィルター関数を使用）
  const rawIntersections = path1.getIntersections(path2, filterIntersection);
  
  // Intersection型に変換
  const intersections: Intersection[] = [];
  
  for (const loc of rawIntersections) {
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
  
  // 交点をソート（curve1Index, t1の順）
  intersections.sort((a, b) => {
    if (a.curve1Index !== b.curve1Index) {
      return a.curve1Index - b.curve1Index;
    }
    // t1がnullの場合は0として扱う
    const t1A = a.t1 ?? 0;
    const t1B = b.t1 ?? 0;
    return t1A - t1B;
  });
  
  return intersections;
}

/**
 * 交点でパスを分割
 */
export function dividePathAtIntersections(path: Path, intersections: Intersection[]): Path {
  if (intersections.length === 0) return path;
  
  // 交点でパスを分割
  const curves = path.getCurves();
  const segments: Segment[] = [];
  
  // 各カーブについて処理
  for (let i = 0; i < curves.length; i++) {
    const curve = curves[i];
    const curveIntersections = intersections.filter(inter => inter.curve1Index === i);
    
    // カーブの開始点を追加
    segments.push(curve._segment1);
    
    // 交点をt値でソート
    curveIntersections.sort((a, b) => (a.t1 ?? 0) - (b.t1 ?? 0));
    
    // 各交点でカーブを分割
    for (const intersection of curveIntersections) {
      const t = intersection.t1 ?? 0;
      if (t > Numerical.CURVETIME_EPSILON && t < 1 - Numerical.CURVETIME_EPSILON) {
        // カーブを分割して新しいセグメントを作成
        const result = curve.divideAtTime(t);
        
        // divideAtTimeの戻り値がCurveの場合
        if (result && typeof result === 'object' && 'getPoint' in result) {
          // 新しいセグメントを取得
          const newCurve = result as Curve;
          const newSegment = newCurve._segment1;
          
          segments.push(newSegment);
          
          // 交点情報にセグメントを関連付け
          intersection.segment = newSegment;
        }
      }
    }
  }
  
  // 新しいパスを作成
  const newPath = new Path(segments, path.isClosed());
  return newPath;
}

/**
 * 交点情報をリンクリストとして連結する
 * paper.jsのlinkIntersections関数を移植
 */
export function linkIntersections(from: Intersection, to: Intersection): void {
  // 既存のチェーンに既にtoが含まれていないか確認
  let prev = from;
  while (prev) {
    if (prev === to) return;
    prev = prev.prev!;
  }

  // 既存のチェーンの末尾を探す
  while (from.next && from.next !== to) {
    from = from.next;
  }

  // チェーンの末尾に到達したら、toを連結
  if (!from.next) {
    // toのチェーンの先頭に移動
    let toStart = to;
    while (toStart.prev) {
      toStart = toStart.prev;
    }
    from.next = toStart;
    toStart.prev = from;
  }
}

/**
 * カーブのハンドルをクリア
 * paper.jsのclearCurveHandlesメソッドを移植
 */
export function clearCurveHandles(curves: Curve[]): void {
  // 各カーブのセグメントのハンドルをクリア
  for (let i = curves.length - 1; i >= 0; i--) {
    const curve = curves[i];
    if (curve._segment1) curve._segment1.clearHandles();
    if (curve._segment2) curve._segment2.clearHandles();
  }
}