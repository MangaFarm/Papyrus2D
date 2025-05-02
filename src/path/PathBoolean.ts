/**
 * PathBoolean: Boolean演算ユーティリティクラス
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
interface Intersection extends CurveLocation {
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
export class PathBoolean {
  /**
   * 2つのパスの交点を計算し、entry/exitタイプを分類
   */
  static getIntersections(path1: Path, path2: Path): Intersection[] {
    // 交点計算
    const intersections = path1.getIntersections(path2) as Intersection[];
    
    // 交点のentry/exit分類
    PathBoolean.classifyIntersections(intersections, path1, path2);
    
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
      return a.t1 - b.t1;
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
    // Path._getWindingを直接呼び出せないため、同等のロジックを実装
    // 実際の実装では、Path._getWindingをpublicにするか、
    // このロジックをPathクラスに移動することを検討すべき
    
    // 簡易実装
    return { windingL: 0, windingR: 0 };
  }
  
  /**
   * 結果Path構築と重複統合
   * paper.jsのcreateResultを参考に実装
   */
  private static createResult(
    paths: Path[],
    operation: 'unite' | 'intersect' | 'subtract' | 'exclude' | 'divide'
  ): Path {
    if (paths.length === 0) {
      return new Path();
    }
    
    if (paths.length === 1) {
      return paths[0];
    }
    
    // 重複パスの統合（簡易実装）
    // 実際には、重なり合うパスを適切に統合する必要がある
    
    // 最初のパスをベースにする
    let result = paths[0];
    
    // 残りのパスを処理
    for (let i = 1; i < paths.length; i++) {
      const path = paths[i];
      
      // 操作に応じて異なる処理
      switch (operation) {
        case 'unite':
          // 合成：パスを追加
          // 実際には、重なり合う部分を適切に処理する必要がある
          result = result; // 簡易実装
          break;
        case 'intersect':
          // 交差：共通部分のみ残す
          // 実際には、重なり合う部分を適切に処理する必要がある
          result = result; // 簡易実装
          break;
        case 'subtract':
          // 差分：パスを引く
          // 実際には、重なり合う部分を適切に処理する必要がある
          result = result; // 簡易実装
          break;
        case 'exclude':
          // 排他的論理和：重なり合う部分を除外
          // 実際には、重なり合う部分を適切に処理する必要がある
          result = result; // 簡易実装
          break;
        case 'divide':
          // 分割：パスを分割
          // 実際には、重なり合う部分を適切に処理する必要がある
          result = result; // 簡易実装
          break;
      }
    }
    
    return result;
  }

  /**
   * マーチングアルゴリズムによるパス構築
   * paper.jsのtracePathsを参考に実装
   */
  private static tracePaths(
    path1: Path,
    path2: Path,
    intersections: Intersection[],
    operation: 'unite' | 'intersect' | 'subtract' | 'exclude' | 'divide'
  ): Path[] {
    if (intersections.length === 0) {
      // 交点がない場合の処理
      switch (operation) {
        case 'unite':
          // path2がpath1の内部にある場合はpath1を返す
          if (path1.contains(path2.segments[0].point)) {
            return [path1];
          }
          // path1がpath2の内部にある場合はpath2を返す
          if (path2.contains(path1.segments[0].point)) {
            return [path2];
          }
          // 交差していない場合は両方を返す
          return [path1, path2];
        case 'intersect':
          // path2がpath1の内部にある場合はpath2を返す
          if (path1.contains(path2.segments[0].point)) {
            return [path2];
          }
          // path1がpath2の内部にある場合はpath1を返す
          if (path2.contains(path1.segments[0].point)) {
            return [path1];
          }
          // 交差していない場合は空を返す
          return [];
        case 'subtract':
          // path2がpath1の内部にある場合は穴を開ける（未実装）
          if (path1.contains(path2.segments[0].point)) {
            return [path1]; // 簡易実装
          }
          // path1がpath2の内部にある場合は空を返す
          if (path2.contains(path1.segments[0].point)) {
            return [];
          }
          // 交差していない場合はpath1を返す
          return [path1];
        case 'exclude':
          // 交差していない場合は両方を返す
          return [path1, path2];
        case 'divide':
          // 交差していない場合は両方を返す
          return [path1, path2];
        default:
          return [path1];
      }
    }

    // 交点がある場合のマーチングアルゴリズム
    // 簡易実装：交点を辿って新しいパスを構築
    
    // 結果パスを格納する配列
    const resultPaths: Path[] = [];
    
    // 交点をすべて未訪問状態にする
    for (const intersection of intersections) {
      intersection.visited = false;
    }
    
    // 各交点から開始して、パスをトレース
    for (let i = 0; i < intersections.length; i++) {
      const intersection = intersections[i];
      if (intersection.visited) continue;
      
      // 新しいパスを開始
      let segments: Segment[] = [];
      let currentIntersection = intersection;
      let currentPath = path1;
      let currentCurveIndex = currentIntersection.curve1Index;
      let currentT = currentIntersection.t1;
      
      // パスをトレース
      do {
        // 現在の交点を訪問済みにする
        currentIntersection.visited = true;
        
        // 交点の座標をセグメントとして追加
        segments.push(new Segment(currentIntersection.point));
        
        // 次の交点を探す（簡易実装）
        let nextIntersection: Intersection | null = null;
        for (const intersection of intersections) {
          if (!intersection.visited &&
              intersection.curve1Index === currentCurveIndex &&
              intersection.t1 > currentT) {
            if (!nextIntersection || intersection.t1 < nextIntersection.t1) {
              nextIntersection = intersection;
            }
          }
        }
        
        // 次の交点が見つからない場合は終了
        if (!nextIntersection) break;
        
        // 次の交点に移動
        currentIntersection = nextIntersection;
        currentT = currentIntersection.t1;
        
      } while (segments.length < 100); // 無限ループ防止
      
      // 閉じたパスを作成
      if (segments.length > 2) {
        resultPaths.push(new Path(segments, true));
      }
    }
    
    // 結果がない場合は元のパスを返す
    if (resultPaths.length === 0) {
      switch (operation) {
        case 'unite':
          return [path1, path2];
        case 'intersect':
          return [];
        case 'subtract':
          return [path1];
        case 'exclude':
          return [path1, path2];
        case 'divide':
          return [path1, path2];
        default:
          return [path1];
      }
    }
    
    return resultPaths;
  }
  
  /**
   * パスの合成（unite）
   */
  static unite(path1: Path, path2: Path): Path {
    // 交点計算とentry/exit分類
    const intersections = PathBoolean.getIntersections(path1, path2);
    
    // マーチングアルゴリズムで結果パスを構築
    const resultPaths = PathBoolean.tracePaths(path1, path2, intersections, 'unite');
    
    // 結果パスを結合
    return PathBoolean.createResult(resultPaths, 'unite');
  }
  
  /**
   * パスの交差（intersect）
   */
  static intersect(path1: Path, path2: Path): Path {
    // 交点計算とentry/exit分類
    const intersections = PathBoolean.getIntersections(path1, path2);
    
    // マーチングアルゴリズムで結果パスを構築
    const resultPaths = PathBoolean.tracePaths(path1, path2, intersections, 'intersect');
    
    // 結果パスを結合
    return PathBoolean.createResult(resultPaths, 'intersect');
  }
  
  /**
   * パスの差分（subtract）
   */
  static subtract(path1: Path, path2: Path): Path {
    // 交点計算とentry/exit分類
    const intersections = PathBoolean.getIntersections(path1, path2);
    
    // マーチングアルゴリズムで結果パスを構築
    const resultPaths = PathBoolean.tracePaths(path1, path2, intersections, 'subtract');
    
    // 結果パスを結合
    return PathBoolean.createResult(resultPaths, 'subtract');
  }
  
  /**
   * パスの排他的論理和（exclude）
   */
  static exclude(path1: Path, path2: Path): Path {
    // 交点計算とentry/exit分類
    const intersections = PathBoolean.getIntersections(path1, path2);
    
    // マーチングアルゴリズムで結果パスを構築
    const resultPaths = PathBoolean.tracePaths(path1, path2, intersections, 'exclude');
    
    // 結果パスを結合
    return PathBoolean.createResult(resultPaths, 'exclude');
  }
  
  /**
   * パスの分割（divide）
   */
  static divide(path1: Path, path2: Path): Path {
    // 交点計算とentry/exit分類
    const intersections = PathBoolean.getIntersections(path1, path2);
    
    // マーチングアルゴリズムで結果パスを構築
    const resultPaths = PathBoolean.tracePaths(path1, path2, intersections, 'divide');
    
    // 結果パスを結合
    return PathBoolean.createResult(resultPaths, 'divide');
  }
}