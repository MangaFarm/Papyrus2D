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
