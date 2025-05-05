/**
 * Segmentクラス（Papyrus2D版）
 * Paper.jsのSegmentクラスを参考に実装。
 * Paper.jsと同様にミュータブルな設計。
 */

import { Point } from '../basic/Point';
import { SegmentPoint } from './SegmentPoint';
import { Path } from './Path';
import { CurveLocation } from './CurveLocation';
import { ChangeFlag } from './ChangeFlag';

export class Segment {
  _point: SegmentPoint;
  _handleIn: SegmentPoint;
  _handleOut: SegmentPoint;
  
  // パスとの関連付け
  _path: Path;
  _index: number;

  // paper.jsとの互換性のためのゲッター
  get point(): Point {
    return this.getPoint();
  }

  get handleIn(): Point {
    return this.getHandleIn();
  }

  get handleOut(): Point {
    return this.getHandleOut();
  }

  /**
   * Segmentのコンストラクタ
   * @param point アンカーポイント
   * @param handleIn 入力ハンドル
   * @param handleOut 出力ハンドル
   */
  constructor(
    point: Point | null = new Point(0, 0),
    handleIn: Point | null = new Point(0, 0),
    handleOut: Point | null = new Point(0, 0)
  ) {
    if (point !== null && !(point instanceof Point)) {
      throw new TypeError('Segment: pointはPointまたはnullのみ許可されます');
    }
    if (handleIn !== null && !(handleIn instanceof Point)) {
      throw new TypeError('Segment: handleInはPointまたはnullのみ許可されます');
    }
    if (handleOut !== null && !(handleOut instanceof Point)) {
      throw new TypeError('Segment: handleOutはPointまたはnullのみ許可されます');
    }

    this._point = new SegmentPoint(point, this, '_point');
    this._handleIn = new SegmentPoint(handleIn, this, '_handleIn');
    this._handleOut = new SegmentPoint(handleOut, this, '_handleOut');
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
      path._changed(/*#=*/ChangeFlag.SEGMENTS);
    }
  }

  getPoint(): Point {
    return this._point.toPoint();
  }

  setPoint(...args: any[]): void {
    this._point.setPoint(Point.read(args));
  }

  getHandleIn(): Point {
    return this._handleIn.toPoint();
  }

  setHandleIn(...args: any[]): void {
    this._handleIn.setPoint(Point.read(args));
  }

  getHandleOut(): Point {
    return this._handleOut.toPoint();
  }

  setHandleOut(...args: any[]): void {
    this._handleOut.setPoint(Point.read(args));
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
      handleIn.isCollinear(handleOut);
  }

  clone(): Segment {
    // 直接SegmentPointを渡すのではなくPointに変換する
    return new Segment(
      this.getPoint(),
      this.getHandleIn(),
      this.getHandleOut()
    );
  }

  /**
   * ハンドルを反転する
   */
  reverse(): void {
    const handleIn = this._handleIn;
    const handleOut = this._handleOut;
    const tmp = handleIn.clone();
    handleIn.set(handleOut);
    handleOut.set(tmp);
  }

  /**
   * ハンドルを反転した新しいSegmentを返す
   */
  reversed(): Segment {
    return new Segment(
      this._point.toPoint(),
      this._handleOut.toPoint(),
      this._handleIn.toPoint()
    );
  }

  /**
   * デバッグ用の文字列表現を返す。
   * SegmentPoint#toString() を直接呼ぶと util.inspect などの状況によっては
   * Segment#toString() が再帰的に呼ばれるケースがあるため、各座標を
   * プリミティブ値として展開し、確実に再帰が生じない安全な実装とする。
   */
  toString(): string {
    const p = this._point;
    console.log(p._x, p._y);
    const parts: string[] = [`point: { x: ${p._x}, y: ${p._y} }`];

    if (this._handleIn && !this._handleIn.isZero()) {
      const hIn = this._handleIn;
      parts.push(`handleIn: { x: ${hIn._x}, y: ${hIn._y} }`);
    }
    if (this._handleOut && !this._handleOut.isZero()) {
      const hOut = this._handleOut;
      parts.push(`handleOut: { x: ${hOut._x}, y: ${hOut._y} }`);
    }
    return `{ ${parts.join(', ')} }`;
  }

  equals(segment: Segment): boolean {
    return segment === this || (segment &&
      this._point.equals(segment._point) &&
      this._handleIn.equals(segment._handleIn) &&
      this._handleOut.equals(segment._handleOut)
    ) || false;
  }

  getIndex(): number | null {
    return this._index !== undefined ? this._index : null;
  }

  getPath(): any {
    return this._path || null;
  }

  /**
   * このセグメントが属するカーブを取得します。オープンパスの最後のセグメントの場合、
   * 前のセグメントが返されます。
   *
   * @return {Curve | null} セグメントが属するカーブ、または存在しない場合はnull
   */
  getCurve(): any {
    const path = this._path;
    const index = this._index;
    if (path) {
      // オープンパスの最後のセグメントは最後のカーブに属します。
      if (index > 0 && !path._closed
              && index === path._segments.length - 1)
        return path.getCurves()[index - 1] || null;
      return path.getCurves()[index] || null;
    }
    return null;
  }

  /**
   * このセグメントのパス上の位置を表すカーブロケーションを取得します。
   *
   * @return {any} カーブロケーション、または存在しない場合はnull
   */
  getLocation(): any {
    const curve = this.getCurve();
    return curve
            ? new CurveLocation(curve, this === curve._segment1 ? 0 : 1)
            : null;
  }

  /**
   * Segment を回転させる
   * @param angle 角度（度数法）
   * @param center 回転中心（デフォルトは原点）
   */
  // rotate メソッドは paper.js には存在しないため削除

  /**
   * Segment をスケール変換する
   * @param scale スケール係数（Point もしくは number）。number の場合は等方スケール
   * @param sy scale が number の場合の y 方向スケール（省略時は scale と同値）
   * @param center スケール中心（デフォルトは原点）
   */
  // scale メソッドは paper.js には存在しないため削除

  /**
   * 行列変換する
   * @param matrix 変換行列
   */
  transform(matrix: any): Segment {
    this._transformCoordinates(matrix, new Array(6), true);
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
    // 行列変換バージョンを使用して、複数の点を一度に処理し、
    // Point.read()やPointコンストラクタの呼び出しを避けることで
    // パフォーマンスを大幅に向上させます。
    const point = this._point;
    // changeがtrueの場合、ハンドルが設定されている場合のみ変換します。
    // _transformCoordinatesは、セグメントを変更する目的でのみ呼び出されるため。
    // これにより計算時間を節約できます。changeがfalseの場合は、
    // 常に実際のハンドルを使用します。これはgetBounds()用の座標を受け取るためです。
    const handleIn = !change || !this._handleIn.isZero()
            ? this._handleIn : null;
    const handleOut = !change || !this._handleOut.isZero()
            ? this._handleOut : null;
    let x = point._x;
    let y = point._y;
    let i = 2;
    coords[0] = x;
    coords[1] = y;
    // ハンドルを変換するために絶対座標に変換する必要があります。
    if (handleIn) {
      coords[i++] = handleIn._x + x;
      coords[i++] = handleIn._y + y;
    }
    if (handleOut) {
      coords[i++] = handleOut._x + x;
      coords[i++] = handleOut._y + y;
    }
    // 行列が提供されなかった場合、これは単に座標を取得するために呼び出されただけなので、
    // ここで終了します。
    if (matrix) {
      matrix._transformCoordinates(coords, coords, i / 2);
      x = coords[0];
      y = coords[1];
      if (change) {
        // changeがtrueの場合、新しい値を設定する必要があります
        point._x = x;
        point._y = y;
        i = 2;
        if (handleIn) {
          handleIn._x = coords[i++] - x;
          handleIn._y = coords[i++] - y;
        }
        if (handleOut) {
          handleOut._x = coords[i++] - x;
          handleOut._y = coords[i++] - y;
        }
      } else {
        // ハンドルがnullの場合でも結果を座標に入れる必要があります
        if (!handleIn) {
          coords[2] = x;
          coords[3] = y;
        }
        if (!handleOut) {
          coords[4] = x;
          coords[5] = y;
        }
      }
    }
    return coords;
  }

  /**
   * シリアライズ用の内部メソッド
   */

  /**
   * セグメントを滑らかにする
   * @param options スムージングオプション
   * @param _first 最初のセグメントフラグ（内部用）
   * @param _last 最後のセグメントフラグ（内部用）
   */
  smooth(options: any = {}, _first?: boolean, _last?: boolean): void {
    const opts = options || {};
    const type = opts.type;
    const factor = opts.factor;
    
    const prev = this.getPrevious();
    const next = this.getNext();
    
    // 計算用の点を取得
    const p0 = (prev || this)._point;
    const p1 = this._point;
    const p2 = (next || this)._point;
    const d1 = p0.getDistance(p1);
    const d2 = p1.getDistance(p2);

    if (!type || type === 'catmull-rom') {
      // Catmull-Romスプライン
      const a = factor === undefined ? 0.5 : factor;
      const d1_a = Math.pow(d1, a);
      const d1_2a = d1_a * d1_a;
      const d2_a = Math.pow(d2, a);
      const d2_2a = d2_a * d2_a;

      if (!_first && prev) {
        const A = 2 * d2_2a + 3 * d2_a * d1_a + d1_2a;
        const N = 3 * d2_a * (d2_a + d1_a);
        const handleIn = N !== 0
          ? new Point(
              (d2_2a * p0._x + A * p1._x - d1_2a * p2._x) / N - p1._x,
              (d2_2a * p0._y + A * p1._y - d1_2a * p2._y) / N - p1._y)
          : new Point();
        this.setHandleIn(handleIn);
      }

      if (!_last && next) {
        const A = 2 * d1_2a + 3 * d1_a * d2_a + d2_2a;
        const N = 3 * d1_a * (d1_a + d2_a);
        const handleOut = N !== 0
          ? new Point(
              (d1_2a * p2._x + A * p1._x - d2_2a * p0._x) / N - p1._x,
              (d1_2a * p2._y + A * p1._y - d2_2a * p0._y) / N - p1._y)
          : new Point();
        this.setHandleOut(handleOut);
      }
    } else if (type === 'geometric') {
      // 幾何学的スムージング
      if (prev && next) {
        const vector = p0.subtract(p2);
        const t = factor === undefined ? 0.4 : factor;
        const k = t * d1 / (d1 + d2);
        
        if (!_first) {
          const handleIn = vector.multiply(k);
          this.setHandleIn(handleIn);
        }
        if (!_last) {
          const handleOut = vector.multiply(k - t);
          this.setHandleOut(handleOut);
        }
      }
    } else {
      throw new Error('Smoothing method \'' + type + '\' not supported.');
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

  /**
   * 2つの指定されたセグメント間を補間し、このセグメントのポイントとハンドルを
   * それに応じて設定します。
   *
   * @param from factorが0のときの形状を定義するセグメント
   * @param to factorが1のときの形状を定義するセグメント
   * @param factor 補間係数（通常は0から1の間だが、外挿も可能）
   */
  interpolate(from: Segment, to: Segment, factor: number): void {
    const u = 1 - factor;
    const v = factor;
    const point1 = from._point;
    const point2 = to._point;
    const handleIn1 = from._handleIn;
    const handleIn2 = to._handleIn;
    const handleOut2 = to._handleOut;
    const handleOut1 = from._handleOut;
    this._point._set(
            u * point1._x + v * point2._x,
            u * point1._y + v * point2._y, true);
    this._handleIn._set(
            u * handleIn1._x + v * handleIn2._x,
            u * handleIn1._y + v * handleIn2._y, true);
    this._handleOut._set(
            u * handleOut1._x + v * handleOut2._x,
            u * handleOut1._y + v * handleOut2._y, true);
    this._changed();
  }

  /**
   * セグメントを所属するパスから削除します。
   * @return セグメントが削除された場合はtrue
   */
  remove(): boolean {
    return this._path ? !!this._path.removeSegment(this._index) : false;
  }
}