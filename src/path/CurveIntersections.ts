/**
 * CurveIntersections
 * Paper.js の曲線交点計算関連の関数を移植したユーティリティ。
 * 
 * 注意: このファイルは以下の複数のファイルに分割されました：
 * - CurveIntersectionBase.ts: 基本的な交点計算関数
 * - CurveIntersectionMain.ts: 曲線交点計算のメイン関数
 * - CurveIntersectionSpecial.ts: 特殊ケース（直線など）の交点計算
 * - CurveIntersectionConvexHull.ts: 凸包と再帰的交点計算
 * 
 * このファイルは後方互換性のために維持されています。
 */

// 基本的な交点計算関数
export { 
  getSelfIntersection,
  addLocation,
  insertLocation
} from './CurveIntersectionBase';

// 曲線交点計算のメイン関数
export {
  getCurveIntersections,
  getOverlaps
} from './CurveIntersectionMain';

// 特殊ケース（直線など）の交点計算
export {
  addLineIntersection,
  addCurveLineIntersections
} from './CurveIntersectionSpecial';

// 凸包と再帰的交点計算
export {
  addCurveIntersections,
  getConvexHull,
  clipConvexHull,
  clipConvexHullPart
} from './CurveIntersectionConvexHull';