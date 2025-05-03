/**
 * Segmentクラス（Papyrus2D版）
 * Paper.jsのSegmentクラスを参考に実装。
 * Paper.jsと同様にミュータブルな設計。
 */

import { Point } from '../basic/Point';
import { SegmentPoint } from './SegmentPoint';

export class Segment {
  _point: SegmentPoint;
  _handleIn: SegmentPoint;
  _handleOut: SegmentPoint;
  
  // パスとの関連付け
  _path: any; // Path型を参照するとcircular dependencyになるため、any型を使用
  _index: number;

  /**
   * Segmentのコンストラクタ
   * @param point アンカーポイント
   * @param handleIn 入力ハンドル
   * @param handleOut 出力ハンドル
   */
  constructor(
    point: Point | object | number = new Point(0, 0),
    handleIn: Point | object | number = new Point(0, 0),
    handleOut: Point | object | number = new Point(0, 0),
    arg3?: number, arg4?: number, arg5?: number
  ) {
    let pointObj: Point | object | number | undefined = point;
    let handleInObj: Point | object | number | undefined = handleIn;
    let handleOutObj: Point | object | number | undefined = handleOut;

    // paper.jsと同様の引数解析
    const count = arguments.length;
    if (count > 0) {
      if (point == null || typeof point === 'object') {
        if (count === 1 && point && 'point' in point) {
          // オブジェクト記法: { point: ..., handleIn: ..., handleOut: ... }
          const obj = point as any;
          pointObj = obj.point;
          handleInObj = obj.handleIn;
          handleOutObj = obj.handleOut;
        } else {
          // 通常の引数: (point, handleIn, handleOut)
          pointObj = point;
          handleInObj = handleIn;
          handleOutObj = handleOut;
        }
      } else {
        // 座標値の引数: (x, y, inX, inY, outX, outY)
        pointObj = [point as number, handleIn as number];
        handleInObj = arg3 !== undefined ? [arg3, arg4] : undefined;
        handleOutObj = arg5 !== undefined ? [arg5, arguments[5]] : undefined;
      }
    }

    // SegmentPointの作成
    this._point = new SegmentPoint(pointObj, this, '_point');
    this._handleIn = new SegmentPoint(handleInObj, this, '_handleIn');
    this._handleOut = new SegmentPoint(handleOutObj, this, '_handleOut');
  }

  /**
   * 内部変更通知メソッド（SegmentPointから呼ばれる）
   * @param point 変更されたSegmentPoint
   */
  _changed(point?: SegmentPoint): void {
    const path = this._path;
    if (!path) return;

    // 関連するカーブに変更を通知
    const curves = path._curves;
    const index = this._index;
    let curve;

    if (curves) {
      // 変更されたポイントに応じて、影響を受けるカーブに通知
      if ((!point || point === this._point || point === this._handleIn)
          && (curve = index > 0 ? curves[index - 1] : path._closed
              ? curves[curves.length - 1] : null))
        curve._changed();

      // 出力ハンドルが変更された場合は、次のカーブに通知
      if ((!point || point === this._point || point === this._handleOut)
          && (curve = curves[index]))
        curve._changed();
    }

    // パスに変更を通知
    if (path._changed) {
      path._changed(1); // ChangeFlag.SEGMENTSに相当
    }
  }

  getPoint(): Point {
    return this._point.toPoint();
  }

  setPoint(point: Point | number[] | any): void {
    this._point.setPoint(new Point(point));
  }

  getHandleIn(): Point {
    return this._handleIn.toPoint();
  }

  setHandleIn(point: Point | number[] | any): void {
    this._handleIn.setPoint(new Point(point));
  }

  getHandleOut(): Point {
    return this._handleOut.toPoint();
  }

  setHandleOut(point: Point | number[] | any): void {
    this._handleOut.setPoint(new Point(point));
  }

  hasHandles(): boolean {
    return !this._handleIn.isZero() || !this._handleOut.isZero();
  }

  /**
   * セグメントが滑らかかどうか（ハンドルが共線状にあるか）
   */
  isSmooth(): boolean {
    const handleIn = this._handleIn;
    const handleOut = this._handleOut;
    return !handleIn.isZero() && !handleOut.isZero() &&
      new Point(handleIn.getX(), handleIn.getY()).isCollinear(
        new Point(handleOut.getX(), handleOut.getY())
      );
  }

  clone(): Segment {
    return new Segment(this.getPoint(), this.getHandleIn(), this.getHandleOut());
  }

  /**
   * ハンドルを反転する
   */
  reverse(): void {
    const handleIn = this._handleIn;
    const handleOut = this._handleOut;
    const tmp = handleIn.clone();
    handleIn._set(handleOut._x, handleOut._y);
    handleOut._set(tmp._x, tmp._y);
  }

  /**
   * ハンドルを反転した新しいSegmentを返す
   */
  reversed(): Segment {
    return new Segment(this.getPoint(), this.getHandleOut(), this.getHandleIn());
  }

  toString(): string {
    const parts = ['point: ' + this.getPoint()];
    if (!this._handleIn.isZero())
      parts.push('handleIn: ' + this.getHandleIn());
    if (!this._handleOut.isZero())
      parts.push('handleOut: ' + this.getHandleOut());
    return '{ ' + parts.join(', ') + ' }';
  }

  equals(other: Segment): boolean {
    return other === this || (
      other instanceof Segment &&
      this.getPoint().equals(other.getPoint()) &&
      this.getHandleIn().equals(other.getHandleIn()) &&
      this.getHandleOut().equals(other.getHandleOut())
    );
  }

  getIndex(): number | null {
    return this._index !== undefined ? this._index : null;
  }

  getPath(): any {
    return this._path || null;
  }

  /**
   * Segment を平行移動する
   * @param offset 移動量（Point もしくは number）。number の場合は dx とみなす
   * @param dy offset が number の場合の y 方向移動量（省略時は 0）
   */
  translate(offset: Point | number, dy: number = 0): Segment {
    const delta = offset instanceof Point ? offset : new Point(offset, dy);
    this._point._set(
      this._point._x + delta.x,
      this._point._y + delta.y
    );
    this._changed();
    return this;
  }

  /**
   * Segment を回転させる
   * @param angle 角度（度数法）
   * @param center 回転中心（デフォルトは原点）
   */
  rotate(angle: number, center: Point = new Point(0, 0)): Segment {
    const newPoint = this.getPoint().rotate(angle, center);
    // ハンドルは point からの相対ベクトルなので原点中心で回転
    const newHandleIn = this.getHandleIn().rotate(angle);
    const newHandleOut = this.getHandleOut().rotate(angle);
    
    this.setPoint(newPoint);
    this.setHandleIn(newHandleIn);
    this.setHandleOut(newHandleOut);
    
    return this;
  }

  /**
   * Segment をスケール変換する
   * @param scale スケール係数（Point もしくは number）。number の場合は等方スケール
   * @param sy scale が number の場合の y 方向スケール（省略時は scale と同値）
   * @param center スケール中心（デフォルトは原点）
   */
  scale(scale: Point | number, sy?: number, center: Point = new Point(0, 0)): Segment {
    let sx: number;
    let syVal: number;
    if (scale instanceof Point) {
      sx = scale.x;
      syVal = scale.y;
    } else {
      sx = scale;
      syVal = sy ?? scale;
    }

    // point は center からのベクトルにスケールを掛けて戻す
    const point = this.getPoint();
    const shifted = point.subtract(center).multiply(new Point(sx, syVal));
    const newPoint = shifted.add(center);

    // ハンドルは相対ベクトルなのでそのままスケール
    const newHandleIn = this.getHandleIn().multiply(new Point(sx, syVal));
    const newHandleOut = this.getHandleOut().multiply(new Point(sx, syVal));

    this.setPoint(newPoint);
    this.setHandleIn(newHandleIn);
    this.setHandleOut(newHandleOut);

    return this;
  }

  /**
   * 行列変換する
   * @param matrix 変換行列
   */
  transform(matrix: any): Segment {
    // 座標配列を作成
    const coords = new Array(6);
    this._transformCoordinates(matrix, coords, true);
    this._changed();
    return this;
  }

  /**
   * 座標を変換する内部メソッド
   * @param matrix 変換行列
   * @param coords 座標配列（出力）
   * @param change 変更フラグ
   */
  _transformCoordinates(matrix: any, coords: number[], change: boolean): number[] {
    const point = this._point;
    const handleIn = !change || !this._handleIn.isZero() ? this._handleIn : null;
    const handleOut = !change || !this._handleOut.isZero() ? this._handleOut : null;
    const x = point.getX();
    const y = point.getY();
    let i = 2;

    coords[0] = x;
    coords[1] = y;

    // ハンドルを絶対座標に変換
    if (handleIn) {
      coords[i++] = handleIn.getX() + x;
      coords[i++] = handleIn.getY() + y;
    }
    if (handleOut) {
      coords[i++] = handleOut.getX() + x;
      coords[i++] = handleOut.getY() + y;
    }

    if (matrix) {
      matrix._transformCoordinates(coords, coords, i / 2);
      
      if (change) {
        // 変更フラグがtrueの場合、新しい値を設定
        point._x = coords[0];
        point._y = coords[1];
        i = 2;
        if (handleIn) {
          handleIn._x = coords[i++] - coords[0];
          handleIn._y = coords[i++] - coords[1];
        }
        if (handleOut) {
          handleOut._x = coords[i++] - coords[0];
          handleOut._y = coords[i++] - coords[1];
        }
      } else {
        // 変更フラグがfalseの場合、ハンドルがnullでも座標を設定
        if (!handleIn) {
          coords[2] = coords[0];
          coords[3] = coords[1];
        }
        if (!handleOut) {
          coords[4] = coords[0];
          coords[5] = coords[1];
        }
      }
    }

    return coords;
  }

  /**
   * 2つのセグメント間を補間する
   * @param from 開始セグメント
   * @param to 終了セグメント
   * @param factor 補間係数（0〜1）
   */
  interpolate(from: Segment, to: Segment, factor: number): void {
    const u = 1 - factor;
    const v = factor;
    const point1 = from.getPoint();
    const point2 = to.getPoint();
    const handleIn1 = from.getHandleIn();
    const handleIn2 = to.getHandleIn();
    const handleOut1 = from.getHandleOut();
    const handleOut2 = to.getHandleOut();

    this._point._set(
      u * point1.x + v * point2.x,
      u * point1.y + v * point2.y
    );
    this._handleIn._set(
      u * handleIn1.x + v * handleIn2.x,
      u * handleIn1.y + v * handleIn2.y
    );
    this._handleOut._set(
      u * handleOut1.x + v * handleOut2.x,
      u * handleOut1.y + v * handleOut2.y
    );
    
    this._changed();
  }

  /**
   * 2つのセグメント間を補間した新しいSegmentを返す
   * @param from 開始セグメント
   * @param to 終了セグメント
   * @param factor 補間係数（0〜1）
   */
  static interpolate(from: Segment, to: Segment, factor: number): Segment {
    const segment = new Segment();
    segment.interpolate(from, to, factor);
    return segment;
  }

  /**
   * セグメントを滑らかにする
   * @param options スムージングオプション
   * @param _first 最初のセグメントフラグ（内部用）
   * @param _last 最後のセグメントフラグ（内部用）
   */
  smooth(options: any = {}, _first?: boolean, _last?: boolean): void {
    const type = options.type;
    const factor = options.factor;
    
    // パスとの関連付けがある場合は前後のセグメントを取得
    const prev = options.previous || this.getPrevious();
    const next = options.next || this.getNext();
    
    if (!prev || !next) {
      return; // 前後のセグメントがなければ変更なし
    }

    // 計算用の点を取得
    const p0 = prev.getPoint();
    const p1 = this.getPoint();
    const p2 = next.getPoint();
    const d1 = p0.getDistance(p1);
    const d2 = p1.getDistance(p2);

    if (!type || type === 'catmull-rom') {
      // Catmull-Romスプライン
      const a = factor === undefined ? 0.5 : factor;
      const d1_a = Math.pow(d1, a);
      const d1_2a = d1_a * d1_a;
      const d2_a = Math.pow(d2, a);
      const d2_2a = d2_a * d2_a;

      if (!_first) {
        const A = 2 * d2_2a + 3 * d2_a * d1_a + d1_2a;
        const N = 3 * d2_a * (d2_a + d1_a);
        if (N !== 0) {
          this.setHandleIn(new Point(
            (d2_2a * p0.x + A * p1.x - d1_2a * p2.x) / N - p1.x,
            (d2_2a * p0.y + A * p1.y - d1_2a * p2.y) / N - p1.y
          ));
        } else {
          this.setHandleIn(new Point(0, 0));
        }
      }

      if (!_last) {
        const A = 2 * d1_2a + 3 * d1_a * d2_a + d2_2a;
        const N = 3 * d1_a * (d1_a + d2_a);
        if (N !== 0) {
          this.setHandleOut(new Point(
            (d1_2a * p2.x + A * p1.x - d2_2a * p0.x) / N - p1.x,
            (d1_2a * p2.y + A * p1.y - d2_2a * p0.y) / N - p1.y
          ));
        } else {
          this.setHandleOut(new Point(0, 0));
        }
      }
    } else if (type === 'geometric') {
      // 幾何学的スムージング
      if (prev && next) {
        const vector = p0.subtract(p2);
        const t = factor === undefined ? 0.4 : factor;
        const k = t * d1 / (d1 + d2);
        
        if (!_first) {
          this.setHandleIn(vector.multiply(k));
        }
        if (!_last) {
          this.setHandleOut(vector.multiply(k - t));
        }
      }
    } else {
      throw new Error(`Smoothing method '${type}' not supported.`);
    }
  }

  getPrevious(): Segment | null {
    const segments = this._path && this._path._segments;
    return segments && (segments[this._index - 1]
            || this._path._closed && segments[segments.length - 1]) || null;
  }

  getNext(): Segment | null {
    const segments = this._path && this._path._segments;
    return segments && (segments[this._index + 1]
            || this._path._closed && segments[0]) || null;
  }

  isFirst(): boolean {
    return !this._index;
  }

  isLast(): boolean {
    const path = this._path;
    return path && this._index === path._segments.length - 1 || false;
  }

  clearHandles(): Segment {
    this._handleIn._set(0, 0);
    this._handleOut._set(0, 0);
    return this;
  }
}