/**
 * PathBooleanPreparation: Boolean演算の前処理クラス
 * paper.jsのPathItem.Boolean.jsのpreparePath関数とその関連関数を移植
 */

import { Path } from './Path';
import { CompoundPath } from './CompoundPath';
import { PathItem } from './PathItem';
import { Numerical } from '../util/Numerical';
import { CurveLocation } from './CurveLocation';
import { Segment } from './Segment';
import { Curve } from './Curve';
import { tracePaths } from './PathBooleanTracePaths';
import { getMeta, IntersectionInfo } from './SegmentMeta';

/**
 * パスの交差を解決する
 * paper.jsのresolveCrossings関数を移植
 *
 * @param path 交差を解決するパス
 * @returns 交差が解決されたパス
 */
export function resolveCrossings(path: PathItem): PathItem {
  // paper.jsの実装に合わせた処理
  
  // パスまたは複合パスのアイテムをサポート
  let paths = path.getPaths!();
  
  // hasOverlap関数の実装
  function hasOverlap(seg: Segment | null | undefined, path: Path): boolean {
    if (!seg) return false;
    const meta = getMeta(seg);
    const inter = meta && meta.intersection;
    return !!(inter && inter._overlap && meta.path === path);
  }
  
  // 交差と重なりを検出
  const filterFunc = (inter: CurveLocation) => inter.hasOverlap() || inter.isCrossing();
  // 自己交差を検出するため、同じパスを渡す
  const intersections = path.getIntersections(path as unknown as PathItem).filter(filterFunc);
  
  // 交差点がない場合は元のパスを返す
  if (intersections.length === 0) {
    return path;
  }
  
  // 重なりと交差の存在を確認
  let hasOverlaps = false;
  let hasCrossings = false;
  
  for (const inter of intersections) {
    if (inter.hasOverlap()) {
      hasOverlaps = true;
    }
    if (inter.isCrossing()) {
      hasCrossings = true;
    }
    
    // 両方見つかったら早期終了
    if (hasOverlaps && hasCrossings) {
      break;
    }
  }
  
  // 全セグメントを収集
  const segments: Segment[] = [];
  const curves: Curve[] = [];
  
  for (const p of paths) {
    segments.push(...p.getSegments());
    curves.push(...p.getCurves());
    
    // すべてのセグメントが重なりかどうかを追跡
    (p as any)._overlapsOnly = true;
  }
  
  // 重なりがある場合の処理
  if (hasOverlaps) {
    // 重なりを持つ交差点を処理
    const overlaps = divideLocations(intersections, (inter: CurveLocation) => {
      return inter.hasOverlap();
    }, hasOverlaps && hasCrossings ? [] : undefined);
    
    // 重なりセグメントを処理
    for (let i = overlaps.length - 1; i >= 0; i--) {
      const overlap = overlaps[i];
      const path = overlap.getPath()!;
      const seg = overlap.getSegment()!;
      const prev = seg.getPrevious();
      const next = seg.getNext();
      
      if (hasOverlap(prev, path) && hasOverlap(next, path)) {
        seg.remove();
        prev!.setHandleOut(0, 0);
        next!.setHandleIn(0, 0);
        
        // 残った曲線の長さをチェック
        if (prev !== seg && !prev!.getCurve().hasLength()) {
          // セグメント削除時にhandleInを転送
          next!._handleIn.set(prev!._handleIn);
          prev!.remove();
        }
      }
    }
  }
  
  // 交差がある場合の処理
  if (hasCrossings) {
    // 交差点でパスを分割
    divideLocations(intersections, hasOverlaps ? ((inter: CurveLocation): boolean => {
      // 両方の関連曲線が有効かどうかをチェック
      const curve1 = inter.getCurve();
      const seg1 = inter.getSegment();
      
      // 他の交差点の現在の曲線が有効かどうかをチェック
      const other = inter.getIntersection();
      const curve2 = other ? other.getCurve() : null;
      const seg2 = other ? other.getSegment() : null;
      
      if (curve1 && curve2 && curve1._path && curve2._path) {
        return true;
      }
      
      // 重なり処理に関わった交差点を削除
      if (seg1) {
        const meta1 = getMeta(seg1);
        if (meta1) meta1.intersection = null;
      }
      if (seg2) {
        const meta2 = getMeta(seg2);
        if (meta2) meta2.intersection = null;
      }
      
      return false;
    }) : undefined, hasOverlaps && hasCrossings ? [] : undefined);
    
    // 曲線ハンドルをクリア
    if (hasOverlaps && hasCrossings) {
      clearCurveHandles([]);
    }
    
    // 自己交差を解決するためのパスを生成
    // paper.jsのtracePaths関数を使用
    
    // すべてのセグメントを収集
    const allSegments: Segment[] = [];
    for (const p of paths) {
      allSegments.push(...p._segments);
    }
    
    // paper.jsと同様に、tracePaths関数を呼び出す
    paths = tracePaths(allSegments, {});
  }
  
  // 結果を決定
  let result: PathItem;
  let length = paths.length;
  
  // CompoundPathかどうかを判定
  if (path instanceof CompoundPath) {
    // CompoundPathの場合
    const compoundPath = path as CompoundPath;
    if (paths !== compoundPath._children) {
      compoundPath.removeChildren();
      for (const p of paths) {
        compoundPath.addChild(p);
      }
    }
    result = compoundPath;
  } else if (length === 1 && !(path as any)._children) {
    // 単一のPathの場合
    if (paths[0] !== path && path instanceof Path) {
      (path as Path).setSegments(paths[0].getSegments());
    }
    result = path;
  } else {
    // 新しいCompoundPathを作成
    const compoundPath = new CompoundPath();
    for (const p of paths) {
      compoundPath.addChild(p);
    }
    compoundPath.copyAttributes(path);
    result = compoundPath;
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
  const results = include ? [] : undefined;
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
        // TypeScript制約: constの再代入ができないため、直接_timeプロパティを設定
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
      // TypeScriptの型エラーを回避するために型アサーションを使用
      (results as CurveLocation[]).unshift(loc);
    }
    
    prevTime = origTime;
    
    if (time < tMin) {
      segment = curve._segment1;
    } else if (time > tMax) {
      segment = curve._segment2;
    } else {
      // 曲線を時間で分割
      const newCurve = curve.divideAtTime(time);
      
      // ハンドルなしの曲線を追跡
      if (clearHandles) {
        clearCurves.push(curve);
        if (typeof newCurve === 'number') {
          // divideAtTimeがインデックスを返す場合、新しいカーブを取得
          const curves = curve._path._curves;
          if (curves && newCurve >= 0 && newCurve < curves.length) {
            clearCurves.push(curves[newCurve]);
          }
        }
      }
      
      if (typeof newCurve === 'number') {
        // divideAtTimeがインデックスを返す場合、新しいセグメントを取得
        const segments = curve._path._segments;
        if (segments && newCurve >= 0 && newCurve < segments.length) {
          segment = segments[newCurve];
        }
      } else {
        segment = curve._segment2;
      }
      
      // 同じ曲線内の他の位置の時間パラメータを正規化
      for (let j = renormalizeLocs.length - 1; j >= 0; j--) {
        const l = renormalizeLocs[j];
        l._time = (l._time! - time) / (1 - time);
      }
    }
    
    // セグメントに交差情報を設定
    loc._setSegment(segment!);
    
    // 交差点のリンクリストを作成
    const meta = getMeta(segment!);
    const inter = meta && meta.intersection;
    const dest = loc._intersection as unknown as IntersectionInfo; // 直そうとしたが大工事なので諦めた
    
    if (inter) {
      linkIntersections(inter, dest);
      
      // リンクリストの他のエントリにも新しいエントリへのリンクを追加
      let other = inter;
      while (other) {
        if (other._intersection) {
          linkIntersections(other._intersection, inter);
        }
        other = other.next!; // next!を使用してnullチェックエラーを回避
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
  // 各カーブのセグメントのハンドルをクリア
  for (let i = curves.length - 1; i >= 0; i--) {
    // 各カーブのセグメントのハンドルをクリア
    const curve = curves[i];
    if (curve._segment1) curve._segment1.clearHandles();
    if (curve._segment2) curve._segment2.clearHandles();
  }
}

/**
 * Boolean演算のためのパスを準備する
 * paper.jsのpreparePath関数を忠実に移植
 *
 * @param path 準備するパス
 * @param resolve 交差を解決するかどうか
 * @returns 準備されたパス
 */
export function preparePath(path: PathItem, resolve: boolean = false): PathItem {
  // paper.jsの実装をそのまま移植
  let res = path
      .clone(false)
      .reduce({ simplify: true })
      .transform(null, true, true);
  
  if (resolve) {
    // For correct results, close open paths with straight lines:
    const paths = res.getPaths();
    for (let i = 0, l = paths.length; i < l; i++) {
      const path = paths[i];
      if (!path._closed && !path.isEmpty()) {
        // Close with epsilon tolerance, to avoid tiny straight
        // that would cause issues with intersection detection.
        path.closePath(Numerical.EPSILON);
        path.getFirstSegment()!.setHandleIn(0, 0);
        path.getLastSegment()!.setHandleOut(0, 0);
      }
    }
    
    // paper.jsと同じようにメソッドチェーンを使用
    res = res
        .resolveCrossings()
        .reorient(res.getFillRule() === 'nonzero', true);
  }
  
  return res;
}
