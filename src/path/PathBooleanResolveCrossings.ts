/**
 * PathBooleanResolveCrossings: 交差解決のための関数
 * paper.jsのPathItem.Boolean.jsのresolveCrossings関数とその関連関数を移植
 */

import { Path } from './Path';
import { PathItem } from './PathItem';
import { Numerical } from '../util/Numerical';
import { CurveLocation } from './CurveLocation';
import { Segment } from './Segment';
import { Curve } from './Curve';
import { tracePaths } from './PathBooleanTracePaths';
import { getMeta, IntersectionInfo } from './SegmentMeta';
import { CompoundPath } from './CompoundPath';

/**
 * パスの交差を解決する
 * paper.jsのresolveCrossings関数を移植
 *
 * @param path 交差を解決するパス
 * @returns 交差が解決されたパス
 */
export function resolveCrossings(path: PathItem): PathItem {
  // paper.jsのresolveCrossingsアルゴリズムに完全一致させる
  console.log("resolveCrossings開始:", path);

  const children = (path as any)._children;
  let paths = children || [path];
  console.log("paths数:", paths.length);

  function hasOverlap(seg: Segment | null | undefined, path: Path): boolean {
    if (!seg) return false;
    const meta = getMeta(seg);
    const inter = meta && meta.intersection;
    return !!(inter && inter._overlap && meta!.path === path);
  }

  // 交差点・重なり点の検出とフラグ
  let hasOverlaps = false;
  let hasCrossings = false;
  console.log("交点検出前");
  let intersections = (path as any).getIntersections(null, function(inter: any) {
    const isOverlap = inter.hasOverlap();
    const isCrossing = inter.isCrossing();
    console.log("交点検出:", inter, "overlap:", isOverlap, "crossing:", isCrossing);
    return isOverlap && (hasOverlaps = true) ||
           isCrossing && (hasCrossings = true);
  });
  console.log("交点検出後 - hasOverlaps:", hasOverlaps, "hasCrossings:", hasCrossings);
  console.log("交点数:", intersections ? intersections.length : 0);
  
  // paper.jsと同様にCurveLocation.expandを使用
  intersections = CurveLocation.expand(intersections);
  console.log("展開後の交点数:", intersections ? intersections.length : 0);

  // 交差点がなければ元のパスを返す
  if (!intersections || intersections.length === 0) {
    console.log("交点なし - 元のパスを返す");
    return path;
  }

  // 曲線ハンドルクリア用
  const clearCurves = hasOverlaps && hasCrossings ? [] : undefined;
  console.log("clearCurves:", clearCurves ? "配列" : "undefined");

  // 重なり処理
  if (hasOverlaps) {
    const overlaps = divideLocations(intersections, function(inter: any) {
      return inter.hasOverlap();
    }, clearCurves);

    for (let i = overlaps.length - 1; i >= 0; i--) {
      const overlap = overlaps[i];
      const path = overlap._path;
      const seg = overlap._segment;
      const prev = seg.getPrevious();
      const next = seg.getNext();
      if (hasOverlap(prev, path) && hasOverlap(next, path)) {
        seg.remove();
        prev._handleOut.set(0, 0);
        next._handleIn.set(0, 0);
        if (prev !== seg && !prev.getCurve().hasLength()) {
          next._handleIn.set(prev._handleIn);
          prev.remove();
        }
      }
    }
  }

  // 交差処理
  if (hasCrossings) {
    console.log("交差処理開始");
    const divideResult = divideLocations(intersections, hasOverlaps ? function(inter: any) {
      console.log("divideLocations filter:", inter);
      const curve1 = inter.getCurve && inter.getCurve();
      const seg1 = inter.getSegment && inter.getSegment();
      const other = inter._intersection;
      const curve2 = other && other.getCurve && other.getCurve();
      const seg2 = other && other.getSegment && other.getSegment();
      if (curve1 && curve2 && curve1._path && curve2._path) {
        console.log("  有効な交点");
        return true;
      }
      // paper.jsでは直接_intersectionを操作するが、Papyrus2DではgetMetaを使用
      if (seg1) {
        const meta1 = getMeta(seg1);
        if (meta1) meta1.intersection = null;
      }
      if (seg2) {
        const meta2 = getMeta(seg2);
        if (meta2) meta2.intersection = null;
      }
      console.log("  無効な交点");
      return false;
    } : undefined, clearCurves);
    console.log("divideLocations結果:", divideResult);

    if (clearCurves) {
      console.log("clearCurveHandles実行:", clearCurves.length);
      clearCurveHandles(clearCurves);
    }

    // tracePaths呼び出し - paper.jsと同様の方法で
    let allSegments: Segment[] = [];
    for (let i = 0, l = paths.length; i < l; i++) {
      allSegments = allSegments.concat(paths[i]._segments);
    }
    console.log("tracePaths前のセグメント数:", allSegments.length);
    paths = tracePaths(allSegments, {});
    console.log("tracePaths後のパス数:", paths.length);
    if (paths.length > 0) {
      console.log("最初のパスのセグメント数:", paths[0]._segments.length);
    }
  }

  // 結果のパス構成
  let result: PathItem;
  const length = paths.length;
  if (children) {
    if (paths !== children) {
      (path as any).setChildren(paths);
    }
    result = path;
  } else if (length === 1 && !children) {
    if (paths[0] !== path) {
      (path as any).setSegments(paths[0].removeSegments());
    }
    result = path;
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
  return result;
}

/**
 * 指定された位置でパスを分割する
 * paper.jsのdivideLocations関数を移植
 */
function divideLocations(
  locations: CurveLocation[],
  include?: (loc: CurveLocation) => boolean,
  clearLater?: Curve[]
): CurveLocation[] {
  console.log("divideLocations開始 - 位置数:", locations.length);
  const results: CurveLocation[] | undefined = include ? [] : undefined;
  const tMin = Numerical.CURVETIME_EPSILON;
  const tMax = 1 - tMin;
  let clearHandles = false;
  const clearCurves = clearLater || [];
  const clearLookup = clearLater ? {} : undefined;
  let renormalizeLocs: CurveLocation[] = [];
  let prevCurve: Curve | undefined;
  let prevTime: number | undefined;
  
  // カーブIDを取得する関数
  function getId(curve: Curve): string {
    return curve._path._id + '.' + curve._segment1._index;
  }
  
  // clearLaterが指定されている場合、ルックアップテーブルを作成
  if (clearLater && clearLater.length) {
    for (let i = clearLater.length - 1; i >= 0; i--) {
      const curve = clearLater[i];
      if (curve._path) {
        clearLookup![getId(curve)] = true;
      }
    }
    console.log("clearLookup作成完了");
  }
  
  // 位置を右から左に処理
  for (let i = locations.length - 1; i >= 0; i--) {
    const loc = locations[i];
    console.log(`位置[${i}]処理:`, loc);
    const time = loc.getTime()!;
    const origTime = time;
    console.log("  時間:", time);
    const exclude = include && !include(loc);
    console.log("  除外:", exclude);
    const curve = loc.getCurve()!;
    console.log("  曲線:", curve ? "有効" : "無効");
    let segment: Segment | undefined;
    
    if (curve) {
      if (curve !== prevCurve) {
        // 新しい曲線の場合、clearHandles設定を更新
        clearHandles = !curve.hasHandles() ||
                      (clearLookup && clearLookup[getId(curve)]);
        console.log("  新しい曲線 - clearHandles:", clearHandles);
        renormalizeLocs = [];
        prevTime = undefined;
        prevCurve = curve;
      } else if (prevTime !== undefined && prevTime >= tMin) {
        // 同じ曲線を複数回分割する場合、時間パラメータを再スケール
        // paper.jsと同様に直接代入
        console.log("  時間再スケール:", time, "->", time / prevTime);
        loc._time = time / prevTime;
      }
    }
    
    if (exclude) {
      // 除外された位置を後で正規化するために保存
      if (renormalizeLocs) {
        console.log("  位置を除外して保存");
        renormalizeLocs.push(loc);
      }
      continue;
    } else if (include && results) {
      // paper.jsと同様にunshiftを使用
      console.log("  結果に位置を追加");
      (results as CurveLocation[]).unshift(loc);
    }
    
    prevTime = origTime;
    
    if (time < tMin) {
      console.log("  時間が小さすぎる - 最初のセグメントを使用");
      segment = curve._segment1;
    } else if (time > tMax) {
      console.log("  時間が大きすぎる - 最後のセグメントを使用");
      segment = curve._segment2;
    } else {
      // 曲線を時間で分割 - paper.jsと同様に常にハンドルをセット
      console.log("  曲線を分割:", time);
      const newCurve = curve.divideAtTime(time, true);
      console.log("  分割結果:", newCurve ? "成功" : "失敗");
      
      // ハンドルなしの曲線を追跡
      if (clearHandles && newCurve) {
        console.log("  clearCurvesに追加");
        clearCurves.push(curve, newCurve);
      }
      
      segment = newCurve ? newCurve._segment1 : undefined;
      console.log("  分割点のセグメント:", segment ? "有効" : "無効");
      
      // 同じ曲線内の他の位置の時間パラメータを正規化
      for (let j = renormalizeLocs.length - 1; j >= 0; j--) {
        const l = renormalizeLocs[j];
        console.log("  位置を正規化:", l._time, "->", (l._time! - time) / (1 - time));
        l._time = (l._time! - time) / (1 - time);
      }
    }
    
    // セグメントに交差情報を設定
    loc._setSegment(segment!);
    
    // 交差点のリンクリストを作成 - paper.jsでは直接segment._intersectionを使用するが、
    // Papyrus2DではgetMetaを使用
    const meta = getMeta(segment!);
    const inter = meta && meta.intersection;
    const dest = loc._intersection as unknown as IntersectionInfo;
    
    if (inter) {
      linkIntersections(inter, dest);
      
      // リンクリストの他のエントリにも新しいエントリへのリンクを追加
      let other = inter;
      while (other) {
        if (other._intersection) {
          linkIntersections(other._intersection, inter);
        }
        other = other.next!;
      }
    } else if (meta) {
      meta.intersection = dest;
    }
  }
  
  // 後で処理するために保存していない場合は、すぐに曲線ハンドルをクリア
  if (!clearLater) {
    clearCurveHandles(clearCurves);
  }
  
  return results || locations;
}

/**
 * 交差点情報をリンクリストとして連結する
 * paper.jsのlinkIntersections関数を移植
 */
function linkIntersections(from: IntersectionInfo, to: IntersectionInfo): void {
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
 * paper.jsのclearCurveHandlesメソッドを移植
 */
function clearCurveHandles(curves: Curve[]): void {
  // paper.jsと同様に実装
  for (let i = curves.length - 1; i >= 0; i--) {
    curves[i].clearHandles();
  }
}

