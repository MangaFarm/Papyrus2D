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
        max(v[1], v[3], v[5], v[7]),
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
    const bounds2 = !curves2 || curves2 === curves1 ? bounds1 : this.calculateCurveBounds(curves2);

    // 許容誤差を大きめにして端点一致も衝突とみなす
    const effectiveTolerance = Math.max(tolerance, 1e-6); // もしくはNumerical.GEOMETRIC_EPSILON * 10

    // 単一方向でチェック
    return this.findBoundsCollisions(bounds1, bounds2, effectiveTolerance);
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
    const bounds2 = !curves2 || curves2 === curves1 ? bounds1 : this.calculateCurveBounds(curves2);

    // 水平方向と垂直方向の両方でチェック
    const hor = this.findBoundsCollisions(bounds1, bounds2, tolerance || 0, false, true);
    const ver = this.findBoundsCollisions(bounds1, bounds2, tolerance || 0, true, true);

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
    var self = !boundsB || boundsA === boundsB,
      allBounds = self ? boundsA : boundsA.concat(boundsB!),
      lengthA = boundsA.length,
      lengthAll = allBounds.length;

    // Binary search utility function.
    // For multiple same entries, this returns the rightmost entry.
    // https://en.wikipedia.org/wiki/Binary_search_algorithm#Procedure_for_finding_the_rightmost_element
    function binarySearch(indices: number[], coord: number, value: number) {
      var lo = 0,
        hi = indices.length;
      while (lo < hi) {
        var mid = (hi + lo) >>> 1; // Same as Math.floor((hi + lo) / 2)
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
    var pri0 = sweepVertical ? 1 : 0,
      pri1 = pri0 + 2,
      sec0 = sweepVertical ? 0 : 1,
      sec1 = sec0 + 2;
    // Create array with all indices sorted by lower boundary on primary
    // axis.
    var allIndicesByPri0 = new Array(lengthAll);
    for (var i = 0; i < lengthAll; i++) {
      allIndicesByPri0[i] = i;
    }
    allIndicesByPri0.sort(function (i1, i2) {
      return allBounds[i1][pri0] - allBounds[i2][pri0];
    });
    // Sweep along primary axis. Indices of active bounds are kept in an
    // array sorted by higher boundary on primary axis.
    var activeIndicesByPri1: number[] = [],
      allCollisions: (number[] | null)[] = new Array(lengthA);
    for (var i = 0; i < lengthAll; i++) {
      var curIndex = allIndicesByPri0[i],
        curBounds = allBounds[curIndex],
        // The original index in boundsA or boundsB:
        origIndex = self ? curIndex : curIndex - lengthA,
        isCurrentA = curIndex < lengthA,
        isCurrentB = self || !isCurrentA,
        curCollisions = isCurrentA ? ([] as number[]) : null;
      if (activeIndicesByPri1.length) {
        // remove (prune) indices that are no longer active.
        var pruneCount = binarySearch(activeIndicesByPri1, pri1, curBounds[pri0] - tolerance) + 1;
        activeIndicesByPri1.splice(0, pruneCount);
        // Add collisions for current index.
        if (self && onlySweepAxisCollisions) {
          // All active indexes can be added, no further checks needed
          curCollisions = (curCollisions as number[]).concat(activeIndicesByPri1);
          // Add current index to collisions of all active indexes
          for (var j = 0; j < activeIndicesByPri1.length; j++) {
            var activeIndex = activeIndicesByPri1[j];
            allCollisions[activeIndex]!.push(origIndex);
          }
        } else {
          var curSec1 = curBounds[sec1],
            curSec0 = curBounds[sec0];
          for (var j = 0; j < activeIndicesByPri1.length; j++) {
            var activeIndex = activeIndicesByPri1[j],
              activeBounds = allBounds[activeIndex],
              isActiveA = activeIndex < lengthA,
              isActiveB = self || activeIndex >= lengthA;

            // Check secondary axis bounds if necessary.
            if (
              onlySweepAxisCollisions ||
              (((isCurrentA && isActiveB) || (isCurrentB && isActiveA)) &&
                curSec1 >= activeBounds[sec0] - tolerance &&
                curSec0 <= activeBounds[sec1] + tolerance)
            ) {
              // Add current index to collisions of active
              // indices and vice versa。
              if (isCurrentA && isActiveB) {
                (curCollisions as number[]).push(self ? activeIndex : activeIndex - lengthA);
              }
              if (isCurrentB && isActiveA) {
                allCollisions[activeIndex]!.push(origIndex);
              }
            }
          }
        }
      }
      if (isCurrentA) {
        if (boundsA === boundsB) {
          // If both arrays are the same, add self collision.
          (curCollisions as number[]).push(curIndex);
        }
        // Add collisions for current index。
        allCollisions[curIndex] = curCollisions as number[];
      }
      // Add current index to active indices. Keep array sorted by
      // their higher boundary on the primary axis.s
      if (activeIndicesByPri1.length) {
        var curPri1 = curBounds[pri1],
          index = binarySearch(activeIndicesByPri1, pri1, curPri1);
        activeIndicesByPri1.splice(index + 1, 0, curIndex);
      } else {
        activeIndicesByPri1.push(curIndex);
      }
    }
    // Sort collision indices in ascending order.
    for (var i = 0; i < allCollisions.length; i++) {
      var collisions = allCollisions[i];
      if (collisions) {
        collisions.sort(function (i1, i2) {
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
