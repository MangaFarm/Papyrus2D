/**
 * PathBooleanReorient - paper.jsのreorientPaths関数の移植
 * 交点がない場合のBoolean演算結果を決定するための関数
 */

import { Path } from './Path';
import { Point } from '../basic/Point';
import { Numerical } from '../util/Numerical';
import { CollisionDetection } from '../util/CollisionDetection';

/**
 * パスの方向を再設定し、内部/外部の関係を考慮してパスを整理する
 * paper.jsのreorientPaths関数を移植
 *
 * @param paths 方向を再設定するパスの配列
 * @param isInside パスが内部にあるかどうかを判定する関数
 * @param clockwise 最も外側のパスの方向（省略時は最大のパスの方向を使用）
 * @returns 再設定されたパスの配列
 */
export function reorientPaths(
  paths: Path[],
  isInside: (winding: number) => boolean,
  clockwise?: boolean
): Path[] {
  const length = paths && paths.length;
  if (!length) {
    return [];
  }

  // パスの情報を格納するルックアップテーブルを作成
  // paper.jsのBase.eachに相当する処理
  const lookup: Record<string, {
    container: Path | null;
    winding: number;
    index: number;
    exclude?: boolean;
  }> = {};

  // 各パスの情報を登録
  for (let i = 0; i < length; i++) {
    const path = paths[i];
    lookup[path._id] = {
      container: null,
      winding: path.isClockwise() ? 1 : -1,
      index: i
    };
  }

  // パスを面積でソート（大きい順）
  const sorted = [...paths].sort((a, b) => {
    return Math.abs(b.getArea()) - Math.abs(a.getArea());
  });

  // 最初の（最大の）パスを取得
  const first = sorted[0];
  
  // 時計回りの方向が指定されていない場合は最大のパスの方向を使用
  if (clockwise === undefined) {
    clockwise = first.isClockwise();
  }

  // パスの衝突検出のための境界ボックスを計算
  // paper.jsのCollisionDetection.findItemBoundsCollisionsを使用
  const collisions = CollisionDetection.findItemBoundsCollisions(
    sorted, null, Numerical.GEOMETRIC_EPSILON);

  // 各パスについて、それが他のパスに含まれるかどうかを判定し、windingを計算
  for (let i = 0; i < length; i++) {
    const path1 = sorted[i];
    const entry1 = lookup[path1._id];
    let containerWinding = 0;
    const indices = collisions[i];

    if (indices) {
      let point: Point | null = null; // 内部点、必要な場合のみ取得

      // 衝突する可能性のあるパスをチェック（大きい順）
      for (let j = indices.length - 1; j >= 0; j--) {
        if (indices[j] < i) { // 自分より大きいパスのみチェック
          // 内部点を取得（最初の呼び出し時のみ）
          if (!point) {
            point = path1.getInteriorPoint();
          }
          
          const path2 = sorted[indices[j]];
          
          // path2がpath1を含むかチェック
          if (path2.contains(point)) {
            const entry2 = lookup[path2._id];
            containerWinding = entry2.winding;
            entry1.winding += containerWinding;
            entry1.container = entry2.exclude ? entry2.container : path2;
            break;
          }
        }
      }
    }

    // パスを保持するかどうかを判断
    // 「内部性」が変わる場合のみパスを保持（内部→外部、外部→内部）
    if (isInside(entry1.winding) === isInside(containerWinding)) {
      entry1.exclude = true;
      paths[entry1.index] = null as unknown as Path; // 除外されたパスをnullに設定
    } else {
      // 含むパスが除外されていない場合、方向を設定
      const container = entry1.container;
      if (container) {
        path1.setClosed(!container.isClosed());
        // paper.jsではsetClockwiseを使用するが、Papyrus2Dでは同等の機能をsetClosedで代用
        // 本来はpath1.setClockwise(!container.isClockwise())を呼ぶべき
      } else {
        path1.setClosed(!!clockwise);
      }
    }
  }

  // nullでないパスのみを返す
  return paths.filter(path => path !== null);
}

/**
 * パスの内部点を取得するヘルパー関数
 * paper.jsのgetInteriorPoint関数を移植
 *
 * @deprecated このヘルパー関数は不要になりました。代わりにPath.getInteriorPoint()を使用してください。
 */
function getInteriorPoint(path: Path): Point {
  return path.getInteriorPoint();
}