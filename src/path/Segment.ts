/**
 * Segmentクラス（Papyrus2D版）
 * Paper.jsのSegmentクラスを参考に実装。
 * 内部ではSegmentPointを使用してmutableな操作を行うが、
 * 外部からはイミュータブルに見えるようにする。
 */

import { Point } from '../basic/Point';
import { SegmentPoint } from './SegmentPoint';

export class Segment {
  // 内部プロパティ（SegmentPoint）
  private _point: SegmentPoint;
  private _handleIn: SegmentPoint;
  private _handleOut: SegmentPoint;

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
    // Papyrus2Dでは外部からイミュータブルに見せるため、
    // 内部変更通知は最小限にする
  }

  /**
   * アンカーポイントを取得
   */
  get point(): Point {
    return new Point(this._point.getX(), this._point.getY());
  }

  /**
   * 入力ハンドルを取得
   */
  get handleIn(): Point {
    return new Point(this._handleIn.getX(), this._handleIn.getY());
  }

  /**
   * 出力ハンドルを取得
   */
  get handleOut(): Point {
    return new Point(this._handleOut.getX(), this._handleOut.getY());
  }

  /**
   * ハンドルを持っているかどうか
   */
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

  /**
   * Segmentを複製する（イミュータブル）
   */
  clone(): Segment {
    return new Segment(this.point, this.handleIn, this.handleOut);
  }

  /**
   * ハンドルを反転した新しいSegmentを返す
   */
  reversed(): Segment {
    return new Segment(this.point, this.handleOut, this.handleIn);
  }

  /**
   * toString
   */
  toString(): string {
    const parts = ['point: ' + this.point];
    if (!this._handleIn.isZero())
      parts.push('handleIn: ' + this.handleIn);
    if (!this._handleOut.isZero())
      parts.push('handleOut: ' + this.handleOut);
    return '{ ' + parts.join(', ') + ' }';
  }

  /**
   * 等価判定
   */
  equals(other: Segment): boolean {
    return other === this || (
      other instanceof Segment &&
      this.point.equals(other.point) &&
      this.handleIn.equals(other.handleIn) &&
      this.handleOut.equals(other.handleOut)
    );
  }

  /**
   * Segment を平行移動した新しいインスタンスを返す
   * @param offset 移動量（Point もしくは number）。number の場合は dx とみなす
   * @param dy offset が number の場合の y 方向移動量（省略時は 0）
   */
  translate(offset: Point | number, dy: number = 0): Segment {
    const delta = offset instanceof Point ? offset : new Point(offset, dy);
    return new Segment(
      this.point.add(delta),
      this.handleIn,
      this.handleOut
    );
  }

  /**
   * Segment を回転させた新しいインスタンスを返す
   * @param angle 角度（度数法）
   * @param center 回転中心（デフォルトは原点）
   */
  rotate(angle: number, center: Point = new Point(0, 0)): Segment {
    const newPoint = this.point.rotate(angle, center);
    // ハンドルは point からの相対ベクトルなので原点中心で回転
    const newHandleIn = this.handleIn.rotate(angle);
    const newHandleOut = this.handleOut.rotate(angle);
    return new Segment(newPoint, newHandleIn, newHandleOut);
  }

  /**
   * Segment をスケール変換した新しいインスタンスを返す
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
    const shifted = this.point.subtract(center).multiply(new Point(sx, syVal));
    const newPoint = shifted.add(center);

    // ハンドルは相対ベクトルなのでそのままスケール
    const newHandleIn = this.handleIn.multiply(new Point(sx, syVal));
    const newHandleOut = this.handleOut.multiply(new Point(sx, syVal));

    return new Segment(newPoint, newHandleIn, newHandleOut);
  }

  /**
   * 行列変換した新しいSegmentを返す
   * @param matrix 変換行列
   */
  transform(matrix: any): Segment {
    // 座標配列を作成
    const coords = new Array(6);
    this._transformCoordinates(matrix, coords, false);
    
    // 変換後の座標から新しいSegmentを作成
    const point = new Point(coords[0], coords[1]);
    const handleIn = new Point(coords[2] - coords[0], coords[3] - coords[1]);
    const handleOut = new Point(coords[4] - coords[0], coords[5] - coords[1]);
    
    return new Segment(point, handleIn, handleOut);
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
      matrix.transform(coords, coords, i / 2);
      
      if (!handleIn) {
        coords[2] = coords[0];
        coords[3] = coords[1];
      }
      if (!handleOut) {
        coords[4] = coords[0];
        coords[5] = coords[1];
      }
    }

    return coords;
  }

  /**
   * 2つのセグメント間を補間した新しいSegmentを返す
   * @param from 開始セグメント
   * @param to 終了セグメント
   * @param factor 補間係数（0〜1）
   */
  static interpolate(from: Segment, to: Segment, factor: number): Segment {
    const u = 1 - factor;
    const v = factor;
    const point1 = from.point;
    const point2 = to.point;
    const handleIn1 = from.handleIn;
    const handleIn2 = to.handleIn;
    const handleOut1 = from.handleOut;
    const handleOut2 = to.handleOut;

    const newPoint = new Point(
      u * point1.x + v * point2.x,
      u * point1.y + v * point2.y
    );
    const newHandleIn = new Point(
      u * handleIn1.x + v * handleIn2.x,
      u * handleIn1.y + v * handleIn2.y
    );
    const newHandleOut = new Point(
      u * handleOut1.x + v * handleOut2.x,
      u * handleOut1.y + v * handleOut2.y
    );

    return new Segment(newPoint, newHandleIn, newHandleOut);
  }

  /**
   * セグメントを滑らかにする
   * @param options スムージングオプション
   * @param _first 最初のセグメントフラグ（内部用）
   * @param _last 最後のセグメントフラグ（内部用）
   */
  smooth(options: any = {}, _first?: boolean, _last?: boolean): Segment {
    const type = options.type;
    const factor = options.factor;
    
    // 前後のセグメントが必要だが、Papyrus2Dではパスとの関連付けがないため
    // 外部から提供する必要がある。ここでは新しいSegmentを返す設計にする
    const prev = options.previous;
    const next = options.next;
    
    if (!prev || !next) {
      return this.clone(); // 前後のセグメントがなければ変更なし
    }

    // 計算用の点を取得
    const p0 = prev.point;
    const p1 = this.point;
    const p2 = next.point;
    const d1 = p0.getDistance(p1);
    const d2 = p1.getDistance(p2);

    let newHandleIn = this.handleIn;
    let newHandleOut = this.handleOut;

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
          newHandleIn = new Point(
            (d2_2a * p0.x + A * p1.x - d1_2a * p2.x) / N - p1.x,
            (d2_2a * p0.y + A * p1.y - d1_2a * p2.y) / N - p1.y
          );
        } else {
          newHandleIn = new Point(0, 0);
        }
      }

      if (!_last) {
        const A = 2 * d1_2a + 3 * d1_a * d2_a + d2_2a;
        const N = 3 * d1_a * (d1_a + d2_a);
        if (N !== 0) {
          newHandleOut = new Point(
            (d1_2a * p2.x + A * p1.x - d2_2a * p0.x) / N - p1.x,
            (d1_2a * p2.y + A * p1.y - d2_2a * p0.y) / N - p1.y
          );
        } else {
          newHandleOut = new Point(0, 0);
        }
      }
    } else if (type === 'geometric') {
      // 幾何学的スムージング
      const vector = p0.subtract(p2);
      const t = factor === undefined ? 0.4 : factor;
      const k = t * d1 / (d1 + d2);
      
      if (!_first) {
        newHandleIn = vector.multiply(k);
      }
      if (!_last) {
        newHandleOut = vector.multiply(k - t);
      }
    } else {
      throw new Error(`Smoothing method '${type}' not supported.`);
    }

    return new Segment(this.point, newHandleIn, newHandleOut);
  }

  /**
   * handleIn のみを変更した新しい Segment を返す
   * @param handleIn 新しい handleIn
   */
  withHandleIn(handleIn: Point): Segment {
    return new Segment(this.point, handleIn, this.handleOut);
  }

  /**
   * handleOut のみを変更した新しい Segment を返す
   * @param handleOut 新しい handleOut
   */
  withHandleOut(handleOut: Point): Segment {
    return new Segment(this.point, this.handleIn, handleOut);
  }

  /**
   * point のみを変更した新しい Segment を返す
   * @param point 新しい point
   */
  withPoint(point: Point): Segment {
    return new Segment(point, this.handleIn, this.handleOut);
  }
}