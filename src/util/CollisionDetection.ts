/**
 * CollisionDetection クラス
 * Paper.js の CollisionDetection を参考にした衝突検出ユーティリティ。
 */

export class CollisionDetection {
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
        max(v[1], v[3], v[5], v[7]),
      ];
    }

    return bounds;
  }

  static findCurveBoundsCollisions(
    curves1: number[][],
    curves2: number[][] | null,
    tolerance: number,
    bothAxis: boolean
  ): { hor: number[], ver: number[] }[] | number[][] { // both axis or one axis
    function getBounds(curves) {
      var min = Math.min,
        max = Math.max,
        bounds = new Array(curves.length);
      for (var i = 0; i < curves.length; i++) {
        var v = curves[i];
        bounds[i] = [
          min(v[0], v[2], v[4], v[6]),
          min(v[1], v[3], v[5], v[7]),
          max(v[0], v[2], v[4], v[6]),
          max(v[1], v[3], v[5], v[7]),
        ];
      }
      return bounds;
    }

    var bounds1 = getBounds(curves1),
      bounds2 = !curves2 || curves2 === curves1 ? bounds1 : getBounds(curves2);
    if (bothAxis) {
      var hor = this.findBoundsCollisions(bounds1, bounds2, tolerance || 0, false, true),
        ver = this.findBoundsCollisions(bounds1, bounds2, tolerance || 0, true, true),
        list: {hor:number[],ver:number[]}[] = [];
      for (var i = 0, l = hor.length; i < l; i++) {
        list[i] = { hor: hor[i], ver: ver[i] };
      }
      return list;
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
    const self: boolean = !boundsB || boundsA === boundsB;
    const allBounds: number[][] = self ? boundsA : boundsA.concat(boundsB!);
    const lengthA: number = boundsA.length;
    const lengthAll: number = allBounds.length;

    // Binary search utility function.
    // For multiple same entries, this returns the rightmost entry.
    // https://en.wikipedia.org/wiki/Binary_search_algorithm#Procedure_for_finding_the_rightmost_element
    function binarySearch(indices: number[], coord: number, value: number): number {
      let lo: number = 0,
        hi: number = indices.length;
      while (lo < hi) {
        const mid: number = (hi + lo) >>> 1; // Same as Math.floor((hi + lo) / 2)
        if (allBounds[indices[mid]][coord] < value) {
          lo = mid + 1;
        } else {
          hi = mid;
        }
      }
      return lo - 1;
    }

    // Set coordinates for primary and secondary axis depending on sweep
    // direction. By default we sweep in horizontal direction, which
    // means x is the primary axis.
    const pri0: number = sweepVertical ? 1 : 0,
      pri1: number = pri0 + 2,
      sec0: number = sweepVertical ? 0 : 1,
      sec1: number = sec0 + 2;
    // Create array with all indices sorted by lower boundary on primary
    // axis.
    const allIndicesByPri0: number[] = new Array(lengthAll);
    for (let i = 0; i < lengthAll; i++) {
      allIndicesByPri0[i] = i;
    }
    allIndicesByPri0.sort(function (i1: number, i2: number) {
      return allBounds[i1][pri0] - allBounds[i2][pri0];
    });
    // Sweep along primary axis. Indices of active bounds are kept in an
    // array sorted by higher boundary on primary axis.
    const activeIndicesByPri1: number[] = [];
    const allCollisions: number[][] = new Array(lengthA);
    for (let i = 0; i < lengthAll; i++) {
      const curIndex: number = allIndicesByPri0[i],
        curBounds: number[] = allBounds[curIndex],
        // The original index in boundsA or boundsB:
        origIndex: number = self ? curIndex : curIndex - lengthA,
        isCurrentA: boolean = curIndex < lengthA,
        isCurrentB: boolean = self || !isCurrentA;
      let curCollisions: number[] | null = isCurrentA ? [] : null;
      if (activeIndicesByPri1.length) {
        // remove (prune) indices that are no longer active.
        const pruneCount: number =
          binarySearch(activeIndicesByPri1, pri1, curBounds[pri0] - tolerance) + 1;
        activeIndicesByPri1.splice(0, pruneCount);
        // Add collisions for current index.
        if (self && onlySweepAxisCollisions) {
          // All active indexes can be added, no further checks needed
          curCollisions = curCollisions!.concat(activeIndicesByPri1);
          // Add current index to collisions of all active indexes
          for (let j = 0; j < activeIndicesByPri1.length; j++) {
            const activeIndex: number = activeIndicesByPri1[j];
            allCollisions[activeIndex].push(origIndex);
          }
        } else {
          const curSec1: number = curBounds[sec1],
            curSec0: number = curBounds[sec0];
          for (let j = 0; j < activeIndicesByPri1.length; j++) {
            const activeIndex: number = activeIndicesByPri1[j],
              activeBounds: number[] = allBounds[activeIndex],
              isActiveA: boolean = activeIndex < lengthA,
              isActiveB: boolean = self || activeIndex >= lengthA;

            // Check secondary axis bounds if necessary.
            if (
              onlySweepAxisCollisions ||
              (((isCurrentA && isActiveB) || (isCurrentB && isActiveA)) &&
                curSec1 >= activeBounds[sec0] - tolerance &&
                curSec0 <= activeBounds[sec1] + tolerance)
            ) {
              // Add current index to collisions of active
              // indices and vice versa.
              if (isCurrentA && isActiveB) {
                curCollisions!.push(self ? activeIndex : activeIndex - lengthA);
              }
              if (isCurrentB && isActiveA) {
                allCollisions[activeIndex].push(origIndex);
              }
            }
          }
        }
      }
      if (isCurrentA) {
        if (boundsA === boundsB) {
          // If both arrays are the same, add self collision.
          curCollisions!.push(curIndex);
        }
        // Add collisions for current index.
        allCollisions[curIndex] = curCollisions!;
      }
      // Add current index to active indices. Keep array sorted by
      // their higher boundary on the primary axis.s
      if (activeIndicesByPri1.length) {
        const curPri1: number = curBounds[pri1],
          index: number = binarySearch(activeIndicesByPri1, pri1, curPri1);
        activeIndicesByPri1.splice(index + 1, 0, curIndex);
      } else {
        activeIndicesByPri1.push(curIndex);
      }
    }
    // Sort collision indices in ascending order.
    for (let i = 0; i < allCollisions.length; i++) {
      const collisions = allCollisions[i];
      if (collisions) {
        collisions.sort(function (i1: number, i2: number) {
          return i1 - i2;
        });
      }
    }
    return allCollisions;
  }

  /**
   * アイテムの境界ボックス同士の衝突を検出
   * paper.jsのCollisionDetection.findItemBoundsCollisions実装を厳密に移植
   */
  static findItemBoundsCollisions(
    items1: { getBounds(): { left: number; top: number; right: number; bottom: number } }[],
    items2: { getBounds(): { left: number; top: number; right: number; bottom: number } }[] | null,
    tolerance?: number
  ): (number[] | null)[] {
    function getBounds(
      items: { getBounds(): { left: number; top: number; right: number; bottom: number } }[]
    ): number[][] {
      const bounds = new Array(items.length);
      for (let i = 0; i < items.length; i++) {
        const rect = items[i].getBounds();
        bounds[i] = [rect.left, rect.top, rect.right, rect.bottom];
      }
      return bounds;
    }

    const bounds1 = getBounds(items1);
    const bounds2 = !items2 || items2 === items1 ? bounds1 : getBounds(items2);
    return this.findBoundsCollisions(bounds1, bounds2, tolerance || 0);
  }
}
