/**
 * PathBoolean: Boolean演算クラス
 * paper.jsのPathItem.Boolean.jsを参考に実装
 */

import { Path } from './Path';
import { Segment } from './Segment';
import { Point } from '../basic/Point';
import { Curve } from './Curve';
import { CompoundPath } from './CompoundPath';
import { PathItem } from './PathItem';
import { CurveLocation } from './CurveLocation';
import { reorientPaths } from './PathBooleanReorient';
import { CollisionDetection } from '../util/CollisionDetection';
import { preparePath } from './PathBooleanPreparation';
import { tracePaths } from './PathBooleanTracePaths';
import { propagateWinding } from './PathBooleanWinding';
import { getMeta } from './SegmentMeta';
import {
  getIntersections,
  dividePathAtIntersections,
} from './PathBooleanIntersections';

// SegmentInfoインターフェースとasSegmentInfo関数はPathBooleanWinding.tsに移動しました

/**
 * Boolean演算クラス
 */
export class PathBoolean {
  // 交点関連の関数はPathBooleanIntersections.tsに移動しました
  // winding number関連の関数はPathBooleanWinding.tsに移動しました


  /**
   * 交点がない場合のパス処理
   */
  private static handleNoIntersections(
    path1: Path,
    path2: Path,
    operation: 'unite' | 'intersect' | 'subtract' | 'exclude' | 'divide'
  ): Path[] {
    // デバッグ出力
    console.log('DEBUG: handleNoIntersections called');
    console.log('  operation:', operation);
    console.log('  path1 bounds:', path1.getBounds && path1.getBounds());
    console.log('  path2 bounds:', path2 && path2.getBounds && path2.getBounds());
    console.log('  path1 segments:', path1.getSegments && path1.getSegments().map(s => s.point && s.point.toString && s.point.toString()));
    console.log('  path2 segments:', path2 && path2.getSegments && path2.getSegments().map(s => s.point && s.point.toString && s.point.toString()));

    // getInteriorPointメソッドが存在するか確認するヘルパー関数
    const getInteriorPoint = (path: PathItem): Point => {
      if ('getInteriorPoint' in path && typeof (path as any).getInteriorPoint === 'function') {
        return (path as any).getInteriorPoint();
      }
      // フォールバック: バウンディングボックスの中心を使用
      const bounds = path.getBounds();
      return new Point(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    };
    
    // 演算子に応じたフィルタ関数を定義
    const operators: Record<string, Record<string, boolean>> = {
      'unite':     { '1': true, '2': true },
      'intersect': { '2': true },
      'subtract':  { '1': true },
      'exclude':   { '1': true, '-1': true }
    };
    
    // 現在の演算に対応するフィルタ関数
    const operator = operators[operation];
    
    // paper.jsと同様に、operatorにoperationプロパティを追加
    operator[operation] = true;
    
    // path2の処理
    if (path1 === path2) {
      console.log('DEBUG: path1 === path2, returning [path1]');
      return [path1];
    }
    
    // reorientPathsを使用して結果を決定
    const result = reorientPaths(
      path2 ? [path1, path2] : [path1],
      (w: number) => !!operator[w]
    );
    console.log('DEBUG: reorientPaths result:', result);
    return result;
  }
  
  /**
   * 結果Path構築と重複統合
   * paper.jsのcreateResult関数を忠実に移植
   */
  static createResult(
    paths: Path[],
    simplify: boolean,
    path1: PathItem,
    path2?: PathItem,
    options?: { insert?: boolean }
  ): PathItem {
    // パスの配列が空の場合のフォールバック処理
    if (paths.length === 0) {
      console.log('DEBUG: createResult received empty paths array, creating empty path');
      
      // paper.jsの実装に合わせて、空のパスを作成
      const emptyPath = new Path();
      
      // path1の属性をコピー
      if (path1 && emptyPath.copyAttributes) {
        emptyPath.copyAttributes(path1, true);
      }
      
      // 挿入オプションが明示的にfalseでない場合、結果を挿入
      if (!(options && options.insert === false)) {
        if (path1 && emptyPath.insertAbove) {
          emptyPath.insertAbove(path1);
        }
      }
      
      return emptyPath;
    }

    // デバッグ出力
    console.log('DEBUG: createResult paths.length:', paths.length);
    if (paths.length > 0) {
      for (let i = 0; i < paths.length; i++) {
        if (!paths[i]) continue;
        console.log(`  paths[${i}] area:`, paths[i].getArea && paths[i].getArea());
        console.log(`  paths[${i}] segments:`, paths[i].getSegments && paths[i].getSegments().map(s => s.point && s.point.toString && s.point.toString()));
      }
    }
    
    // 結果のCompoundPathを作成
    const result = new CompoundPath();
    result.addChildren(paths);
    console.log('DEBUG: CompoundPath children count:', result._children.length);

    // パスを簡略化（reduce相当の処理）
    const simplified = result.reduce({ simplify });
    console.log('DEBUG: result.reduce() type:', simplified && simplified.constructor && simplified.constructor.name);
    if (simplified instanceof CompoundPath) {
      console.log('DEBUG: simplified._children.length:', simplified._children.length);
    }

    // 挿入オプションが明示的にfalseでない場合、結果を挿入
    if (!(options && options.insert === false)) {
      // path1とpath2が存在し、兄弟関係にある場合、
      // path1のインデックスがpath2より小さければpath2の上に、
      // そうでなければpath1の上に挿入
      if (path2 && path1 && path1.isSibling && path2.isSibling &&
          path1.isSibling(path2) &&
          path1.getIndex && path2.getIndex &&
          path1.getIndex() < path2.getIndex()) {
        if (simplified.insertAbove) {
          simplified.insertAbove(path2);
        }
      } else if (path1 && simplified.insertAbove) {
        simplified.insertAbove(path1);
      }
    }
    
    // path1の属性をコピー
    if (path1 && simplified.copyAttributes) {
      simplified.copyAttributes(path1, true);
    }
    
    return simplified;
  }

  /**
   * Boolean演算の実行
   * paper.jsのtraceBoolean関数を移植
   */
  private static traceBoolean(
    path1: PathItem,
    path2: PathItem,
    operation: 'unite' | 'intersect' | 'subtract' | 'exclude' | 'divide',
    options?: { insert?: boolean, trace?: boolean, stroke?: boolean }
  ): PathItem {
    // ストロークベースのBoolean演算の場合は別の処理を行う
    if (options && (options.trace === false || options.stroke) &&
        /^(subtract|intersect)$/.test(operation)) {
      // TODO: splitBooleanの実装
      // return splitBoolean(path1, path2, operation);
    }

    // パスを準備
    const _path1 = preparePath(path1, true) as Path;
    const _path2 = preparePath(path2, true) as Path;

    // デバッグ: カーブ配列の内容を出力
    console.log('DEBUG: _path1.getCurves() values:');
    _path1.getCurves().forEach((curve, i) => {
      console.log(`  path1 curve[${i}]:`, curve.getValues());
    });
    if (_path2) {
      console.log('DEBUG: _path2.getCurves() values:');
      _path2.getCurves().forEach((curve, i) => {
        console.log(`  path2 curve[${i}]:`, curve.getValues());
      });
    }

    // 演算子に応じたフィルタ関数を定義
    const operators: Record<string, Record<string, boolean>> = {
      'unite':     { '1': true, '2': true },
      'intersect': { '2': true },
      'subtract':  { '1': true },
      'exclude':   { '1': true, '-1': true }
    };
    
    // 現在の演算に対応するフィルタ関数
    const operator = operators[operation];
    
    // paper.jsと同様に、operatorにoperationプロパティを追加
    operator[operation] = true;

    // 減算と排他的論理和の場合、パスの向きを調整
    if (_path2 && ((operator.subtract || operator.exclude)
        !== (_path2.isClockwise() !== _path1.isClockwise()))) {
      _path2.reverse();
    }

    // 交点計算
    function filterIntersection(inter: CurveLocation): boolean {
      return inter.hasOverlap() || inter.isCrossing();
    }

    // 交点を取得
    const intersections = _path2 ? getIntersections(_path1, _path2) : [];
    console.log('DEBUG: intersections.length:', intersections.length, intersections);

    if (intersections.length === 0) {
      // 交点がない場合は、reorientPathsを使用して結果を決定
      return this.createResult(
        this.handleNoIntersections(_path1, _path2, operation),
        true, path1, path2 as PathItem, options
      );
    }

    // 交点でパスを分割
    const dividedPath1 = dividePathAtIntersections(_path1, intersections);
    const dividedPath2 = _path2 ? dividePathAtIntersections(_path2, intersections) : null;
    
    // 交点のwinding number計算
    if (dividedPath2) {
      // 曲線の衝突マップを作成
      const segments: Segment[] = [];
      segments.push(...dividedPath1._segments);
      segments.push(...dividedPath2._segments);
      
      const curves: Curve[] = [];
      for (const segment of segments) {
        const curve = segment.getCurve();
        if (curve) curves.push(curve);
      }
      
      const curvesValues = curves.map(curve => curve.getValues());
      // paper.jsと同等の結果を得るためにfindCurveBoundsCollisionsWithBothAxisを使用
      const curveCollisions = CollisionDetection.findCurveBoundsCollisionsWithBothAxis(
        curvesValues, curvesValues, 0
      );
      
      // paper.jsと同じgetCurves関数を追加
      function getCurves(indices: number[] | null): Curve[] {
        const list: Curve[] = [];
        if (indices) {
          for (let i = 0; i < indices.length; i++) {
            if (indices[i] !== null) {
              list.push(curves[indices[i]]);
            }
          }
        }
        return list;
      }
      
      const curveCollisionsMap: Record<string, Record<number, { hor: Curve[]; ver: Curve[] }>> = {};
      for (let i = 0; i < curves.length; i++) {
        const curve = curves[i];
        const id = curve._path._id;
        const map = curveCollisionsMap[id] = curveCollisionsMap[id] || {};
        const collision = curveCollisions[i];
        map[curve.getIndex()] = {
          hor: getCurves(collision ? collision.hor : null),
          ver: getCurves(collision ? collision.ver : null)
        };
      }
      
      // 交点からwinding numberを伝播
      for (const intersection of intersections) {
        if (intersection.segment) {
          propagateWinding(intersection.segment, dividedPath1, dividedPath2, curveCollisionsMap, operator);
        }
      }
      
      // 残りのセグメントにもwinding numberを伝播
      for (const segment of segments) {
        const meta = getMeta(segment);
        if (meta && !meta.winding) {
          propagateWinding(segment, dividedPath1, dividedPath2, curveCollisionsMap, operator);
        }
      }
    }

    // セグメントを収集
    const segments: Segment[] = [];
    segments.push(...dividedPath1._segments);
    if (dividedPath2) {
      segments.push(...dividedPath2._segments);
    }

    // マーチングアルゴリズムで結果パスを構築
    const paths = tracePaths(segments, operator);

    // 結果パスを結合
    return this.createResult(paths, true, path1, path2 as PathItem, options);
  }

  /**
   * パスの合成（unite）
   */
  static unite(path1: PathItem, path2: PathItem): PathItem {
    return this.traceBoolean(path1, path2, 'unite');
  }
  
  /**
   * パスの交差（intersect）
   */
  static intersect(path1: PathItem, path2: PathItem): PathItem {
    return this.traceBoolean(path1, path2, 'intersect');
  }
  
  /**
   * パスの差分（subtract）
   */
  static subtract(path1: PathItem, path2: PathItem): PathItem {
    return this.traceBoolean(path1, path2, 'subtract');
  }
  
  /**
   * パスの排他的論理和（exclude）
   */
  static exclude(path1: PathItem, path2: PathItem): PathItem {
    return this.traceBoolean(path1, path2, 'exclude');
  }
  
  /**
   * パスの分割（divide）
   */
  static divide(path1: PathItem, path2: PathItem): PathItem {
    return this.traceBoolean(path1, path2, 'divide');
  }
}