import { Curve } from './Curve';
import { Point } from '../basic/Point';
import { Numerical } from '../util/Numerical';

export class CurveLocation {
  // 基本情報
  curve1Index: number = -1;  // 曲線1のインデックス
  curve2Index: number = -1;  // 曲線2のインデックス
  curve: Curve | null;       // 曲線オブジェクト（paper.js互換）
  curve1: Curve | null;      // 曲線1オブジェクト（Papyrus2D拡張）
  curve2: Curve | null;      // 曲線2オブジェクト（Papyrus2D拡張）
  time: number | null;       // 曲線上のパラメータ（paper.js互換）
  t1: number | null;         // 曲線1上のパラメータ（Papyrus2D拡張）
  t2: number | null;         // 曲線2上のパラメータ（Papyrus2D拡張）
  point: Point;              // 交点の座標
  
  // 追加情報（重複判定・端点マージ用）
  overlap: boolean;          // 重複フラグ
  distance?: number;         // 距離（近接判定用）
  tangent?: boolean;         // 接線共有フラグ
  onPath?: boolean;          // パス上フラグ
  
  // Paper.jsと同様のプロパティ（交点の相互参照用）
  _intersection?: CurveLocation; // 対応する交点
  _next?: CurveLocation;         // 連結リスト用
  _previous?: CurveLocation;     // 連結リスト用

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
    
    this.curve = curve;
    this.curve1 = curve;  // 互換性のため
    this.curve2 = null;   // 互換性のため
    this.time = time;
    this.t1 = time;       // 互換性のため
    this.t2 = null;       // 互換性のため
    
    // paper.jsと同様に、pointがnullの場合は自動的に計算
    if (point) {
      this.point = point;
    } else if (time !== null && curve) {
      this.point = curve.getPointAtTime(time); // getPointAt -> getPointAtTime
    } else {
      this.point = new Point(0, 0);
    }
    
    this.overlap = overlap;
    if (distance !== undefined) {
      this.distance = distance;
    }
  }

  /**
   * 曲線の始点からこの位置までの長さを取得
   * @returns 曲線の長さ
   */
  getCurveOffset(): number {
    if (this.time === null || !this.curve) return 0;
    return this.curve.getLength() * this.time;
  }

  /**
   * パスの始点からこの位置までの長さを取得
   * @returns パスの長さ
   */
  getOffset(): number {
    let offset = this.getCurveOffset();
    const path = this.getPath();
    if (path && this.curve) {
      const index = path.getCurves().indexOf(this.curve);
      if (index > 0) {
        const curves = path.getCurves();
        for (let i = 0; i < index; i++) {
          offset += curves[i].getLength();
        }
      }
    }
    return offset;
  }

  /**
   * この位置が属するパスを取得
   * @returns パス
   */
  getPath(): any {
    return this.curve ? (this.curve as any)._path : null;
  }
}