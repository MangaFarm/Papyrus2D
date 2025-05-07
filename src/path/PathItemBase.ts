/**
 * PathItemBase クラス
 * PathItemインターフェースを実装する抽象基底クラス。
 * Path と CompoundPath の共通機能を提供する。
 */

import { Point } from '../basic/Point';
import { Rectangle } from '../basic/Rectangle';
import { Matrix } from '../basic/Matrix';
import { Curve } from './Curve';
import { Segment } from './Segment';
import { CurveLocation } from './CurveLocation';
import { PathItem, Style, FillRule } from './PathItem';
import type { Path } from './Path';
import { PathBoolean } from './PathBoolean';

export abstract class PathItemBase implements PathItem {
 // PathItemインターフェースの実装
 _matrix?: Matrix;
 _matrixDirty: boolean = false;
 _bounds?: Rectangle;
 _version: number = 0;
 static _idCount: number = 0;
 _id: number;

 /** 親アイテム (paper.js互換) */
 protected _parent: PathItemBase | null = null;

 constructor() {
   this._id = ++PathItemBase._idCount;
 }

 /** 親アイテムを取得 (paper.js: getParent) */
 getParent(): PathItemBase | null {
   return this._parent;
 }

 /** 挿入済みかどうか (paper.js: isInserted) */
 isInserted(): boolean {
   return this._parent ? this._parent.isInserted() : false;
 }
  
  // スタイル設定
  style: Style = {
    fillRule: 'nonzero'
  };

  // 抽象プロパティ
  abstract get closed(): boolean;
  abstract get segmentCount(): number;

  // 抽象メソッド - サブクラスで実装する必要がある
  abstract getSegments(): Segment[];
  abstract getCurves(): Curve[];
  abstract getArea(): number;
  abstract reverse(): PathItemBase;
  abstract getPaths(): Path[];
  abstract clone(deep?: boolean): PathItem;

  /**
   * パスが時計回りかどうかを判定
   * paper.jsのisClockwise()メソッドを移植
   * @returns 時計回りならtrue
   */
  isClockwise(): boolean {
    return this.getArea() >= 0;
  }

  /**
   * パスの方向を時計回りまたは反時計回りに設定します
   * paper.jsのsetClockwise()メソッドを移植
   * @param clockwise 時計回りにする場合はtrue、反時計回りにする場合はfalse
   * @returns このパス
   */
  setClockwise(clockwise: boolean): PathItem {
    if (this.isClockwise() !== !!clockwise) {
      this.reverse();
    }
    return this;
  }

  /**
   * パスの長さを取得
   */
  abstract getLength(): number;

  /**
   * パスの境界ボックスを取得
   */
  abstract getBounds(matrix?: Matrix | null): Rectangle;

  /**
   * 指定されたパラメータ位置のパス上の点を取得
   */
  abstract getPointAt(t: number): Point;

  /**
   * 指定されたパラメータ位置のパス上の接線ベクトルを取得
   */
  abstract getTangentAt(t: number): Point;

  /**
   * 点がパス内部にあるかどうかを判定
   */
  abstract contains(point: Point): boolean;

  /**
   * 他のパスとの交点を取得
   */
  abstract getIntersections(path: PathItem): CurveLocation[];

  /**
   * パスが空かどうかを判定
   */
  abstract isEmpty(): boolean;

  /**
   * パスを削除する
   */
  abstract remove(): PathItem | null;

  /**
   * パスを簡略化する
   */
  abstract reduce(options?: { simplify?: boolean }): PathItem;

  /**
   * 指定されたパスが兄弟関係にあるかどうかを判定する
   */
  abstract isSibling(path: PathItem): boolean;

  /**
   * パスのインデックスを取得する
   */
  abstract getIndex(): number;

  /**
   * 指定されたパスの上に挿入する
   */
  abstract insertAbove(path: PathItem): PathItem;

  /**
   * 指定されたパスの属性をコピーする
   */
  /**
   * 指定されたパスの属性をコピーする
   * paper.jsのItem.copyAttributes()に準拠
   */
  copyAttributes(path: PathItem, excludeMatrix?: boolean): PathItem {
    // 行列のコピー
    if (!excludeMatrix && path._matrix) {
      this._matrix = path._matrix.clone();
    }
    // styleのコピー（シャローコピー）
    this.style = { ...path.style };
    // その他の属性コピー
    // Papyrus2Dでは _locked, _visible, _blendMode, _opacity, _clipMask, _guide などをPathItemBaseで定義していない場合は無視
    // 必要ならPathItemBaseに明示的に追加する
    // データと名前
    // Papyrus2DのPathItemBaseには_dataや_nameは定義されていないため、ここは一旦放置
    // paper.jsではItem._data, Item._nameが存在するが、Papyrus2Dで必要ならPathItemBaseに追加すること
    // if (path._data !== undefined) {
    //   this._data = path._data ? JSON.parse(JSON.stringify(path._data)) : null;
    // }
    // if (path._name !== undefined) {
    //   this._name = path._name!;
    // }
    return this;
  }

  /**
   * 交差を解決する
   * paper.jsのPathItem.resolveCrossings()を移植
   * @returns 交差が解決されたパス
   */
  resolveCrossings(): PathItem {
    throw new Error('Method resolveCrossings() not implemented yet');
  }

  /**
   * パスの向きを再設定する
   * paper.jsのPathItem.reorient()を移植
   * @param nonZero 非ゼロ塗りつぶしルールを適用するかどうか
   * @param clockwise 時計回りにするかどうか
   * @returns このパス
   */
  abstract reorient(nonZero?: boolean, clockwise?: boolean): PathItem;

  /**
   * 塗りつぶしルールを取得する
   * paper.jsのItem.getFillRule()を移植
   * @returns 塗りつぶしルール
   */
  getFillRule(): string {
    return this.style.fillRule;
  }

  /**
   * 塗りつぶしルールを設定する
   * @param rule 塗りつぶしルール ('nonzero' または 'evenodd')
   * @returns このパス
   */
  setFillRule(rule: FillRule): PathItem {
    this.style.fillRule = rule;
    return this;
  }

  /**
   * 変換行列を適用する
   * paper.jsのItem.transform()を移植
   * @param matrix 変換行列
   * @param applyRecursively 再帰的に適用するかどうか
   * @param setApplyMatrix 行列を適用するかどうか
   * @returns このパス
   */
  /**
   * 変換行列を適用する
   * paper.jsのItem.transformを移植
   * @param matrix 変換行列
   * @param applyRecursively 再帰的に適用するかどうか
   * @param setApplyMatrix 行列を適用するかどうか（Papyrus2Dでは無視）
   * @returns このパス
   */
  transform(matrix: Matrix | null, applyRecursively?: boolean, setApplyMatrix?: boolean): PathItem {
    // マトリックスを更新
    const _matrix = this._matrix || Matrix.identity();
    const transformMatrix = matrix && !matrix.isIdentity();

    // 変換行列が単位行列で再帰適用の必要がなければ、そのまま返す
    if (!transformMatrix && !applyRecursively) {
      return this;
    }

    // 行列を適用
    if (transformMatrix) {
      // 行列を適用
      if (this._matrix) {
        this._matrix = _matrix.prepend(matrix);
      } else {
        this._matrix = matrix.clone();
      }
      
      this._matrixDirty = true;
      
      // バウンズのキャッシュをクリア
      this._bounds = undefined;
    }

    // 子要素に再帰的に適用
    this._transformContent(matrix, applyRecursively);

    // 変更を通知
    this._version++;

    return this;
  }

  /**
   * 内容に変換を適用する
   * paper.jsのItem._transformContentを移植
   * @param matrix 変換行列
   * @param applyRecursively 再帰的に適用するかどうか
   * @returns 変換が適用されたかどうか
   */
  protected _transformContent(matrix: Matrix | null, applyRecursively?: boolean): boolean {
    // PathItemBaseは抽象クラスなので、実装はサブクラスで行う
    // getPaths()は抽象メソッドなので、それを使って子パスに変換を適用
    const paths = this.getPaths();
    if (paths && paths.length > 0) {
      for (let i = 0, len = paths.length; i < len; i++) {
        // PathItemBaseを継承したオブジェクトのみtransformメソッドを呼び出せる
        if (paths[i] instanceof PathItemBase) {
          (paths[i] as PathItemBase).transform(matrix, applyRecursively);
        }
      }
      return true;
    }
    return false;
  }

  /**
   * パスの交差（intersect）
   * paper.js互換API
   */
  intersect(other: PathItem): PathItem {
    return PathBoolean.intersect(this, other);
  }
/**
   * パスの合成（unite）
   * paper.js互換API
   */
  unite(other: PathItem): PathItem {
    return PathBoolean.unite(this, other);
  }

  /**
   * パスの差分（subtract）
   * paper.js互換API
   */
  subtract(other: PathItem): PathItem {
    return PathBoolean.subtract(this, other);
  }

  /**
    * パスの排他論理和（exclude）
    * paper.js互換API
    */
  exclude(other: PathItem): PathItem {
    return PathBoolean.exclude(this, other);
  }

  /**
    * パスの分割（divide）
    * paper.js互換API
    */
  divide(other: PathItem): PathItem {
    return PathBoolean.divide(this, other);
  }
}