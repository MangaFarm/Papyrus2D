/**
 * PathBooleanResolveCrossings: 交差解決のための関数
 * paper.jsのPathItem.Boolean.jsのresolveCrossings関数とその関連関数を移植
 */

import { Path } from './Path';
import { PathItem } from './PathItem';
import { CurveLocation } from './CurveLocation';
import { Segment } from './Segment';
import { tracePaths } from './PathBooleanTracePaths';
import { getMeta } from './SegmentMeta';
import { CompoundPath } from './CompoundPath';
import { divideLocations, clearCurveHandles } from './PathBooleanIntersections';

import { propagateWinding } from './PathBooleanWinding';
import { CollisionDetection } from '../util/CollisionDetection';
/**
 * パスの交差を解決する
 * paper.jsのresolveCrossings関数を移植
 *
 * @param path 交差を解決するパス
 * @returns 交差が解決されたパス
 */
export function resolveCrossings(path: PathItem): PathItem {
  // paper.jsのresolveCrossingsアルゴリズムに完全一致させる

  let paths: Path[] = path instanceof CompoundPath ? path._children : [path as Path];

  function hasOverlap(seg: Segment, path: Path): boolean {
    const meta = getMeta(seg);
    const inter = meta._intersection;
    return !!(inter && inter._overlap && meta!._path === path);
  }

  // 交差点・重なり点の検出とフラグ
  let hasOverlaps = false;
  let hasCrossings = false;
  let intersections = path.getIntersections(
    path, 
    function(inter: CurveLocation) {
      const isOverlap = inter.hasOverlap();
      const isCrossing = inter.isCrossing();
      return isOverlap && (hasOverlaps = true) ||
            isCrossing && (hasCrossings = true);
    },
    null,
    false);
  
  // paper.jsと同様にCurveLocation.expandを使用
  intersections = CurveLocation.expand(intersections);

  // 交差点がなければ元のパスを返す
  if (!intersections || intersections.length === 0) {
    return path;
  }

  // 曲線ハンドルクリア用
  const clearCurves = hasOverlaps && hasCrossings ? [] : undefined;

  // 重なり処理
  if (hasOverlaps) {
    const overlaps = divideLocations(intersections, function(inter: CurveLocation) {
      return inter.hasOverlap();
    }, clearCurves);

    for (let i = overlaps.length - 1; i >= 0; i--) {
      const overlap = overlaps[i];
      const path = overlap._path!;
      const seg = overlap._segment!;
      const prev = seg.getPrevious()!;
      const next = seg.getNext()!;
      if (hasOverlap(prev, path) && hasOverlap(next, path)) {
        seg.remove();
        // paper.jsでは new Point(0, 0) などを使うため、Point型で明示
        prev._handleOut._set(0, 0);
        next._handleIn._set(0, 0);
        const prevCurve = prev.getCurve();
        if (prev !== seg) {
          if (!prevCurve) {
            // paper.js: do nothing if prevCurve is null
          } else if (typeof prevCurve.hasLength !== 'function') {
          } else if (!prevCurve.hasLength()) {
            // prev._handleInはSegmentPoint型
            next._handleIn._set(prev._handleIn.getX(), prev._handleIn.getY());
            prev.remove();
          }
        }
      }
    }
  }

  // 交差処理
  if (hasCrossings) {
    const divideResult = divideLocations(intersections, hasOverlaps ? function(inter: CurveLocation) {
      const curve1 = inter.getCurve();
      const seg1 = inter.getSegment();
      const other = inter._intersection;
      const curve2 = other?._curve;
      const seg2 = other?._segment;
      if (curve1 && curve2 && curve1._path && curve2._path) {
        return true;
      }
      if (seg1) getMeta(seg1)._intersection = null;
      if (seg2) getMeta(seg2)._intersection = null;
      return false;
    } : undefined, clearCurves);

    if (clearCurves) {
      clearCurveHandles(clearCurves);
    }

    // --- winding numberの伝播（paper.jsと同じ） ---
    // 1. 全カーブを集める
    let allCurves: any[] = [];
    for (let i = 0, l = paths.length; i < l; i++) {
      allCurves = allCurves.concat(paths[i].getCurves());
    }
    // 2. 衝突マップを作成
    // CollisionDetectionはutil/CollisionDetection.ts
    // findCurveBoundsCollisionsWithBothAxis(curves1, curves2, tolerance)
    // curves1, curves2はcurve.getValues()の配列
    // toleranceは0でOK
    // 衝突マップをpaper.jsと同じ形式に変換
    // import { CollisionDetection } を追加する必要あり
    // ここでimportを追加
    // import { CollisionDetection } from '../util/CollisionDetection';
    // 既存importの下に追加してください
    // --- 衝突マップ作成 ---
    // 1. 各カーブのgetValues()を取得
    const curvesValues = allCurves.map(curve => curve.getValues());
    // 2. 衝突情報を取得
    const curveCollisions = CollisionDetection.findCurveBoundsCollisionsWithBothAxis(
      curvesValues, curvesValues, 0
    );
    // 3. curveCollisionsMapを作成
    const curveCollisionsMap: Record<string, Record<number, { hor: any[]; ver: any[] }>> = {};
    for (let i = 0; i < allCurves.length; i++) {
      const curve = allCurves[i];
      const id = curve._path._id;
      if (!curveCollisionsMap[id]) curveCollisionsMap[id] = {};
      curveCollisionsMap[id][curve.getIndex()] = {
        hor: curveCollisions[i]!.hor!.map((idx: number) => allCurves[idx]),
        ver: curveCollisions[i]!.ver!.map((idx: number) => allCurves[idx]),
      };
    }
    // 4. 全セグメントにwindingを伝播
    // operatorは{1:true}
    const operator = { 1: true };
    // 1. 交点（divideLocationsで得られるintersections配列）の各_segmentにまず伝播
    for (let i = 0; i < intersections.length; i++) {
      const seg = intersections[i]._segment;
      if (seg) {
        const meta = getMeta(seg);
        if (!meta._winding) {
          propagateWinding(seg, seg._path!, null, curveCollisionsMap, operator);
        }
      }
    }
    // --- tracePaths呼び出し用に全セグメントを集める ---
    let allSegments: Segment[] = [];
    for (let i = 0, l = paths.length; i < l; i++) {
      allSegments = allSegments.concat(paths[i]._segments);
    }
    // 2. 分割後の全セグメント（tracePathsに渡すallSegments）にもwinding未セットなら伝播
    for (let i = 0; i < allSegments.length; i++) {
      const seg = allSegments[i];
      const meta = getMeta(seg);
      if (!meta._winding) {
        propagateWinding(seg, seg._path!, null, curveCollisionsMap, operator);
      }
    }
    // paper.js互換: operator = { 1: true } を渡す
    paths = tracePaths(allSegments, { 1: true });
    if (paths.length > 0) {
    }
  }

  // 結果のパス構成
  let result: PathItem;
  const length = paths.length;
  if (path instanceof CompoundPath) {
    if (paths !== path._children) {
      path._children = paths;
    }
    result = path;
  } else if (length === 1 && !(path instanceof CompoundPath)) {
    // 🔥 新しいPathインスタンスをそのまま返す（_closedフラグを正しく伝播）
    result = paths[0];
  } else {
    const compoundPath = new CompoundPath();
    compoundPath.addChildren(paths);
    const reduced = compoundPath.reduce();
    reduced.copyAttributes(path);
    result = reduced;
    // paper.jsではreplaceWith()を使用するが、Papyrus2Dでは直接置き換えは行わない
    // TypeScriptの制約上、replaceWithメソッドの実装が必要だが、
    // 今回はresolveCrossingsの挙動を合わせることが目的なので省略
  }
// 🔥 デバッグ出力: resolveCrossingsの出力SVG
if (result) {
  console.log("🔥 resolveCrossings 出力SVG:", (result as any).getPathData());
}
  return result;
}

/**
 * 指定された位置でパスを分割する
 * paper.jsのdivideLocations関数を移植
 */


