/**
 * Paper.jsのCurveLocationクラスを移植したもの
 * 曲線上の位置を表すクラス
 */
import { Curve } from './Curve';
import { Point } from '../basic/Point';
import { Numerical } from '../util/Numerical';

export class CurveLocation {
  // Paper.jsと同様のプロパティ
  _curve: Curve | null;      // 曲線オブジェクト
  _time: number | null;      // 曲線上のパラメータ
  _point: Point;             // 交点の座標
  _overlap: boolean;         // 重複フラグ
  _distance?: number;        // 距離（近接判定用）
  
  // キャッシュ用プロパティ
  _offset?: number;          // パス上のオフセット（キャッシュ）
  _curveOffset?: number;     // 曲線上のオフセット（キャッシュ）
  _version?: number;         // パスのバージョン（キャッシュ検証用）
  _path?: any;               // パス参照（キャッシュ用）
  
  // セグメント参照用プロパティ
  _segment?: any;            // 近接セグメント
  _segment1?: any;           // 曲線の最初のセグメント
  _segment2?: any;           // 曲線の2番目のセグメント
  
  // 交点の相互参照用
  _intersection: CurveLocation | null = null; // 対応する交点
  _next: CurveLocation | null = null;         // 連結リスト用
  _previous: CurveLocation | null = null;     // 連結リスト用
  
  // getterプロパティは使用せず、直接プロパティにアクセス

  /**
   * Paper.js互換のコンストラクタ
   * @param curve 曲線
   * @param time 曲線上のパラメータ
   * @param point 交点の座標（nullの場合は自動計算）
   * @param overlap 重複フラグ
   * @param distance 距離
   */
  constructor(
    curve: Curve | null,
    time: number | null,
    point?: Point | null,
    overlap: boolean = false,
    distance?: number
  ) {
    // Paper.jsと同様に、端点の場合は次の曲線にマージする処理を追加
    if (time !== null && time >= (1 - Numerical.CURVETIME_EPSILON) && curve) {
      const next = curve.getNext();
      if (next) {
        time = 0;
        curve = next;
      }
    }
    
    this._setCurve(curve);
    this._time = time;
    
    // paper.jsと同様に、pointがnullの場合は自動的に計算
    if (point) {
      this._point = point;
    } else if (time !== null && curve) {
      this._point = curve.getPointAtTime(time);
    } else {
      this._point = new Point(0, 0);
    }
    
    this._overlap = overlap;
    if (distance !== undefined) {
      this._distance = distance;
    }
    
    // 交点の相互参照用プロパティを初期化
    this._intersection = null;
    this._next = null;
    this._previous = null;
  }

  /**
   * この位置が属する曲線を取得
   */
  getCurve(): Curve | null {
    const path = this._path;
    const that = this;
    if (path && path._version !== this._version) {
      // パスのバージョンが変わった場合はキャッシュをクリア
      this._time = null;
      this._offset = undefined;
      this._curveOffset = undefined;
      this._curve = null;
    }

    // セグメントから曲線を取得して時間を計算する関数
    function trySegment(segment: any) {
      const curve = segment && segment.getCurve();
      if (curve && (that._time = curve.getTimeOf(that._point)) != null) {
        // 曲線が見つかった場合は設定して返す
        that._setCurve(curve);
        return curve;
      }
      return null;
    }

    return this._curve
      || trySegment(this._segment)
      || trySegment(this._segment1)
      || trySegment(this._segment2 && this._segment2.getPrevious());
  }

  /**
   * 曲線を設定する内部メソッド
   */
  _setCurve(curve: Curve | null): void {
    if (curve) {
      this._setPath(curve._path);
      this._curve = curve;
      this._segment = null;
      this._segment1 = curve._segment1;
      this._segment2 = curve._segment2;
    } else {
      this._setPath(null);
      this._curve = null;
      this._segment = null;
      this._segment1 = null;
      this._segment2 = null;
    }
  }

  /**
   * パスを設定する内部メソッド
   */
  _setPath(path: any): void {
    this._path = path;
    this._version = path ? path._version : 0;
  }

  /**
   * 曲線上の時間パラメータを取得
   */
  getTime(): number | null {
    const curve = this.getCurve();
    const time = this._time;
    return curve && time == null
      ? this._time = curve.getTimeOf(this._point)
      : time;
  }

  /**
   * 曲線の始点からこの位置までの長さを取得
   * @returns 曲線の長さ
   */
  getCurveOffset(): number {
    let offset = this._curveOffset;
    if (offset == null) {
      const curve = this.getCurve();
      const time = this.getTime();
      if (time != null && curve) {
        this._curveOffset = offset = curve.getPartLength(0, time);
      } else {
        offset = 0;
      }
    }
    return offset || 0;
  }

  /**
   * パスの始点からこの位置までの長さを取得
   * @returns パスの長さ
   */
  getOffset(): number {
    let offset = this._offset;
    if (offset == null) {
      offset = 0;
      const path = this.getPath();
      const index = this.getIndex();
      if (path && index != null) {
        const curves = path.getCurves();
        for (let i = 0; i < index; i++)
          offset += curves[i].getLength();
      }
      this._offset = offset += this.getCurveOffset();
    }
    return offset;
  }

  /**
   * この位置が属するパスを取得
   * @returns パス
   */
  getPath(): any {
    const curve = this.getCurve();
    return curve && curve._path;
  }
  
  /**
   * この位置が属する曲線のインデックスを取得
   * @returns 曲線のインデックス
   */
  getIndex(): number {
    const curve = this.getCurve();
    return curve ? curve.getIndex() : -1;
  }
}