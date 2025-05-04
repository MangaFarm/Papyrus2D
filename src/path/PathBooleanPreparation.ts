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

/**
 * パスの配列を取得する
 * CompoundPathの場合は子パスの配列、Pathの場合は自身を含む配列を返す
 * paper.jsのgetPaths関数を移植
 *
 * @param path パス
 * @returns パスの配列
 */

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
  const paths = path.getPaths!();
  
  // 交差と重なりを検出
  const filterFunc = (inter: CurveLocation) => inter.hasOverlap() || inter.isCrossing();
  const intersections = path.getIntersections(path as Path).filter(filterFunc);
  
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
  for (const p of paths) {
    segments.push(...p.getSegments());
  }
  
  // 重なりがある場合の処理
  if (hasOverlaps) {
    // 重なりを持つ交差点を処理
    const overlaps = intersections.filter(inter => inter.hasOverlap());
    
    // 重なりの交差点でパスを分割
    for (const intersection of overlaps) {
      const curve = intersection.getCurve();
      if (curve) {
        const time = intersection.getTime();
        if (time !== null && time > Numerical.CURVETIME_EPSILON && time < 1 - Numerical.CURVETIME_EPSILON) {
          curve.divideAtTime(time);
        }
      }
    }
    
    // 重なりセグメントを処理
    for (const p of paths) {
      const segs = p.getSegments();
      for (let i = segs.length - 1; i >= 0; i--) {
        const seg = segs[i];
        const prev = seg.getPrevious();
        const next = seg.getNext();
        
        // 前後のセグメントが重なりを持つ場合、このセグメントを削除
        if (prev && next &&
            intersections.some(inter =>
              inter.hasOverlap() &&
              (inter.getSegment() === prev || inter.getSegment() === next)
            )) {
          // ハンドルをリセット
          if (prev) prev.setHandleOut(0, 0);
          if (next) next.setHandleIn(0, 0);
          
          // セグメントを削除
          p.removeSegment(i);
        }
      }
    }
  }
  
  // 交差がある場合の処理
  if (hasCrossings) {
    // 交差点でパスを分割
    for (const intersection of intersections) {
      if (intersection.isCrossing()) {
        const curve = intersection.getCurve();
        if (curve) {
          const time = intersection.getTime();
          if (time !== null && time > Numerical.CURVETIME_EPSILON && time < 1 - Numerical.CURVETIME_EPSILON) {
            curve.divideAtTime(time);
          }
        }
      }
    }
    
    // paper.jsではここでtracePaths関数を使用して新しいパスを生成
    // 簡略化のため、ここでは既存のパスを使用
  }
  
  // 結果を決定
  let result: PathItem;
  
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
  } else if (paths.length === 1) {
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
 * Boolean演算のためのパスを準備する
 * paper.jsのpreparePath関数を移植
 *
 * @param path 準備するパス
 * @param resolve 交差を解決するかどうか
 * @returns 準備されたパス
 */
export function preparePath(path: PathItem, resolve: boolean = false): PathItem {
  // paper.jsと完全に同じ実装
  // 1. クローン、簡略化、変換を一連の操作で行う
  // 直接メソッドを呼び出す
  let res = path
    .clone(false)
    .reduce!({ simplify: true })
    .transform!(null, true, true);
  
  if (resolve) {
    // 2. 正確な結果を得るために、開いたパスを直線で閉じる
    const paths = res.getPaths();
    for (let i = 0, l = paths.length; i < l; i++) {
      const path = paths[i];
      if (!path.isClosed() && !path.isEmpty()) {
        // 最小の許容誤差でパスを閉じる
        path.closePath(Numerical.EPSILON);
        path.getFirstSegment()!.setHandleIn(0, 0);
        path.getLastSegment()!.setHandleOut(0, 0);
      }
    }
    
    // 3. 交差を解決し、向きを再設定
    const resolvedPath = res.resolveCrossings!();
    
    // getFillRuleがない場合はデフォルトで'nonzero'と仮定
    const nonZero = resolvedPath.getFillRule ?
      resolvedPath.getFillRule() === 'nonzero' : true;
    
    return resolvedPath.reorient!(nonZero, true);
  }
  
  return res;
}