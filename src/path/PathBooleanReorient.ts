/**
 * PathBooleanReorient - paper.jsのreorientPaths関数の移植
 * 交点がない場合のBoolean演算結果を決定するための関数
 */

import { Path } from './Path';
import { Point } from '../basic/Point';
import { Numerical } from '../util/Numerical';

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
  const lookup: Record<number, {
    container: Path | null;
    winding: number;
    index: number;
    exclude?: boolean;
  }> = {};

  // 各パスの情報を登録
  for (let i = 0; i < length; i++) {
    const path = paths[i];
    lookup[i] = {
      container: null,
      winding: path.isClosed() ? 1 : -1,
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
    clockwise = first.isClosed();
  }

  // パスの衝突検出のための境界ボックスを計算
  const collisions: number[][] = [];
  for (let i = 0; i < length; i++) {
    collisions[i] = [];
    const path1 = sorted[i];
    const bounds1 = path1.getBounds();

    for (let j = 0; j < length; j++) {
      if (i !== j) {
        const path2 = sorted[j];
        const bounds2 = path2.getBounds();
        
        // 境界ボックスが交差するかチェック（イプシロン許容誤差付き）
        if (bounds1.x - Numerical.GEOMETRIC_EPSILON <= bounds2.x + bounds2.width &&
            bounds1.x + bounds1.width + Numerical.GEOMETRIC_EPSILON >= bounds2.x &&
            bounds1.y - Numerical.GEOMETRIC_EPSILON <= bounds2.y + bounds2.height &&
            bounds1.y + bounds1.height + Numerical.GEOMETRIC_EPSILON >= bounds2.y) {
          collisions[i].push(j);
        }
      }
    }
  }

  // 各パスについて、それが他のパスに含まれるかどうかを判定し、windingを計算
  for (let i = 0; i < length; i++) {
    const path1 = sorted[i];
    const entry1 = lookup[i];
    let containerWinding = 0;
    const indices = collisions[i];

    if (indices && indices.length) {
      let point: Point | null = null; // 内部点、必要な場合のみ取得

      // 衝突する可能性のあるパスをチェック（大きい順）
      for (let j = indices.length - 1; j >= 0; j--) {
        if (indices[j] < i) { // 自分より大きいパスのみチェック
          // 内部点を取得（最初の呼び出し時のみ）
          if (!point) {
            point = getInteriorPoint(path1);
          }
          
          if (point) {
            const path2 = sorted[indices[j]];
            
            // path2がpath1を含むかチェック
            if (path2.contains(point)) {
              const entry2 = lookup[indices[j]];
              containerWinding = entry2.winding;
              entry1.winding += containerWinding;
              entry1.container = entry2.exclude ? entry2.container : path2;
              break;
            }
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
 */
function getInteriorPoint(path: Path): Point {
  const bounds = path.getBounds();
  const point = new Point(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  
  // 中心点がパス内部にない場合は、別の方法で内部点を探す
  if (!path.contains(point)) {
    // パスの最初のセグメントの点を使用
    const firstSegment = path.getFirstSegment();
    if (firstSegment) {
      return firstSegment.point;
    }
  }
  
  return point;
}