/**
 * PathBooleanTool: Boolean演算ユーティリティクラス
 * paper.jsのPathItem.Boolean.jsを参考に実装
 */

import { Point } from '../basic/Point';
import { Path } from './Path';
import { Curve, CurveLocation } from './Curve';
import { Numerical } from '../util/Numerical';
import { Segment } from './Segment';

/**
 * 交点情報（拡張版）
 */
export interface Intersection extends CurveLocation {
  // 交点の種類（entry/exit）
  type?: 'entry' | 'exit';
  // 交点のwinding number
  winding?: number;
  // 交点の処理済みフラグ
  visited?: boolean;
}

/**
 * Boolean演算ユーティリティクラス
 */
export class PathBooleanTool {
  /**
   * 2つのパスの交点を計算し、entry/exitタイプを分類
   */
  static getIntersections(path1: Path, path2: Path): Intersection[] {
    // 交点計算
    const intersections = path1.getIntersections(path2) as Intersection[];
    
    // 交点のentry/exit分類
    PathBooleanTool.classifyIntersections(intersections, path1, path2);
    
    return intersections;
  }
  
  /**
   * 交点のentry/exit分類
   * paper.jsのpropagateWindingを参考に実装
   */
  private static classifyIntersections(
    intersections: Intersection[],
    path1: Path,
    path2: Path
  ): void {
    if (intersections.length === 0) return;

    // 交点をソート（curve1Index, t1の順）
    intersections.sort((a, b) => {
      if (a.curve1Index !== b.curve1Index) {
        return a.curve1Index - b.curve1Index;
      }
      // t1がnullの場合は0として扱う
      const t1A = a.t1 ?? 0;
      const t1B = b.t1 ?? 0;
      return t1A - t1B;
    });

    // 各交点のwinding numberを計算
    const curves1 = path1.getCurves();
    const curves2 = path2.getCurves();

    // 各交点について、その点でのwinding numberを計算
    for (const intersection of intersections) {
      const point = intersection.point;
      
      // path2上の点におけるpath1のwinding number
      const { windingL: winding1L, windingR: winding1R } = this.getWindingAtPoint(path1, point);
      const winding1 = winding1L + winding1R;
      
      // path1上の点におけるpath2のwinding number
      const { windingL: winding2L, windingR: winding2R } = this.getWindingAtPoint(path2, point);
      const winding2 = winding2L + winding2R;
      
      // 交点の種類（entry/exit）を決定
      // paper.jsのロジックを簡略化：
      // - 両方のパスのwinding numberが奇数なら交差領域内
      // - 片方のパスのwinding numberが奇数、もう片方が偶数なら境界上
      const isInside1 = (winding1 & 1) === 1;
      const isInside2 = (winding2 & 1) === 1;
      
      // 交点の種類を決定（簡略版）
      if (isInside1 && isInside2) {
        // 両方のパスの内部にある場合
        intersection.type = 'exit';
      } else {
        // それ以外の場合
        intersection.type = 'entry';
      }
      
      // winding numberを保存
      intersection.winding = winding1;
    }
  }
  
  /**
   * 指定した点でのwinding numberを計算
   * Path._getWindingのロジックを再利用
   */
  private static getWindingAtPoint(path: Path, point: Point): { windingL: number, windingR: number } {
    // Path._getWindingを直接呼び出すため、非公開APIを呼び出す
    // FIXME：本来はPath._getWindingをPublicにするべき
    
    return (path as any)._getWinding(point);
  }
  
}