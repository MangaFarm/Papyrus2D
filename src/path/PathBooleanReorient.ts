/**
 * PathBooleanReorient - paper.jsのreorientPaths関数の移植
 * 交点がない場合のBoolean演算結果を決定するための関数
 */

import { Path } from './Path';
import { Point } from '../basic/Point';
import { Numerical } from '../util/Numerical';
import { CollisionDetection } from '../util/CollisionDetection';
import { CurveSubdivision } from './CurveSubdivision';
import { CurveCalculation } from './CurveCalculation';
import { CurveLocationUtils } from './CurveLocationUtils';

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
  clockwise?: boolean,
): Path[] {
  const length = paths && paths.length;
  if (!length) {
    return paths;
  }

  // パスの情報を格納するルックアップテーブルを作成
  const lookup = paths.reduce((lookup: Record<string, {
    container: Path | null;
    winding: number;
    index: number;
    exclude?: boolean;
  }>, path, i) => {
    // 各パスの情報を登録
    lookup[path._id] = {
      container: null,
      winding: path.isClockwise() ? 1 : -1,
      index: i
    };
    return lookup;
  }, {});

  // パスを面積でソート（大きい順）
  const sorted = paths.slice().sort((a, b) => {
    return Math.abs(b.getArea()) - Math.abs(a.getArea());
  });

  // 最初の（最大の）パスを取得
  const first = sorted[0];
  
  // 時計回りの方向が指定されていない場合は最大のパスの方向を使用
  if (clockwise === undefined) {
    clockwise = first.isClockwise();
  }

  // パスの衝突検出のための境界ボックスを計算
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
    // 「内部性」が変わる場合のみパスを保持
    if (isInside(entry1.winding) === isInside(containerWinding)) {
      entry1.exclude = true;
      paths[entry1.index] = null as unknown as Path; // 直そうとしたが大工事になるのでそのまま この破壊的操作は意図的であるらしい
    } else {
      // 含むパスが除外されていない場合、方向を設定
      const container = entry1.container;
      
      // unite演算時はすべてclockwise（正の面積）に揃える
      if (typeof isInside === 'function' && isInside(1) && isInside(2)) {
        path1.setClockwise(true);
      } else {
        path1.setClockwise(
          container ? !container.isClockwise() : clockwise
        );
      }
    }
  }

  // paper.jsの実装に合わせて、nullを含む配列をそのまま返す
  // CompoundPath.addChildrenメソッドがnullの要素を無視するため
  return paths;
}
/**
 * パスの内部点を取得する
 * paper.jsのgetInteriorPoint関数を移植
 *
 * @returns パスの内部にある点
 */
export function getInteriorPoint(path: Path): Point {
  const bounds = path.getBounds();
  let point = bounds.center;
  
  if (!path.contains(point)) {
    // バウンディングボックスの中心が必ずしもパスの内部にあるとは限らないため、
    // x方向に光線を発射し、左側の連続する交点間の点を選択する
    const curves = path.getCurves();
    const y = point.y;
    const intercepts: number[] = [];
    const roots: number[] = [];
    
    // y座標と交差するすべてのy単調曲線を処理
    for (let i = 0, l = curves.length; i < l; i++) {
      const v = curves[i].getValues();
      const o0 = v[1];
      const o1 = v[3];
      const o2 = v[5];
      const o3 = v[7];
      
      if (y >= Math.min(o0, o1, o2, o3) && y <= Math.max(o0, o1, o2, o3)) {
        const monoCurves = CurveSubdivision.getMonoCurves(v);
        
        for (let j = 0, m = monoCurves.length; j < m; j++) {
          const mv = monoCurves[j];
          const mo0 = mv[1];
          const mo3 = mv[7];
          
          // y方向に変化があり、点のy座標と交差する曲線のみを処理
          if (mo0 !== mo3 &&
              (y >= mo0 && y <= mo3 || y >= mo3 && y <= mo0)) {
            let x;
            
            if (y === mo0) {
              x = mv[0];
            } else if (y === mo3) {
              x = mv[6];
            } else {
              // 曲線上のy座標に対応するx座標を求める
              const count = CurveLocationUtils.solveCubic(
                mv,
                1,
                y,
                roots,
                { min: 0, max: 1 }
              );
              x = count === 1
                ? CurveCalculation.getPoint(mv, roots[0])!.x
                : (mv[0] + mv[6]) / 2;
            }
            
            intercepts.push(x);
          }
        }
      }
    }
    
    if (intercepts.length > 1) {
      // x座標でソートし、最初の2つの交点の中間を選択
      intercepts.sort((a, b) => a - b);
      point = new Point((intercepts[0] + intercepts[1]) / 2, point.y);
    }
  }
  
  return point;
}