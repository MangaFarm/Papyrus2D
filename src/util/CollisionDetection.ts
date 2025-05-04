/**
 * CollisionDetection クラス
 * Paper.js の CollisionDetection を参考にした衝突検出ユーティリティ。
 */

export class CollisionDetection {
  /**
   * 曲線の境界ボックス同士の衝突を検出（単一方向）
   * paper.jsのCollisionDetection.findCurveBoundsCollisions実装を移植
   * @param curves1 曲線の配列1
   * @param curves2 曲線の配列2（nullの場合は自己衝突チェック）
   * @param tolerance 許容誤差
   * @returns 衝突インデックスの配列
   */
  /**
   * 曲線の境界ボックスを計算
   * @param curves 曲線の配列
   * @returns 境界ボックスの配列
   */
  private static calculateCurveBounds(curves: number[][]): number[][] {
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

  static findCurveBoundsCollisions(
    curves1: number[][],
    curves2: number[][] | null,
    tolerance: number
  ): (number[] | null)[] {
    // 境界ボックスを計算
    const bounds1 = this.calculateCurveBounds(curves1);
    const bounds2 = !curves2 || curves2 === curves1
      ? bounds1
      : this.calculateCurveBounds(curves2);
    
    // 単一方向でチェック
    return this.findBoundsCollisions(bounds1, bounds2, tolerance || 0);
  }

  /**
   * 曲線の境界ボックス同士の衝突を検出（水平・垂直両方向）
   * paper.jsのCollisionDetection.findCurveBoundsCollisions実装を移植
   * @param curves1 曲線の配列1
   * @param curves2 曲線の配列2（nullの場合は自己衝突チェック）
   * @param tolerance 許容誤差
   * @returns 水平・垂直方向の衝突インデックスの配列
   */
  static findCurveBoundsCollisionsWithBothAxis(
    curves1: number[][],
    curves2: number[][] | null,
    tolerance: number
  ): { hor: number[] | null; ver: number[] | null }[] {
    // 境界ボックスを計算
    const bounds1 = this.calculateCurveBounds(curves1);
    const bounds2 = !curves2 || curves2 === curves1
      ? bounds1
      : this.calculateCurveBounds(curves2);
    
    // 水平方向と垂直方向の両方でチェック
    const hor = this.findBoundsCollisions(
      bounds1, bounds2, tolerance || 0, false, true);
    const ver = this.findBoundsCollisions(
      bounds1, bounds2, tolerance || 0, true, true);
    
    // 結果を組み合わせる
    const list: { hor: number[] | null; ver: number[] | null }[] = [];
    for (let i = 0, l = hor.length; i < l; i++) {
      list[i] = { hor: hor[i], ver: ver[i] };
    }
    return list;
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
  ): (number[] | null)[] {
    const self = !boundsB || boundsA === boundsB;
    const allBounds = self ? boundsA : boundsA.concat(boundsB!);
    const lengthA = boundsA.length;
    const lengthAll = allBounds.length;

    // バイナリサーチユーティリティ関数
    // 同じ値が複数ある場合、最も右側のエントリを返す
    // https://en.wikipedia.org/wiki/Binary_search_algorithm#Procedure_for_finding_the_rightmost_element
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
      let curCollisions: number[] | null = isCurrentA ? [] : null;
      
      if (activeIndicesByPri1.length) {
        // もはやアクティブでないインデックスを削除（プルーニング）
        const pruneCount = binarySearch(activeIndicesByPri1, pri1,
                curBounds[pri0] - tolerance) + 1;
        activeIndicesByPri1.splice(0, pruneCount);
        
        // 現在のインデックスの衝突を追加
        if (self && onlySweepAxisCollisions) {
          // すべてのアクティブインデックスを追加、追加チェック不要
          curCollisions = curCollisions!.concat(activeIndicesByPri1);
          // 現在のインデックスをすべてのアクティブインデックスの衝突に追加
          for (let j = 0; j < activeIndicesByPri1.length; j++) {
            const activeIndex = activeIndicesByPri1[j];
            // TypeScriptの型安全性のためのnullチェック
            // Paper.jsではこのチェックはありませんが、TypeScriptでは必要
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
    
    // paper.jsの実装に合わせて、nullを含む配列をそのまま返す
    return allCollisions;
  }
  
  /**
   * アイテムの境界ボックス同士の衝突を検出
   * paper.jsのCollisionDetection.findItemBoundsCollisions実装を移植
   * @param items1 アイテムの配列1
   * @param items2 アイテムの配列2（nullの場合は自己衝突チェック）
   * @param tolerance 許容誤差
   * @returns 衝突インデックスの配列
   */
  static findItemBoundsCollisions(
    items1: { getBounds(): { x: number; y: number; width: number; height: number } }[],
    items2: { getBounds(): { x: number; y: number; width: number; height: number } }[] | null,
    tolerance: number
  ): (number[] | null)[] {
    function getBounds(items: { getBounds(): { x: number; y: number; width: number; height: number } }[]): number[][] {
      const bounds = new Array(items.length);
      for (let i = 0; i < items.length; i++) {
        const rect = items[i].getBounds();
        // paper.jsと同様に[left, top, right, bottom]の配列に変換
        bounds[i] = [rect.x, rect.y, rect.x + rect.width, rect.y + rect.height];
      }
      return bounds;
    }

    const bounds1 = getBounds(items1);
    const bounds2 = !items2 || items2 === items1
      ? bounds1
      : getBounds(items2);
    return this.findBoundsCollisions(bounds1, bounds2, tolerance || 0);
  }
}