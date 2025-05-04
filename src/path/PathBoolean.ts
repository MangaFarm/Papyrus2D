/**
 * PathBoolean: Boolean演算クラス
 * paper.jsのPathItem.Boolean.jsを参考に実装
 */

import { Path } from './Path';
import { Segment } from './Segment';
import { Point } from '../basic/Point';
import { Curve } from './Curve';
import { Numerical } from '../util/Numerical';
import { CompoundPath } from './CompoundPath';
import { PathItem } from './PathItem';
import { CurveLocation } from './CurveLocation';
import { reorientPaths } from './PathBooleanReorient';
import { CollisionDetection } from '../util/CollisionDetection';

/**
 * 交点情報
 */
export interface Intersection {
  // 交点の座標
  point: Point;
  // 交点のパス1上のカーブインデックス
  curve1Index: number;
  // 交点のパス2上のカーブインデックス
  curve2Index: number;
  // 交点のパス1上のカーブパラメータ
  t1?: number | null;
  // 交点のパス2上のカーブパラメータ
  t2?: number | null;
  // 交点の種類（entry/exit）
  type?: 'entry' | 'exit';
  // 交点のwinding number
  winding?: number;
  // 交点の処理済みフラグ
  visited?: boolean;
  // 次の交点への参照（リンクリスト構造）
  next?: Intersection;
  // 前の交点への参照（リンクリスト構造）
  prev?: Intersection;
  // 交点のセグメント
  segment?: Segment;
}

/**
 * Boolean演算クラス
 */
export class PathBoolean {
  /**
   * 2つのパスの交点を計算
   * paper.jsのfilterIntersection関数を参考に実装
   */
  private static getIntersections(path1: Path, path2: Path): Intersection[] {
    // 交差点と重なりを区別するフィルター関数
    function filterIntersection(inter: CurveLocation): boolean {
      // 重なりまたは交差のみを返す
      return inter.hasOverlap() || inter.isCrossing();
    }
    
    // 交点計算（フィルター関数を使用）
    const rawIntersections = path1.getIntersections(path2, filterIntersection);
    
    // Intersection型に変換
    const intersections: Intersection[] = [];
    
    for (const loc of rawIntersections) {
      // 交点情報を抽出
      const point = loc.getPoint();
      const curve = loc.getCurve();
      const curveIndex = curve ? path1.getCurves().indexOf(curve) : 0;
      
      // 交差するカーブの情報
      const intersection = loc.getIntersection();
      const otherCurve = intersection ? intersection.getCurve() : null;
      const otherCurveIndex = otherCurve ? path2.getCurves().indexOf(otherCurve) : 0;
      
      // 交点情報を作成
      intersections.push({
        point,
        curve1Index: curveIndex,
        curve2Index: otherCurveIndex,
        t1: loc.getTime(),
        t2: intersection ? intersection.getTime() : null,
        visited: false
      });
    }
    
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
    
    return intersections;
  }

  /**
   * 交点でパスを分割
   */
  private static dividePathAtIntersections(path: Path, intersections: Intersection[]): Path {
    if (intersections.length === 0) return path;
    
    // 交点でパスを分割
    const curves = path.getCurves();
    const segments: Segment[] = [];
    
    // 各カーブについて処理
    for (let i = 0; i < curves.length; i++) {
      const curve = curves[i];
      const curveIntersections = intersections.filter(inter => inter.curve1Index === i);
      
      // カーブの開始点を追加
      segments.push(curve._segment1);
      
      // 交点をt値でソート
      curveIntersections.sort((a, b) => (a.t1 ?? 0) - (b.t1 ?? 0));
      
      // 各交点でカーブを分割
      for (const intersection of curveIntersections) {
        const t = intersection.t1 ?? 0;
        if (t > Numerical.CURVETIME_EPSILON && t < 1 - Numerical.CURVETIME_EPSILON) {
          // カーブを分割して新しいセグメントを作成
          const result = curve.divideAtTime(t);
          
          // divideAtTimeの戻り値がCurveの場合
          if (result && typeof result === 'object' && 'getPoint' in result) {
            // 新しいセグメントを取得
            const newCurve = result as Curve;
            const newSegment = newCurve._segment1;
            
            segments.push(newSegment);
            
            // 交点情報にセグメントを関連付け
            intersection.segment = newSegment;
          }
        }
      }
    }
    
    // 新しいパスを作成
    const newPath = new Path(segments, path.isClosed());
    return newPath;
  }

  /**
   * 交点のwinding numberを計算
   */
  private static calculateWindingNumbers(path1: Path, path2: Path, intersections: Intersection[]): void {
    for (const intersection of intersections) {
      const point = intersection.point;
      
      // path1上の点におけるpath2のwinding number
      const winding2 = this.getWindingNumber(path2, point);
      
      // 交点の種類（entry/exit）を決定
      // winding numberが奇数なら内部、偶数なら外部
      const isInside2 = (winding2 & 1) === 1;
      
      // 交点の種類を決定
      intersection.type = isInside2 ? 'exit' : 'entry';
      intersection.winding = winding2;
    }
  }

  /**
   * 指定した点でのwinding numberを計算
   */
  private static getWindingNumber(path: Path, point: Point): number {
    // 簡易実装：レイキャスティングによるwinding number計算
    const curves = path.getCurves();
    let winding = 0;
    
    for (const curve of curves) {
      // カーブの値を取得
      const v = [
        curve._segment1.point.x,
        curve._segment1.point.y,
        curve._segment1.point.x + curve._segment1.handleOut.x,
        curve._segment1.point.y + curve._segment1.handleOut.y,
        curve._segment2.point.x + curve._segment2.handleIn.x,
        curve._segment2.point.y + curve._segment2.handleIn.y,
        curve._segment2.point.x,
        curve._segment2.point.y
      ];
      
      // 点のy座標
      const y = point.y;
      
      // カーブのy座標の範囲をチェック
      const minY = Math.min(v[1], v[3], v[5], v[7]);
      const maxY = Math.max(v[1], v[3], v[5], v[7]);
      
      if (y < minY || y > maxY) continue;
      
      // カーブとレイの交点を計算
      const roots: number[] = [];
      Numerical.solveCubic(
        -v[1] + 3 * v[3] - 3 * v[5] + v[7],
        3 * v[1] - 6 * v[3] + 3 * v[5],
        -3 * v[1] + 3 * v[3],
        v[1] - y,
        roots,
        { min: 0, max: 1 }
      );
      
      for (const t of roots) {
        if (t < Numerical.CURVETIME_EPSILON || t > 1 - Numerical.CURVETIME_EPSILON) {
          continue;
        }
        
        // 交点のx座標を計算
        const mt = 1 - t;
        const x = mt * mt * mt * v[0] + 3 * mt * mt * t * v[2] + 3 * mt * t * t * v[4] + t * t * t * v[6];
        
        // 点のx座標より左側の交点のみカウント
        if (x < point.x) {
          // 交差方向を判定
          const dy = 3 * (mt * mt * (v[3] - v[1]) + 2 * mt * t * (v[5] - v[3]) + t * t * (v[7] - v[5]));
          winding += dy > 0 ? 1 : -1;
        }
      }
    }
    
    return Math.abs(winding);
  }

  /**
   * マーチングアルゴリズムによるパス構築
   */
  private static tracePaths(
    path1: Path,
    path2: Path,
    intersections: Intersection[],
    operation: 'unite' | 'intersect' | 'subtract' | 'exclude' | 'divide'
  ): Path[] {
    if (intersections.length === 0) {
      // 交点がない場合は、paper.jsと同様にreorientPathsを使用して結果を決定
      // reorientPathsは、パスの方向を再設定し、内部/外部の関係を考慮してパスを整理する
      console.log('DEBUG: No intersections, using reorientPaths for operation:', operation);
      
      // 演算子に応じたフィルタ関数を定義
      const operators: Record<string, Record<string, boolean>> = {
        'unite':     { '1': true, '2': true },
        'intersect': { '2': true },
        'subtract':  { '1': true },
        'exclude':   { '1': true, '-1': true }
      };
      
      // 現在の演算に対応するフィルタ関数
      const operator = operators[operation];
      
      // path2がnullの場合は、path1のみを返す
      if (!path2) {
        return [path1];
      }
      
      // reorientPathsを使用してパスを整理
      const paths = reorientPaths(
        // 元のパスの配列をコピーして渡す
        [path1, path2],
        // windingに基づいてパスを保持するかどうかを判定する関数
        function(winding: number) {
          return !!operator[winding.toString()];
        }
      );
      
      // 結果を返す
      return paths;
    }

    // 交点がある場合のマーチングアルゴリズム
    // 結果パスを格納する配列
    const resultPaths: Path[] = [];
    
    // 交点をすべて未訪問状態にする
    for (const intersection of intersections) {
      intersection.visited = false;
    }
    
    // 各交点から開始して、パスをトレース
    for (let i = 0; i < intersections.length; i++) {
      const intersection = intersections[i];
      if (intersection.visited || !intersection.segment) continue;
      
      // 新しいパスを開始
      const segments: Segment[] = [];
      let currentIntersection = intersection;
      let currentPath = path1;
      let otherPath = path2;
      let isInside = false;
      
      // パスをトレース
      do {
        // 現在の交点を訪問済みにする
        currentIntersection.visited = true;
        
        // 交点の座標をセグメントとして追加
        if (currentIntersection.segment) {
          segments.push(currentIntersection.segment);
        } else {
          segments.push(new Segment(currentIntersection.point));
        }
        
        // パスを切り替え
        const temp = currentPath;
        currentPath = otherPath;
        otherPath = temp;
        
        // 内部/外部状態を切り替え
        isInside = !isInside;
        
        // 次の交点を探す
        let nextIntersection: Intersection | null = null;
        
        // 現在のパス上で次の交点を探す
        for (const inter of intersections) {
          if (!inter.visited && inter.segment) {
            // 交点が現在のパス上にあるか確認
            const segment = inter.segment;
            const path = segment._path;
            
            if (path === currentPath) {
              // 次の交点として選択
              if (!nextIntersection) {
                nextIntersection = inter;
              }
            }
          }
        }
        
        // 次の交点が見つからない場合は終了
        if (!nextIntersection) break;
        
        // 次の交点に移動
        currentIntersection = nextIntersection;
        
      } while (segments.length < 1000); // 無限ループ防止
      
      // 閉じたパスを作成
      if (segments.length > 2) {
        const resultPath = new Path(segments, true);
        
        // 操作に応じてパスを追加するかどうか判断
        let addPath = false;
        
        switch (operation) {
          case 'unite':
            // 合成：すべてのパスを追加
            addPath = true;
            break;
          case 'intersect':
            // 交差：内部のパスのみ追加
            addPath = isInside;
            break;
          case 'subtract':
            // 差分：path1の内部かつpath2の外部のパスのみ追加
            addPath = !isInside;
            break;
          case 'exclude':
            // 排他的論理和：片方のパスの内部のみ追加
            addPath = true;
            break;
          case 'divide':
            // 分割：すべてのパスを追加
            addPath = true;
            break;
        }
        
        if (addPath) {
          resultPaths.push(resultPath);
        }
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
   * paper.jsのcreateResult関数を参考に実装
   */
  static createResult(
    paths: Path[],
    operation: 'unite' | 'intersect' | 'subtract' | 'exclude' | 'divide'
  ): PathItem {
    console.log(`DEBUG: createResult called with ${paths.length} paths for operation: ${operation}`);
    
    if (paths.length === 0) {
      console.log('DEBUG: No paths, returning empty Path');
      return new Path();
    }
    
    if (paths.length === 1) {
      console.log('DEBUG: Single path, returning it directly');
      return paths[0];
    }
    
    console.log('DEBUG: Multiple paths, creating CompoundPath');
    // 複数のパスをCompoundPathとして結合
    const result = new CompoundPath();
    
    // 各パスを独立したパスとして追加
    // 各パスが閉じていることを確認
    for (const path of paths) {
      console.log('DEBUG: Adding path to CompoundPath, segments:', path.getSegments().length);
      // パスのコピーを作成して閉じる
      const newPath = new Path(path.getSegments(), true);
      result.addChild(newPath);
    }
    
    // 結果を単一のPathに変換できる場合は変換
    // paper.jsのreduce()メソッドに相当する処理
    if (result._children && result._children.length === 1) {
      console.log('DEBUG: CompoundPath has only one child, converting to Path');
      const singlePath = result._children[0] as Path;
      return singlePath;
    }
    
    console.log('DEBUG: Returning CompoundPath with', result._children?.length, 'children');
    // CompoundPathをそのまま返す
    return result;
  }

  /**
   * パスの合成（unite）
   */
  static unite(path1: PathItem, path2: PathItem): PathItem {
    // PathItemをPathにキャスト
    const p1 = path1 as Path;
    const p2 = path2 as Path;
    
    // 交点計算
    const intersections = this.getIntersections(p1, p2);
    
    // 交点でパスを分割
    const dividedPath1 = this.dividePathAtIntersections(p1, intersections);
    const dividedPath2 = this.dividePathAtIntersections(p2, intersections);
    
    // 交点のwinding number計算
    this.calculateWindingNumbers(dividedPath1, dividedPath2, intersections);
    
    // マーチングアルゴリズムで結果パスを構築
    const resultPaths = this.tracePaths(dividedPath1, dividedPath2, intersections, 'unite');
    
    // 結果パスを結合
    return PathBoolean.createResult(resultPaths, 'unite');
  }
  
  /**
   * パスの交差（intersect）
   */
  static intersect(path1: PathItem, path2: PathItem): PathItem {
    // PathItemをPathにキャスト
    const p1 = path1 as Path;
    const p2 = path2 as Path;
    
    // 交点計算
    const intersections = this.getIntersections(p1, p2);
    
    // 交点でパスを分割
    const dividedPath1 = this.dividePathAtIntersections(p1, intersections);
    const dividedPath2 = this.dividePathAtIntersections(p2, intersections);
    
    // 交点のwinding number計算
    this.calculateWindingNumbers(dividedPath1, dividedPath2, intersections);
    
    // マーチングアルゴリズムで結果パスを構築
    const resultPaths = this.tracePaths(dividedPath1, dividedPath2, intersections, 'intersect');
    
    // 結果パスを結合
    return PathBoolean.createResult(resultPaths, 'intersect');
  }
  
  /**
   * パスの差分（subtract）
   */
  static subtract(path1: PathItem, path2: PathItem): PathItem {
    // PathItemをPathにキャスト
    const p1 = path1 as Path;
    const p2 = path2 as Path;
    
    // 交点計算
    const intersections = this.getIntersections(p1, p2);
    
    // 交点でパスを分割
    const dividedPath1 = this.dividePathAtIntersections(p1, intersections);
    const dividedPath2 = this.dividePathAtIntersections(p2, intersections);
    
    // 交点のwinding number計算
    this.calculateWindingNumbers(dividedPath1, dividedPath2, intersections);
    
    // マーチングアルゴリズムで結果パスを構築
    const resultPaths = this.tracePaths(dividedPath1, dividedPath2, intersections, 'subtract');
    
    // 結果パスを結合
    return PathBoolean.createResult(resultPaths, 'subtract');
  }
  
  /**
   * パスの排他的論理和（exclude）
   */
  static exclude(path1: PathItem, path2: PathItem): PathItem {
    // PathItemをPathにキャスト
    const p1 = path1 as Path;
    const p2 = path2 as Path;
    
    // 交点計算
    const intersections = this.getIntersections(p1, p2);
    
    // 交点でパスを分割
    const dividedPath1 = this.dividePathAtIntersections(p1, intersections);
    const dividedPath2 = this.dividePathAtIntersections(p2, intersections);
    
    // 交点のwinding number計算
    this.calculateWindingNumbers(dividedPath1, dividedPath2, intersections);
    
    // マーチングアルゴリズムで結果パスを構築
    const resultPaths = this.tracePaths(dividedPath1, dividedPath2, intersections, 'exclude');
    
    // 結果パスを結合
    return PathBoolean.createResult(resultPaths, 'exclude');
  }
  
  /**
   * パスの分割（divide）
   */
  static divide(path1: PathItem, path2: PathItem): PathItem {
    // PathItemをPathにキャスト
    const p1 = path1 as Path;
    const p2 = path2 as Path;
    
    // 交点計算
    const intersections = this.getIntersections(p1, p2);
    
    // 交点でパスを分割
    const dividedPath1 = this.dividePathAtIntersections(p1, intersections);
    const dividedPath2 = this.dividePathAtIntersections(p2, intersections);
    
    // 交点のwinding number計算
    this.calculateWindingNumbers(dividedPath1, dividedPath2, intersections);
    
    // マーチングアルゴリズムで結果パスを構築
    const resultPaths = this.tracePaths(dividedPath1, dividedPath2, intersections, 'divide');
    
    // 結果パスを結合
    return PathBoolean.createResult(resultPaths, 'divide');
  }
}