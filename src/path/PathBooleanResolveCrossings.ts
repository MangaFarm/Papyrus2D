/**
 * PathBooleanResolveCrossings: 交差解決のための関数
 * paper.jsのPathItem.Boolean.jsのresolveCrossings関数とその関連関数を移植
 */

import { Path } from './Path';
import { Point } from '../basic/Point';
import { SegmentPoint } from './SegmentPoint';
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

  let paths: Path[] = path instanceof CompoundPath ? path._children : [path as Path];

  function hasOverlap(seg: Segment | null | undefined, path: Path): boolean {
    if (!seg) return false;
    const meta = getMeta(seg);
    const inter = meta._intersection;
    // overlap範囲の端点（overlapの最初または最後のセグメント）はfalseを返す
    if (!(inter && inter._overlap && meta!._path === path)) return false;
    // _overlapがCurveLocation型で、_segmentプロパティが存在する場合のみ端点判定
    if (
      typeof inter._overlap === 'object' &&
      inter._overlap !== null &&
      '_segment' in inter._overlap &&
      (inter._overlap as CurveLocation)._segment === seg
    ) {
      return false;
    }
    return true;
  }

  // 交差点・重なり点の検出とフラグ
  let hasOverlaps = false;
  let hasCrossings = false;
  let intersections = (path as PathItem & {
    getIntersections: (
      arg: null,
      callback: (inter: CurveLocation) => boolean
    ) => CurveLocation[];
  }).getIntersections(null, function(inter: CurveLocation) {
    const isOverlap = inter.hasOverlap();
    const isCrossing = inter.isCrossing();
    return isOverlap && (hasOverlaps = true) ||
           isCrossing && (hasCrossings = true);
  });
  
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
            console.log('[resolveCrossings] prev.getCurve() is null', prev, prev?._index, prev?._path);
            // paper.js: do nothing if prevCurve is null
          } else if (typeof prevCurve.hasLength !== 'function') {
            console.log('[resolveCrossings] prev.getCurve() is not Curve', prevCurve, typeof prevCurve, prevCurve && Object.keys(prevCurve));
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
      const curve1 = inter.getCurve && inter.getCurve();
      const seg1 = inter.getSegment && inter.getSegment();
      const other = inter._intersection as IntersectionInfo | null;
      // IntersectionInfo型にはgetCurve/getSegmentはないので、paper.js同様に_curve/_segmentを参照
      const curve2 = other && (other as any)._curve;
      const seg2 = other && (other as any)._segment;
      if (curve1 && curve2 && curve1._path && curve2._path) {
        return true;
      }
      // paper.jsでは直接_intersectionを操作するが、Papyrus2DではgetMetaを使用
      if (seg1) {
        const meta1 = getMeta(seg1);
        meta1._intersection = null;
      }
      if (seg2) {
        const meta2 = getMeta(seg2);
        meta2._intersection = null;
      }
      return false;
    } : undefined, clearCurves);

    // デバッグ: divideLocations後のパス情報
    for (const p of paths) {
      console.log('[resolveCrossings] after divideLocations:', p._id, 'segments:', p._segments?.length, 'curves:', p._curves?.length);
    }

    if (clearCurves) {
      clearCurveHandles(clearCurves);
    }

    // tracePaths呼び出し - paper.jsと同様の方法で
    let allSegments: Segment[] = [];
    for (let i = 0, l = paths.length; i < l; i++) {
      allSegments = allSegments.concat(paths[i]._segments);
    }
    paths = tracePaths(allSegments, {});
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
    if (paths[0] !== path) {
      (path as Path).setSegments(paths[0].removeSegments());
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
    return curve._path!._id + '.' + curve._segment1._index;
  }
  
  // clearLaterが指定されている場合、ルックアップテーブルを作成
  if (clearLater && clearLater.length) {
    for (let i = clearLater.length - 1; i >= 0; i--) {
      const curve = clearLater[i];
      if (curve._path) {
        clearLookup![getId(curve)] = true;
      }
    }
  }
  
  // 位置を右から左に処理
  for (let i = locations.length - 1; i >= 0; i--) {
    const loc = locations[i];
    const time = loc.getTime()!;
    const origTime = time;
    const exclude = include && !include(loc);
    const curve = loc.getCurve()!;
    let segment: Segment | undefined;
    
    if (curve) {
      if (curve !== prevCurve) {
        // 新しい曲線の場合、clearHandles設定を更新
        clearHandles = !curve.hasHandles() ||
                      (clearLookup && clearLookup[getId(curve)]);
        renormalizeLocs = [];
        prevTime = undefined;
        prevCurve = curve;
      } else if (prevTime !== undefined && prevTime >= tMin) {
        // 同じ曲線を複数回分割する場合、時間パラメータを再スケール
        // paper.jsと同様に直接代入
        loc._time = time / prevTime;
      }
    }
    
    if (exclude) {
      // 除外された位置を後で正規化するために保存
      if (renormalizeLocs) {
        renormalizeLocs.push(loc);
      }
      continue;
    } else if (include && results) {
      // paper.jsと同様にunshiftを使用
      (results as CurveLocation[]).unshift(loc);
    }
    
    prevTime = origTime;
    
    if (time < tMin) {
      segment = curve._segment1;
    } else if (time > tMax) {
      segment = curve._segment2;
    } else {
      // 曲線を時間で分割 - paper.jsと同様に常にハンドルをセット
      const newCurve = curve.divideAtTime(time, true);

      // ハンドルなしの曲線を追跡
      if (clearHandles && newCurve) {
        clearCurves.push(curve, newCurve);
      }

      // paper.js同様、分割できなかった場合も必ずsegmentをセット
      segment = newCurve ? newCurve._segment1 : curve._segment2;

      // 同じ曲線内の他の位置の時間パラメータを正規化
      for (let j = renormalizeLocs.length - 1; j >= 0; j--) {
        const l = renormalizeLocs[j];
        l._time = (l._time! - time) / (1 - time);
      }
    }
    
    // セグメントに交差情報を設定
    if (!segment) {
      console.log('[divideLocations] segment is undefined', { time, curve, loc });
    }
    loc._setSegment(segment!);
    
    // 交差点のリンクリストを作成 - paper.jsでは直接segment._intersectionを使用するが、
    // Papyrus2DではgetMetaを使用
    const meta = getMeta(segment!);
    const inter = meta._intersection;
    // IntersectionInfo型への変換はas unknown as IntersectionInfoでTypeScriptエラーを抑制
    // paper.js同様、型安全性を無視してIntersectionInfoとして扱う
    const dest = loc._intersection as unknown as IntersectionInfo;
    
    if (inter) {
      linkIntersections(inter, dest);
      
      // リンクリストの他のエントリにも新しいエントリへのリンクを追加
      let other = inter;
      while (other) {
        if (other._intersection) {
          linkIntersections(other._intersection, inter);
        }
        other = other._next!;
      }
    } else if (meta) {
      meta._intersection = dest;
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
  while (from._next && from._next !== to) {
      from = from._next;
  }
  
  // チェーンの末尾に到達したら、toを連結
  if (!from._next) {
      // toのチェーンの先頭に移動
      let toStart = to;
      while (toStart._previous) {
          toStart = toStart._previous;
      }
      from._next = toStart;
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

