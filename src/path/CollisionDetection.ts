/**
 * CollisionDetection クラス
 * Paper.js の CollisionDetection を参考にした衝突検出ユーティリティ。
 */

export class CollisionDetection {
  /**
   * 曲線の境界ボックス同士の衝突を検出
   * paper.jsのCollisionDetection.findCurveBoundsCollisions実装を移植
   */
  static findCurveBoundsCollisions(
    curves1: number[][],
    curves2: number[][] | null,
    tolerance: number,
    bothAxis?: boolean
  ): number[][] {
    // 🔥 paper.jsのfindCurveBoundsCollisions実装
    function getBounds(curves: number[][]): number[][] {
      const min = Math.min;
      const max = Math.max;
      const bounds = new Array(curves.length);
      for (let i = 0; i < curves.length; i++) {
        const v = curves[i];
        bounds[i] = [
          min(v[0], v[2], v[4], v[6]),
          min(v[1], v[3], v[5], v[7]),
          max(v[0], v[2], v[4], v[6]),
          max(v[1], v[3], v[5], v[7])
        ];
      }
      return bounds;
    }

    const bounds1 = getBounds(curves1);
    const bounds2 = !curves2 || curves2 === curves1
      ? bounds1
      : getBounds(curves2);
    
    if (bothAxis) {
      const hor = this.findBoundsCollisions(
        bounds1, bounds2, tolerance || 0, false, true);
      const ver = this.findBoundsCollisions(
        bounds1, bounds2, tolerance || 0, true, true);
      const list: { hor: number[]; ver: number[] }[] = [];
      for (let i = 0, l = hor.length; i < l; i++) {
        list[i] = { hor: hor[i], ver: ver[i] };
      }
      return list as any; // 型キャストで対応
    }
    
    return this.findBoundsCollisions(bounds1, bounds2, tolerance || 0);
  }

  /**
   * 境界ボックス同士の衝突を検出
   * paper.jsのCollisionDetection.findBoundsCollisions実装を移植
   */
  static findBoundsCollisions(
    boundsA: number[][],
    boundsB: number[][] | null,
    tolerance: number,
    sweepVertical?: boolean,
    onlySweepAxisCollisions?: boolean
  ): number[][] {
    // PATHITEM_INTERSECTIONS.mdに記載されている実装を使用
    const self = !boundsB || boundsA === boundsB;
    const allBounds = self ? boundsA : boundsA.concat(boundsB!);
    const lengthA = boundsA.length;
    const lengthAll = allBounds.length;

    // バイナリサーチユーティリティ関数
    function binarySearch(indices: number[], coord: number, value: number): number {
      let lo = 0;
      let hi = indices.length;
      while (lo < hi) {
        const mid = (hi + lo) >>> 1; // Math.floor((hi + lo) / 2)と同じ
        if (allBounds[indices[mid]][coord] < value) {
          lo = mid + 1;
        } else {
          hi = mid;
        }
      }
      return lo - 1;
    }

    // 主軸と副軸の座標設定
    const pri0 = sweepVertical ? 1 : 0;
    const pri1 = pri0 + 2;
    const sec0 = sweepVertical ? 0 : 1;
    const sec1 = sec0 + 2;
    
    // 主軸の下限でソートされた全インデックスの配列を作成
    const allIndicesByPri0 = new Array(lengthAll);
    for (let i = 0; i < lengthAll; i++) {
      allIndicesByPri0[i] = i;
    }
    allIndicesByPri0.sort((i1, i2) => {
      return allBounds[i1][pri0] - allBounds[i2][pri0];
    });
    
    // 主軸に沿ってスイープ
    const activeIndicesByPri1: number[] = [];
    const allCollisions: (number[] | null)[] = new Array(lengthA);
    
    for (let i = 0; i < lengthAll; i++) {
      const curIndex = allIndicesByPri0[i];
      const curBounds = allBounds[curIndex];
      // オリジナルのインデックス（boundsAまたはboundsB内）
      const origIndex = self ? curIndex : curIndex - lengthA;
      const isCurrentA = curIndex < lengthA;
      const isCurrentB = self || !isCurrentA;
      const curCollisions: number[] | null = isCurrentA ? [] : null;
      
      if (activeIndicesByPri1.length) {
        // もはやアクティブでないインデックスを削除（プルーニング）
        const pruneCount = binarySearch(activeIndicesByPri1, pri1,
                curBounds[pri0] - tolerance) + 1;
        activeIndicesByPri1.splice(0, pruneCount);
        
        // 現在のインデックスの衝突を追加
        if (self && onlySweepAxisCollisions) {
          // すべてのアクティブインデックスを追加、追加チェック不要
          if (curCollisions) {
            curCollisions.push(...activeIndicesByPri1);
          }
          // 現在のインデックスをすべてのアクティブインデックスの衝突に追加
          for (let j = 0; j < activeIndicesByPri1.length; j++) {
            const activeIndex = activeIndicesByPri1[j];
            if (allCollisions[activeIndex]) {
              allCollisions[activeIndex].push(origIndex);
            }
          }
        } else {
          const curSec1 = curBounds[sec1];
          const curSec0 = curBounds[sec0];
          for (let j = 0; j < activeIndicesByPri1.length; j++) {
            const activeIndex = activeIndicesByPri1[j];
            const activeBounds = allBounds[activeIndex];
            const isActiveA = activeIndex < lengthA;
            const isActiveB = self || activeIndex >= lengthA;

            // 必要に応じて副軸の境界をチェック
            if (
              onlySweepAxisCollisions ||
              (
                isCurrentA && isActiveB ||
                isCurrentB && isActiveA
              ) && (
                curSec1 >= activeBounds[sec0] - tolerance &&
                curSec0 <= activeBounds[sec1] + tolerance
              )
            ) {
              // 現在のインデックスをアクティブインデックスの衝突に追加し、
              // その逆も同様
              if (isCurrentA && isActiveB && curCollisions) {
                curCollisions.push(
                  self ? activeIndex : activeIndex - lengthA);
              }
              if (isCurrentB && isActiveA && allCollisions[activeIndex]) {
                allCollisions[activeIndex].push(origIndex);
              }
            }
          }
        }
      }
      
      if (isCurrentA) {
        if (boundsA === boundsB) {
          // 両方の配列が同じ場合、自己衝突を追加
          if (curCollisions) {
            curCollisions.push(curIndex);
          }
        }
        // 現在のインデックスの衝突を追加
        if (curCollisions) {
          allCollisions[curIndex] = curCollisions;
        }
      }
      
      // 現在のインデックスをアクティブインデックスに追加
      // 主軸の上限でソートされた配列を維持
      if (activeIndicesByPri1.length) {
        const curPri1 = curBounds[pri1];
        const index = binarySearch(activeIndicesByPri1, pri1, curPri1);
        activeIndicesByPri1.splice(index + 1, 0, curIndex);
      } else {
        activeIndicesByPri1.push(curIndex);
      }
    }
    
    // 衝突インデックスを昇順にソート
    for (let i = 0; i < allCollisions.length; i++) {
      const collisions = allCollisions[i];
      if (collisions) {
        collisions.sort((i1, i2) => i1 - i2);
      }
    }
    
    // nullを空配列に変換して返す
    const result: number[][] = [];
    for (let i = 0; i < allCollisions.length; i++) {
      result[i] = allCollisions[i] || [];
    }
    
    return result;
  }
}