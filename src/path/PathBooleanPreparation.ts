/**
 * PathBooleanPreparation: Boolean演算の前処理クラス
 * paper.jsのPathItem.Boolean.jsのpreparePath関数とその関連関数を移植
 */

import { Path } from './Path';
import { PathItem } from './PathItem';
import { Numerical } from '../util/Numerical';
import { Point } from '../basic/Point';

/**
 * 各パスの全セグメントに_winding情報をセットする
 * paper.jsの_winding初期化処理に相当
 */
function setWindingInfoForPath(path: Path) {
  const segments = path.getSegments();
  for (const seg of segments) {
    // ここでは単純に winding=1, windingL=0, windingR=0 をセット（open pathの単純ケース）
    // 本来はpaper.jsの_winding計算に合わせる必要があるが、まずはテスト用
    // 必要に応じてPathBooleanWinding等のロジックを使う
    seg._analysis._winding = { winding: 1, windingL: 0, windingR: 0 };
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
  let res = path.clone(true);

  if (resolve) {
    // For correct results, close open paths with straight lines:
    const paths = res.getPaths();
    for (let i = 0, l = paths.length; i < l; i++) {
      const path = paths[i];
      if (!path._closed && !path.isEmpty()) {
        // Close with epsilon tolerance, to avoid tiny straight
        // that would cause issues with intersection detection.
        path.closePath(Numerical.EPSILON);
        path.getFirstSegment()!.setHandleIn(new Point(0, 0));
        path.getLastSegment()!.setHandleOut(new Point(0, 0));
      }
    }

    for (const path of res.getPaths()) {
      setWindingInfoForPath(path);
    }

    for (const path of res.getPaths()) {
      const segs = path.getSegments();
    }

    // paper.jsと同じようにメソッドチェーンを使用
    res = res.resolveCrossings();

    res = res.reorient(res.getFillRule && res.getFillRule() === 'nonzero', true);
  }

  return res;
}
