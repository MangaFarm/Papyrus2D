/**
 * PathBoolean: Boolean演算クラス
 * paper.jsのPathItem.Boolean.jsを参考に実装
 */

import { Path } from './Path';
import { Segment } from './Segment';
import { Curve } from './Curve';
import { CompoundPath } from './CompoundPath';
import { PathItem } from './PathItem';
import { PathItemBase } from './PathItemBase';
import { reorientPaths } from './PathBooleanReorient';
import { CollisionDetection } from '../util/CollisionDetection';
import { preparePath } from './PathBooleanPreparation';
import { tracePaths } from './PathBooleanTracePaths';
import { propagateWinding } from './PathBooleanWinding';
import { getMeta } from './SegmentMeta';
import { getIntersections, divideLocations } from './PathBooleanIntersections';

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
      return [path1];
    }
    
    // reorientPathsを使用して結果を決定
    const result = reorientPaths(
      path2 ? [path1, path2] : [path1],
      (w: number) => !!operator[w]
    );
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
      
      // paper.jsの実装に合わせて、空のパスを作成
      const emptyPath = new Path();
      
      // path1の属性をコピー
      if (path1) {
        emptyPath.copyAttributes(path1 as PathItemBase, true);
      }
      
      // 挿入オプションが明示的にfalseでない場合、結果を挿入
      if (!(options && options.insert === false)) {
        if (path1) {
          emptyPath.insertAbove(path1);
        }
      }
      
      return emptyPath;
    }

    // pathsが空でない場合の冗長なループは削除
    
    // 結果のCompoundPathを作成
    const result = new CompoundPath();
    result.addChildren(paths);

    // パスを簡略化（reduce相当の処理）
    const simplified = result.reduce({ simplify });
    // CompoundPath型の特別処理は不要

    // 挿入オプションが明示的にfalseでない場合、結果を挿入
    if (!(options && options.insert === false)) {
      // path1とpath2が存在し、兄弟関係にある場合、
      // path1のインデックスがpath2より小さければpath2の上に、
      // そうでなければpath1の上に挿入
      if (path2 && path1 &&
          path1.isSibling!(path2) &&
          path1.getIndex!() < path2.getIndex!()) {
        simplified.insertAbove!(path2);
      } else if (path1) {
        simplified.insertAbove!(path1);
      }
    }
    
    // path1の属性をコピー
    if (path1) {
      simplified.copyAttributes(path1 as PathItemBase, true);
    }
    
    return simplified;
  }

  /**
   * Boolean演算の実行
   * paper.jsの関数を移植
   */
  private static runBoolean(
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
    // paper.jsと同じreverse条件に修正
    if (_path2 && Boolean(operator.subtract || operator.exclude) !== Boolean(_path2.isClockwise() !== _path1.isClockwise())) {
      _path2.reverse();
    }

    // 交点計算
    // 交点を取得
    const intersections = _path2 ? getIntersections(_path1, _path2) : [];

    if (intersections.length === 0) {
      // 交点がない場合は、reorientPathsを使用して結果を決定
      return this.createResult(
        this.handleNoIntersections(_path1, _path2, operation),
        true, path1, path2 as PathItem, options
      );
    }

    // 交点でパスを分割
    const dividedLocs1 = divideLocations(intersections);
    const dividedLocs2 = _path2 ? divideLocations(intersections) : null;
    
    // 交点のwinding number計算
    if (dividedLocs2) {
      // 曲線の衝突マップを作成
      const segments: Segment[] = [];
      segments.push(...dividedLocs1.map(loc => loc._segment!));
      segments.push(...dividedLocs2.map(loc => loc._segment!));
      
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
        const id = curve._path!._id;
        const map = curveCollisionsMap[id] = curveCollisionsMap[id] || {};
        const collision = curveCollisions[i];
        map[curve.getIndex()] = {
          hor: getCurves(collision ? collision.hor : null),
          ver: getCurves(collision ? collision.ver : null)
        };
      }
      
      // 交点からwinding numberを伝播
      // divideLocationsで得られた全セグメントに必ずwindingを伝播
      // divideLocationsで返される全セグメント（重複除外）にwindingを伝播
      const dividedSegments1 = Array.from(new Set(dividedLocs1.map(loc => loc._segment)))
        .filter(seg => seg && seg._path && seg._path._segments && seg._path._segments.includes(seg));
      for (const seg of dividedSegments1) {
        propagateWinding(seg!, _path1, _path2, curveCollisionsMap, operator);
        const meta = getMeta(seg!);
        const winding = meta._winding ? meta._winding.winding : undefined;
      }
      if (dividedLocs2) {
        for (const loc of dividedLocs2) {
          propagateWinding(loc._segment!, _path1, _path2, curveCollisionsMap, operator);
        }
      }
      // segments全体にもwinding未セットなら伝播（冗長だが安全）
      for (const segment of segments) {
        let meta = getMeta(segment);
        if (!meta._winding) {
          propagateWinding(segment, _path1, _path2, curveCollisionsMap, operator);
        }
      }
    }

    // デバッグ: dividedLocs1/2のwindingを出力
    for (let i = 0; i < dividedLocs1.length; i++) {
      const seg = dividedLocs1[i]._segment;
      const pt = seg!._point!.toPoint();
      const meta = getMeta(seg!);
      const winding = meta._winding ? meta._winding.winding : undefined;
    }
    if (dividedLocs2) {
      for (let i = 0; i < dividedLocs2.length; i++) {
        const seg = dividedLocs2[i]._segment;
        const pt = seg!._point!.toPoint();
        const meta = getMeta(seg!);
        const winding = meta._winding ? meta._winding.winding : undefined;
      }
    }

    // セグメントを収集
    // paper.jsと同じく、分割後の全パスの全セグメントをsegmentsに集める
    // paper.jsと同じ: 分割後の全パスの全セグメントをsegmentsに集める
    // paper.jsと同じく、分割後パス（paths1, paths2）の全セグメントをsegments配列にする
    const paths1 = _path1.getPaths ? _path1.getPaths() : [_path1];
    const paths2 = _path2 && _path2.getPaths ? _path2.getPaths() : (_path2 ? [_path2] : []);
    const segments: Segment[] = [];
    for (const p of paths1) segments.push(...p.getSegments());
    for (const p of paths2) segments.push(...p.getSegments());
    // 交点を持つセグメントだけに限定
    const intersectionSegments = segments.filter(seg => !!getMeta(seg)._intersection);
    function collectSegments(path: Path) {
      // CompoundPath型ならgetChildren()で再帰
      if (path instanceof CompoundPath) {
        for (const child of path._children) {
          collectSegments(child);
        }
      } else {
        segments.push(...path.getSegments());
      }
    }
    collectSegments(_path1);
    if (_path2) {
      collectSegments(_path2);
    }
    // paper.jsと同じく、分割後パス（paths1, paths2）の全セグメントをsegments配列にする
    // 重複したsegments宣言を削除

    // デバッグ: segmentsのwinding分布を出力
    for (let i = 0; i < segments.length; i++) {
      const meta = getMeta(segments[i]);
      const winding = meta._winding ? meta._winding.winding : undefined;
      const pt = segments[i]._point?.toPoint();
    }
    // intersectionSegmentsのwinding=1座標列を出力
    const winding1Segs = intersectionSegments.filter(seg => {
      const meta = getMeta(seg);
      return meta._winding && meta._winding.winding === 1;
    });

    // マーチングアルゴリズムで結果パスを構築
    const paths = tracePaths(intersectionSegments, operator);

    // 結果パスを結合
    return this.createResult(paths, true, path1, path2 as PathItem, options);
  }

  /**
   * パスの合成（unite）
   */
  static unite(path1: PathItem, path2: PathItem): PathItem {
    return this.runBoolean(path1, path2, 'unite');
  }
  
  /**
   * パスの交差（intersect）
   */
  static intersect(path1: PathItem, path2: PathItem): PathItem {
    return this.runBoolean(path1, path2, 'intersect');
  }
  
  /**
   * パスの差分（subtract）
   */
  static subtract(path1: PathItem, path2: PathItem): PathItem {
    return this.runBoolean(path1, path2, 'subtract');
  }
  
  /**
   * パスの排他的論理和（exclude）
   */
  static exclude(path1: PathItem, path2: PathItem): PathItem {
    return this.runBoolean(path1, path2, 'exclude');
  }
  
  /**
   * パスの分割（divide）
   */
  static divide(path1: PathItem, path2: PathItem): PathItem {
    return this.runBoolean(path1, path2, 'divide');
  }
}