/**
 * CurveIntersections
 * Paper.js の曲線交点計算関連の関数を移植したユーティリティ。
 */

import { Curve, CurveLocation } from './Curve';
import { Numerical } from '../util/Numerical';
import { Point } from '../basic/Point';

/**
 * 自己交差チェック
 * paper.jsのgetSelfIntersection実装を移植
 */
/**
 * 自己交差チェック
 * paper.jsのgetSelfIntersection実装を移植
 */
export function getSelfIntersection(
  v1: number[],
  c1: Curve,
  locations: CurveLocation[],
  include?: (loc: CurveLocation) => boolean
): CurveLocation[] {
  // paper.jsと完全に同じ実装
  const info = Curve.classify(v1);
  if (info.type === 'loop' && info.roots) {
    addLocation(locations, include,
      c1, info.roots[0],
      c1, info.roots[1]);
  }
  return locations;
}

/**
 * 交点情報を追加
 * paper.jsのaddLocation実装を移植
 */
/**
 * 交点情報を追加
 * paper.jsのaddLocation実装を移植
 */
export function addLocation(
  locations: CurveLocation[],
  include: ((loc: CurveLocation) => boolean) | undefined,
  c1: Curve,
  t1: number | null,
  c2: Curve,
  t2: number | null,
  overlap: boolean = false
): void {
  // Paper.jsと同様の実装
  // 端点の除外判定
  const excludeStart = !overlap && c1.getPrevious() === c2;
  const excludeEnd = !overlap && c1 !== c2 && c1.getNext() === c2;
  const tMin = Numerical.CURVETIME_EPSILON;
  const tMax = 1 - tMin;
  
  // 範囲チェック - paper.jsと同様の条件判定
  if (t1 !== null && t1 >= (excludeStart ? tMin : 0) && t1 <= (excludeEnd ? tMax : 1)) {
    if (t2 !== null && t2 >= (excludeEnd ? tMin : 0) && t2 <= (excludeStart ? tMax : 1)) {
      // Paper.jsと同様に、交点の座標をnullで初期化
      // 後で必要に応じて計算される
      const point: Point | null = null;
      
      // Paper.jsと同様に2つのCurveLocationを作成し、相互参照を設定
      // paper.jsでは、交点が見つかった時点でCurveLocationオブジェクトが作成され、
      // 後から曲線インデックスが設定される
      const loc1 = new CurveLocation(
        c1, t1, c2, t2, point, overlap
      );
      
      const loc2 = new CurveLocation(
        c2, t2, c1, t1, point, overlap
      );
      
      // 相互参照を設定
      loc1._intersection = loc2;
      loc2._intersection = loc1;
      
      // includeコールバックがなければ、または条件を満たせば追加
      if (!include || include(loc1)) {
        // Paper.jsと同様に、includeOverlapsパラメータを省略（デフォルトはfalse）
        insertLocation(locations, loc1);
      }
    }
  }
}

/**
 * 重複する交点をフィルタリングしながら交点情報を挿入
 * paper.jsのCurveLocation.insert実装を移植
 */
/**
 * Paper.jsのCurveLocation.insertメソッドを移植
 * 重複する交点をフィルタリングしながら交点情報を挿入
 */
function insertLocation(locations: CurveLocation[], location: CurveLocation, includeOverlaps: boolean = false): number {
  const length = locations.length;
  
  // Paper.jsと同様に連結リストを構築
  if (length > 0) {
    let current = locations[length - 1];
    current._next = location;
    location._previous = current;
  }
  
  // 重複する交点をフィルタリング
  const geomEpsilon = Numerical.GEOMETRIC_EPSILON;
  const curveEpsilon = Numerical.CURVETIME_EPSILON;
  
  // 既存の交点と比較して、近接している場合は追加しない
  for (let i = 0; i < length; i++) {
    const loc = locations[i];
    
    // 点の距離が十分に近い場合は重複とみなす
    // paper.jsと同様に、点の距離を計算
    if (loc.point && location.point) {
      const dist = loc.point.subtract(location.point).getLength();
      if (dist < geomEpsilon) {
        // 交点が既に存在する場合は、相互参照を更新
        if (location._intersection && loc._intersection) {
          // 既存の交点の相互参照を新しい交点の相互参照に更新
          loc._intersection._intersection = location._intersection;
          location._intersection._intersection = loc._intersection;
        }
        
        // 重複を許可する場合のみ追加
        if (includeOverlaps) {
          locations.push(location);
          return length;
        }
        
        return i;
      }
    }
    
    // 同じ曲線上の交点で、tパラメータが近い場合は重複とみなす
    // paper.jsと同様に、curve1IndexとcurveIndex2の比較は行わない
    // （これらの値はまだ設定されていない可能性があるため）
    if (loc.t1 !== null && location.t1 !== null && loc.t2 !== null && location.t2 !== null) {
      const t1Diff = Math.abs(loc.t1 - location.t1);
      const t2Diff = Math.abs(loc.t2 - location.t2);
      
      if (t1Diff < curveEpsilon && t2Diff < curveEpsilon) {
        // 重複を許可する場合のみ追加
        if (includeOverlaps) {
          locations.push(location);
          return length;
        }
        return i;
      }
    }
  }
  
  // 重複がない場合は追加
  locations.push(location);
  return length;
}

/**
 * 曲線同士の交点計算
 * paper.jsのgetCurveIntersections実装を移植
 */
/**
 * 曲線同士の交点計算
 * paper.jsのgetCurveIntersections実装を移植
 */
export function getCurveIntersections(
  v1: number[],
  v2: number[],
  c1: Curve,
  c2: Curve,
  locations: CurveLocation[],
  include?: (loc: CurveLocation) => boolean
): CurveLocation[] {
  // 境界ボックスが完全に外れている場合はチェックしない
  const epsilon = Numerical.GEOMETRIC_EPSILON;
  const min = Math.min;
  const max = Math.max;

  // Paper.jsと同様の境界ボックスチェック
  const v1xMin = min(v1[0], v1[2], v1[4], v1[6]);
  const v1xMax = max(v1[0], v1[2], v1[4], v1[6]);
  const v1yMin = min(v1[1], v1[3], v1[5], v1[7]);
  const v1yMax = max(v1[1], v1[3], v1[5], v1[7]);
  
  const v2xMin = min(v2[0], v2[2], v2[4], v2[6]);
  const v2xMax = max(v2[0], v2[2], v2[4], v2[6]);
  const v2yMin = min(v2[1], v2[3], v2[5], v2[7]);
  const v2yMax = max(v2[1], v2[3], v2[5], v2[7]);

  if (v1xMax + epsilon > v2xMin &&
      v1xMin - epsilon < v2xMax &&
      v1yMax + epsilon > v2yMin &&
      v1yMin - epsilon < v2yMax) {
    
    // オーバーラップの検出と処理
    const overlaps = getOverlaps(v1, v2);
    if (overlaps) {
      for (let i = 0; i < overlaps.length; i++) {
        const overlap = overlaps[i];
        addLocation(locations, include,
                c1, overlap[0],
                c2, overlap[1], true);
      }
    } else {
      const straight1 = Curve.isStraight(v1);
      const straight2 = Curve.isStraight(v2);
      const straight = straight1 && straight2;
      const flip = straight1 && !straight2;
      const before = locations.length;
      
      // 直線か曲線かに基づいて適切な交点計算メソッドを決定
      if (straight) {
        // 両方直線の場合
        addLineIntersection(
          flip ? v2 : v1, flip ? v1 : v2,
          flip ? c2 : c1, flip ? c1 : c2,
          locations, include, flip);
      } else if (straight1 || straight2) {
        // 片方が直線の場合
        addCurveLineIntersections(
          flip ? v2 : v1, flip ? v1 : v2,
          flip ? c2 : c1, flip ? c1 : c2,
          locations, include, flip);
      } else {
        // 両方曲線の場合
        addCurveIntersections(
          v1, v2, c1, c2, locations, include, false, 0, 0, 0, 1, 0, 1);
      }
      
      // Paper.jsと同様に、端点が重なる特殊ケースの処理を追加
      // 直線同士の交点が見つからなかった場合や、曲線の場合は端点のチェックを行う
      if (!straight || locations.length === before) {
        // 各曲線の端点をチェック
        // paper.jsと同様に、c1.getPoint1()などを使用
        const c1p1 = c1.getPointAt(0);
        const c1p2 = c1.getPointAt(1);
        const c2p1 = c2.getPointAt(0);
        const c2p2 = c2.getPointAt(1);
        
        // paper.jsと同様に、isClose()メソッドを使用して端点が近接しているかをチェック
        if (c1p1.isClose(c2p1, epsilon)) {
          addLocation(locations, include, c1, 0, c2, 0, true);
        }
        if (c1p1.isClose(c2p2, epsilon)) {
          addLocation(locations, include, c1, 0, c2, 1, true);
        }
        if (c1p2.isClose(c2p1, epsilon)) {
          addLocation(locations, include, c1, 1, c2, 0, true);
        }
        if (c1p2.isClose(c2p2, epsilon)) {
          addLocation(locations, include, c1, 1, c2, 1, true);
        }
      }
    }
  }
  
  return locations;
}

/**
 * paper.jsのgetOverlaps実装
 * PATHITEM_INTERSECTIONS.mdに記載されている実装を使用
 */
function getOverlaps(v1: number[], v2: number[]): [number, number][] | null {
  // 線形曲線は、共線の場合にのみ重複可能
  function getSquaredLineLength(v: number[]): number {
    const x = v[6] - v[0];
    const y = v[7] - v[1];
    return x * x + y * y;
  }

  const abs = Math.abs;
  // Line.getSignedDistanceの実装（paper.jsと同じ）
  const getSignedDistance = (px: number, py: number, vx: number, vy: number, x: number, y: number): number => {
    return vx === 0 ? x - px
      : vy === 0 ? py - y
      : ((y - py) * vx - (x - px) * vy) / Math.sqrt(vx * vx + vy * vy);
  };
  
  const timeEpsilon = Numerical.CURVETIME_EPSILON;
  const geomEpsilon = Numerical.GEOMETRIC_EPSILON;
  let straight1 = Curve.isStraight(v1);
  let straight2 = Curve.isStraight(v2);
  let straightBoth = straight1 && straight2;
  
  // Paper.jsと同様に、常に短い方の曲線をl1とする
  const flip = getSquaredLineLength(v1) < getSquaredLineLength(v2);
  const l1 = flip ? v2 : v1;
  const l2 = flip ? v1 : v2;
  
  // l1の始点と終点の値を取得
  const px = l1[0], py = l1[1];
  const vx = l1[6] - px, vy = l1[7] - py;
  
  // 曲線2の始点と終点がl1に十分近いかチェック
  // paper.jsと同じgetSignedDistanceを使用
  if (Math.abs(getSignedDistance(px, py, vx, vy, l2[0], l2[1])) < geomEpsilon &&
      Math.abs(getSignedDistance(px, py, vx, vy, l2[6], l2[7])) < geomEpsilon) {
    // 両方の曲線が直線でない場合、ハンドルもチェック
    if (!straightBoth &&
        Math.abs(getSignedDistance(px, py, vx, vy, l1[2], l1[3])) < geomEpsilon &&
        Math.abs(getSignedDistance(px, py, vx, vy, l1[4], l1[5])) < geomEpsilon &&
        Math.abs(getSignedDistance(px, py, vx, vy, l2[2], l2[3])) < geomEpsilon &&
        Math.abs(getSignedDistance(px, py, vx, vy, l2[4], l2[5])) < geomEpsilon) {
      straight1 = straight2 = straightBoth = true;
    }
  } else if (straightBoth) {
    // 両方の曲線が直線で、互いに十分近くない場合、解はない
    return null;
  }
  
  if ((straight1 && !straight2) || (!straight1 && straight2)) {
    // 一方の曲線が直線の場合、もう一方も直線でなければオーバーラップできない
    return null;
  }

  const v = [v1, v2];
  let pairs: [number, number][] | null = [];
  
  // すべての端点を反復処理
  for (let i = 0; i < 4 && pairs && pairs.length < 2; i++) {
    const i1 = i & 1;  // 0, 1, 0, 1
    const i2 = i1 ^ 1; // 1, 0, 1, 0
    const t1 = i >> 1; // 0, 0, 1, 1
    const p = new Point(
      v[i2][t1 ? 6 : 0],
      v[i2][t1 ? 7 : 1]
    );
    const t2 = Curve.getTimeOf(v[i1], p);
    
    if (t2 != null) {  // 点が曲線上にある場合
      const pair: [number, number] = i1 ? [t1, t2] : [t2, t1];
      // 小さなオーバーラップをフィルタリング
      if (!pairs.length ||
          abs(pair[0] - pairs[0][0]) > timeEpsilon &&
          abs(pair[1] - pairs[0][1]) > timeEpsilon) {
        pairs.push(pair);
      }
    }
    // Paper.jsと同様に、3点をチェックしたが一致が見つからない場合は早期終了
    if (i > 2 && pairs.length === 0)
      break;
  }
  
  // Paper.jsと同様に、ペアの数をチェック
  if (pairs && pairs.length !== 2) {
    pairs = null;
  } else if (pairs && !straightBoth) {
    // 直線ペアはさらなるチェックが不要
    // 2つのペアが見つかった場合、v1とv2の端点は同じはず
    const o1 = Curve.getPart(v1, pairs[0][0], pairs[1][0]);
    const o2 = Curve.getPart(v2, pairs[0][1], pairs[1][1]);
    // オーバーラップする曲線のハンドルも同じかチェック
    if (abs(o2[2] - o1[2]) > geomEpsilon ||
        abs(o2[3] - o1[3]) > geomEpsilon ||
        abs(o2[4] - o1[4]) > geomEpsilon ||
        abs(o2[5] - o1[5]) > geomEpsilon) {
      pairs = null;
    }
  }
  
  return pairs;
}

/**
 * paper.jsのaddLineIntersection実装
 * PATHITEM_INTERSECTIONS.mdに記載されている実装を使用
 */
function addLineIntersection(
  v1: number[], v2: number[],
  c1: Curve, c2: Curve,
  locations: CurveLocation[],
  include?: (loc: CurveLocation) => boolean,
  flip?: boolean
): CurveLocation[] {
  // Line.intersectの実装
  // paper.jsと同じ実装を使用
  const lineIntersect = (
    p1x: number, p1y: number, p2x: number, p2y: number,
    p3x: number, p3y: number, p4x: number, p4y: number
  ): Point | null => {
    // クラメルの公式を使用して交点を計算
    const d = (p1x - p2x) * (p3y - p4y) - (p1y - p2y) * (p3x - p4x);
    
    if (Math.abs(d) < Numerical.EPSILON) {
      return null; // 平行または重なっている
    }
    
    const a = p1x * p2y - p1y * p2x;
    const b = p3x * p4y - p3y * p4x;
    
    const x = (a * (p3x - p4x) - (p1x - p2x) * b) / d;
    const y = (a * (p3y - p4y) - (p1y - p2y) * b) / d;
    
    // 交点が線分上にあるかチェック
    const epsilon = Numerical.EPSILON;
    const min = Math.min, max = Math.max;
    
    if (
      min(p1x, p2x) - epsilon <= x && x <= max(p1x, p2x) + epsilon &&
      min(p1y, p2y) - epsilon <= y && y <= max(p1y, p2y) + epsilon &&
      min(p3x, p4x) - epsilon <= x && x <= max(p3x, p4x) + epsilon &&
      min(p3y, p4y) - epsilon <= y && y <= max(p3y, p4y) + epsilon
    ) {
      return new Point(x, y);
    }
    
    return null;
  };
  
  const pt = lineIntersect(
    v1[0], v1[1], v1[6], v1[7],
    v2[0], v2[1], v2[6], v2[7]
  );
  
  if (pt) {
    // paper.jsと同様に、交点の座標を使用せず、
    // 単にaddLocationを呼び出す
    addLocation(locations, include,
      flip ? c2 : c1, null,
      flip ? c1 : c2, null,
      true);
  }
  
  return locations;
}

/**
 * paper.jsのaddCurveLineIntersections実装
 * PATHITEM_INTERSECTIONS.mdに記載されている実装を使用
 */
function addCurveLineIntersections(
  v1: number[], v2: number[],
  c1: Curve, c2: Curve,
  locations: CurveLocation[],
  include?: (loc: CurveLocation) => boolean,
  flip?: boolean
): CurveLocation[] {
  // addCurveLineIntersectionsは、v1が常に曲線でv2が直線になるように呼び出される
  // flipは、addLocationへの呼び出しで曲線を反転する必要があるかどうかを示す
  const x1 = v2[0], y1 = v2[1];
  const x2 = v2[6], y2 = v2[7];
  const dx = x2 - x1;
  const dy = y2 - y1;
  
  // getCurveLineIntersectionsの実装
  // paper.jsと同じアルゴリズムを使用
  const getCurveLineIntersections = (v: number[], px: number, py: number, dx: number, dy: number): number[] => {
    // 曲線と直線の交点を求める
    const roots: number[] = [];
    
    // 直線が垂直または水平の場合の特別処理
    if (Math.abs(dx) < Numerical.EPSILON) {
      // 垂直線 x = px
      const txs: number[] = [];
      Numerical.solveCubic(
        v[0] - 3 * v[2] + 3 * v[4] - v[6],
        3 * (v[2] - 2 * v[4] + v[6]),
        3 * (v[4] - v[6]),
        v[6] - px,
        txs, 0, 1
      );
      
      // 有効な解のみを追加
      for (const t of txs) {
        if (t >= 0 && t <= 1) {
          // 交点が線分上にあるかチェック
          const y = Curve.evaluate(v, t).y;
          if (Math.min(py, py + dy) <= y && y <= Math.max(py, py + dy)) {
            roots.push(t);
          }
        }
      }
    } else if (Math.abs(dy) < Numerical.EPSILON) {
      // 水平線 y = py
      const tys: number[] = [];
      Numerical.solveCubic(
        v[1] - 3 * v[3] + 3 * v[5] - v[7],
        3 * (v[3] - 2 * v[5] + v[7]),
        3 * (v[5] - v[7]),
        v[7] - py,
        tys, 0, 1
      );
      
      // 有効な解のみを追加
      for (const t of tys) {
        if (t >= 0 && t <= 1) {
          // 交点が線分上にあるかチェック
          const x = Curve.evaluate(v, t).x;
          if (Math.min(px, px + dx) <= x && x <= Math.max(px, px + dx)) {
            roots.push(t);
          }
        }
      }
    } else {
      // 一般的な直線
      // 曲線上の点と直線の距離関数の係数を計算
      const tempRoots: number[] = [];
      Numerical.solveCubic(
        dy * (v[0] - 3 * v[2] + 3 * v[4] - v[6]) - dx * (v[1] - 3 * v[3] + 3 * v[5] - v[7]),
        3 * (dy * (v[2] - 2 * v[4] + v[6]) - dx * (v[3] - 2 * v[5] + v[7])),
        3 * (dy * (v[4] - v[6]) - dx * (v[5] - v[7])),
        dy * (v[6] - px) - dx * (v[7] - py),
        tempRoots, 0, 1
      );
      
      // 有効な解のみを追加
      for (const t of tempRoots) {
        if (t >= 0 && t <= 1) {
          // 交点が線分上にあるかチェック
          const p = Curve.evaluate(v, t);
          const s = dx !== 0 ?
            (p.x - px) / dx :
            (p.y - py) / dy;
          
          if (s >= 0 && s <= 1) {
            roots.push(t);
          }
        }
      }
    }
    
    return roots;
  };
  
  // 曲線と直線の交点を計算
  const roots = getCurveLineIntersections(v1, x1, y1, dx, dy);
  
  // 各解について、実際の曲線上の点と、それに対応する直線上の位置を取得
  for (let i = 0; i < roots.length; i++) {
    const t1 = roots[i];
    const p1 = Curve.evaluate(v1, t1);
    const t2 = Curve.getTimeOf(v2, p1);
    
    if (t2 !== null) {
      // paper.jsと同様に、addLocationを呼び出す
      addLocation(locations, include,
        flip ? c2 : c1, flip ? t2 : t1,
        flip ? c1 : c2, flip ? t1 : t2);
    }
  }
  
  return locations;
}

/**
 * paper.jsのaddCurveIntersections実装
 * PATHITEM_INTERSECTIONS.mdに記載されている実装を使用
 */
/**
 * 曲線同士の交点を再帰的に計算
 * paper.jsのaddCurveIntersections実装を移植
 */
function addCurveIntersections(
  v1: number[], v2: number[],
  c1: Curve, c2: Curve,
  locations: CurveLocation[],
  include?: (loc: CurveLocation) => boolean,
  flip?: boolean,
  recursion: number = 0,
  calls: number = 0,
  tMin: number = 0, tMax: number = 1,
  uMin: number = 0, uMax: number = 1
): number {
  // Paper.jsと同じ再帰深度と呼び出し回数の制限を設定
  // 再帰が深すぎる場合や呼び出し回数が多すぎる場合は停止
  if (++calls >= 4096 || ++recursion >= 40)
    return calls;
  
  // paper.jsと同様に、CURVETIME_EPSILONより小さいイプシロンを使用して、
  // fat-lineクリッピングコードで曲線時間パラメータを比較
  // 数値計算の安定性を確保するために重要
  const fatLineEpsilon = 1e-9;
  
  // PをQ（第2曲線）のfat-lineでクリッピング
  const q0x = v2[0], q0y = v2[1], q3x = v2[6], q3y = v2[7];
  
  // Line.getSignedDistanceの実装（paper.jsと同じ）
  const getSignedDistance = (px: number, py: number, vx: number, vy: number, x: number, y: number): number => {
    return vx === 0 ? x - px
      : vy === 0 ? py - y
      : ((y - py) * vx - (x - px) * vy) / Math.sqrt(vx * vx + vy * vy);
  };
  
  // Qのfat-lineを計算：ベースラインlと、曲線Pを完全に囲む2つのオフセット
  const d1 = getSignedDistance(q0x, q0y, q3x - q0x, q3y - q0y, v2[2], v2[3]);
  const d2 = getSignedDistance(q0x, q0y, q3x - q0x, q3y - q0y, v2[4], v2[5]);
  const factor = d1 * d2 > 0 ? 3 / 4 : 4 / 9;
  const dMin = factor * Math.min(0, d1, d2);
  const dMax = factor * Math.max(0, d1, d2);
  
  // 非パラメトリックベジェ曲線D(ti, di(t))を計算:
  // - di(t)はPからfat-lineのベースラインlまでの距離
  // - tiは[0, 1]で等間隔
  const dp0 = getSignedDistance(q0x, q0y, q3x - q0x, q3y - q0y, v1[0], v1[1]);
  const dp1 = getSignedDistance(q0x, q0y, q3x - q0x, q3y - q0y, v1[2], v1[3]);
  const dp2 = getSignedDistance(q0x, q0y, q3x - q0x, q3y - q0y, v1[4], v1[5]);
  const dp3 = getSignedDistance(q0x, q0y, q3x - q0x, q3y - q0y, v1[6], v1[7]);
  
  // 凸包の上部と下部を取得
  const hull = getConvexHull(dp0, dp1, dp2, dp3);
  const top = hull[0];
  const bottom = hull[1];
  let tMinClip: number | null = null;
  let tMaxClip: number | null = null;
  
  // すべての点と制御点が共線の場合は反復を停止
  if (d1 === 0 && d2 === 0 && dp0 === 0 && dp1 === 0 && dp2 === 0 && dp3 === 0) {
    return calls;
  }
  
  // dMinとdMaxで凸包をクリップし、結果の1つがnullの場合は交点がないことを考慮
  // paper.jsと完全に同じ実装にする
  // 特に、top.reverse()とbottom.reverse()を使用する部分を修正
  // paper.jsでは、top.reverse()とbottom.reverse()を使用しているが、
  // TypeScriptでは不変性を保つためにslice()を使用している
  // しかし、この場合はtopとbottomは一時的な変数なので、直接変更しても問題ない
  tMinClip = clipConvexHull(top, bottom, dMin, dMax);
  if (tMinClip === null) {
    return calls;
  }
  
  // 配列を反転
  top.reverse();
  bottom.reverse();
  tMaxClip = clipConvexHull(top, bottom, dMin, dMax);
  // 元に戻す（念のため）
  top.reverse();
  bottom.reverse();
  if (tMaxClip === null) {
    return calls;
  }
  
  // tMinとtMaxは(0, 1)の範囲内。v2の元のパラメータ範囲に戻す
  const tMinNew = tMin + (tMax - tMin) * tMinClip;
  const tMaxNew = tMin + (tMax - tMin) * tMaxClip;
  
  // paper.jsと同様の条件判定
  // 数値計算の安定性を確保するために、閾値の比較を厳密に行う
  if (Math.max(uMax - uMin, tMaxNew - tMinNew) < fatLineEpsilon) {
    // 十分な精度で交点を分離した
    const t = (tMinNew + tMaxNew) / 2;
    const u = (uMin + uMax) / 2;
    
    // Paper.jsと同様に、overlapパラメータを省略
    addLocation(locations, include,
      flip ? c2 : c1, flip ? u : t,
      flip ? c1 : c2, flip ? t : u);
  } else {
    // クリッピング結果を曲線1に適用
    const v1Clipped = Curve.getPart(v1, tMinClip, tMaxClip);
    const uDiff = uMax - uMin;
    
    // Paper.jsと同様に、分割条件を調整
    if (tMaxClip - tMinClip > 0.8) {
      // 最も収束していない曲線を分割
      if (tMaxNew - tMinNew > uDiff) {
        // 曲線1を分割
        const parts = Curve.subdivide(v1Clipped, 0.5);
        const t = (tMinNew + tMaxNew) / 2;
        calls = addCurveIntersections(
          v2, parts[0], c2, c1, locations, include, !flip,
          recursion, calls, uMin, uMax, tMinNew, t);
        calls = addCurveIntersections(
          v2, parts[1], c2, c1, locations, include, !flip,
          recursion, calls, uMin, uMax, t, tMaxNew);
      } else {
        // 曲線2を分割
        const parts = Curve.subdivide(v2, 0.5);
        const u = (uMin + uMax) / 2;
        calls = addCurveIntersections(
          parts[0], v1Clipped, c2, c1, locations, include, !flip,
          recursion, calls, uMin, u, tMinNew, tMaxNew);
        calls = addCurveIntersections(
          parts[1], v1Clipped, c2, c1, locations, include, !flip,
          recursion, calls, u, uMax, tMinNew, tMaxNew);
      }
    } else { // 反復
      // Paper.jsと同様に、uDiff === 0の場合の処理を調整
      if (uDiff === 0 || uDiff >= fatLineEpsilon) {
        calls = addCurveIntersections(
          v2, v1Clipped, c2, c1, locations, include, !flip,
          recursion, calls, uMin, uMax, tMinNew, tMaxNew);
      } else {
        // 他の曲線の間隔が既に十分に狭いため、同じ曲線で反復を続ける
        calls = addCurveIntersections(
          v1Clipped, v2, c1, c2, locations, include, flip,
          recursion, calls, tMinNew, tMaxNew, uMin, uMax);
      }
    }
  }
  
  return calls;
}

/**
 * paper.jsのgetConvexHull実装
 * PATHITEM_INTERSECTIONS.mdに記載されている実装を使用
 */
function getConvexHull(dq0: number, dq1: number, dq2: number, dq3: number): [number[][], number[][]] {
  const p0 = [0, dq0];
  const p1 = [1/3, dq1];
  const p2 = [2/3, dq2];
  const p3 = [1, dq3];
  
  // p1とp2から[p0, p3]線への垂直符号付き距離を求める
  const dist1 = dq1 - (2 * dq0 + dq3) / 3;
  const dist2 = dq2 - (dq0 + 2 * dq3) / 3;
  
  let hull: [number[][], number[][]];
  
  // p1とp2が[p0, p3]線の反対側にあるかチェック
  if (dist1 * dist2 < 0) {
    // p1とp2は[p0, p3]線の異なる側にある
    // 凸包は四角形で、[p0, p3]線は凸包の一部ではない
    // ここではほぼ完了。上部にp1が含まれ、そうでない場合は後で反転する
    hull = [[p0, p1, p3], [p0, p2, p3]];
  } else {
    // p1とp2は[p0, p3]線の同じ側にある
    // 凸包は三角形または四角形で、[p0, p3]線は凸包の一部
    // 凸包が三角形か四角形かチェック
    // 中間点(p1, p2)の一方の垂直距離がもう一方の中間点の垂直距離の半分以下の場合、三角形となる
    const distRatio = dist1 / dist2;
    hull = [
      // p2が内側、凸包は三角形
      distRatio >= 2 ? [p0, p1, p3]
      // p1が内側、凸包は三角形
      : distRatio <= 0.5 ? [p0, p2, p3]
      // 凸包は四角形、正しい順序ですべての線が必要
      : [p0, p1, p2, p3],
      // [p0, p3]線は凸包の一部
      [p0, p3]
    ];
  }
  
  // dist1が負またはdist1がゼロでdist2が負の場合、凸包を反転
  return (dist1 || dist2) < 0 ? [hull[1], hull[0]] : hull;
}

/**
 * paper.jsのclipConvexHull実装
 * PATHITEM_INTERSECTIONS.mdに記載されている実装を使用
 */
function clipConvexHull(hullTop: number[][], hullBottom: number[][], dMin: number, dMax: number): number | null {
  if (hullTop[0][1] < dMin) {
    // 凸包の左側がdMin未満、凸包を通過して交点を見つける
    return clipConvexHullPart(hullTop, hullBottom, dMin, false);
  } else if (hullBottom[0][1] > dMax) {
    // 凸包の左側がdMaxを超える、凸包を通過して交点を見つける
    return clipConvexHullPart(hullTop, hullBottom, dMax, true);
  } else {
    // 凸包の左側がdMinとdMaxの間、クリッピング不要
    return 0;
  }
}

/**
 * paper.jsのclipConvexHullPart実装
 * PATHITEM_INTERSECTIONS.mdに記載されている実装を使用
 */
function clipConvexHullPart(
  hullPart: number[][],
  hullOther: number[][],
  dValue: number,
  dMin: boolean
): number | null {
  // 凸包を通過して、dValue線と交差する最初のエッジを見つける
  if (hullPart.length > 1 && hullOther.length > 1) {
    let px0 = hullPart[0][0];
    let py0 = hullPart[0][1];
    let px1: number;
    let py1: number;
    
    // dValue線と交差するセグメントを見つける
    for (let i = 1, l = hullPart.length; i < l; i++) {
      px1 = hullPart[i][0];
      py1 = hullPart[i][1];
      
      // エッジがdValue線と交差するかチェック
      if (py0 <= dValue && py1 > dValue || py0 > dValue && py1 <= dValue) {
        // 交点を見つける
        const pxIntersect = px0 + (px1 - px0) * (dValue - py0) / (py1 - py0);
        
        // 他の凸包部分を通過して、dValue線と交差する最初のエッジを見つける
        let qx0 = hullOther[0][0];
        let qy0 = hullOther[0][1];
        let qx1: number;
        let qy1: number;
        
        // dValue線と交差するセグメントを見つける
        for (let j = 1, m = hullOther.length; j < m; j++) {
          qx1 = hullOther[j][0];
          qy1 = hullOther[j][1];
          
          // エッジがdValue線と交差するかチェック
          if (qy0 <= dValue && qy1 > dValue || qy0 > dValue && qy1 <= dValue) {
            // 交点を見つける
            const qxIntersect = qx0 + (qx1 - qx0) * (dValue - qy0) / (qy1 - qy0);
            // 交点のt値を返す
            return pxIntersect < qxIntersect ? pxIntersect : qxIntersect;
          }
          
          qx0 = qx1;
          qy0 = qy1;
        }
        
        // 他の凸包部分との交点がない場合
        return pxIntersect;
      }
      
      px0 = px1;
      py0 = py1;
    }
  }
  
  // 交点がない場合
  return null;
}