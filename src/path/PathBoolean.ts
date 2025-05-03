/**
 * PathBoolean: Boolean演算クラス
 * paper.jsのPathItem.Boolean.jsを参考に実装
 */

import { Path } from './Path';
import { Segment } from './Segment';
import { PathBooleanTool, Intersection } from './PathBooleanTool';

/**
 * Boolean演算クラス
 */
export class PathBoolean {
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
      let currentT = currentIntersection.t1 ?? 0;
      
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
              (intersection.t1 ?? 0) > currentT) {
            if (!nextIntersection || (intersection.t1 ?? 0) < (nextIntersection.t1 ?? 0)) {
              nextIntersection = intersection;
            }
          }
        }
        
        // 次の交点が見つからない場合は終了
        if (!nextIntersection) break;
        
        // 次の交点に移動
        currentIntersection = nextIntersection;
        currentT = currentIntersection.t1 ?? 0;
        
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
   * 結果Path構築と重複統合
   * paper.jsのcreateResultを参考に実装
   */
  static createResult(
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
   * パスの合成（unite）
   */
  static unite(path1: Path, path2: Path): Path {
    // 交点計算とentry/exit分類
    const intersections = PathBooleanTool.getIntersections(path1, path2);
    
    // マーチングアルゴリズムで結果パスを構築
    const resultPaths = this.tracePaths(path1, path2, intersections, 'unite');
    
    // 結果パスを結合
    return PathBoolean.createResult(resultPaths, 'unite');
  }
  
  /**
   * パスの交差（intersect）
   */
  static intersect(path1: Path, path2: Path): Path {
    // 交点計算とentry/exit分類
    const intersections = PathBooleanTool.getIntersections(path1, path2);
    
    // マーチングアルゴリズムで結果パスを構築
    const resultPaths = this.tracePaths(path1, path2, intersections, 'intersect');
    
    // 結果パスを結合
    return PathBoolean.createResult(resultPaths, 'intersect');
  }
  
  /**
   * パスの差分（subtract）
   */
  static subtract(path1: Path, path2: Path): Path {
    // 交点計算とentry/exit分類
    const intersections = PathBooleanTool.getIntersections(path1, path2);
    
    // マーチングアルゴリズムで結果パスを構築
    const resultPaths = this.tracePaths(path1, path2, intersections, 'subtract');
    
    // 結果パスを結合
    return PathBoolean.createResult(resultPaths, 'subtract');
  }
  
  /**
   * パスの排他的論理和（exclude）
   */
  static exclude(path1: Path, path2: Path): Path {
    // 交点計算とentry/exit分類
    const intersections = PathBooleanTool.getIntersections(path1, path2);
    
    // マーチングアルゴリズムで結果パスを構築
    const resultPaths = this.tracePaths(path1, path2, intersections, 'exclude');
    
    // 結果パスを結合
    return PathBoolean.createResult(resultPaths, 'exclude');
  }
  
  /**
   * パスの分割（divide）
   */
  static divide(path1: Path, path2: Path): Path {
    // 交点計算とentry/exit分類
    const intersections = PathBooleanTool.getIntersections(path1, path2);
    
    // マーチングアルゴリズムで結果パスを構築
    const resultPaths = this.tracePaths(path1, path2, intersections, 'divide');
    
    // 結果パスを結合
    return PathBoolean.createResult(resultPaths, 'divide');
  }
}