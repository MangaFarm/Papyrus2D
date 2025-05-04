/**
 * PathFlattener クラス
 * Paper.js の PathFlattener (src/path/PathFlattener.js) を参考にした実装。
 * パスを直線セグメントの集合に変換するためのユーティリティクラス。
 */

import { Point } from '../basic/Point';
import { Matrix } from '../basic/Matrix';
import { Path } from './Path';
import { Segment } from './Segment';
import { Curve } from './Curve';
import { CurveGeometry } from './CurveGeometry';
import { CurveSubdivision } from './CurveSubdivision';
import { CurveCalculation } from './CurveCalculation';

/**
 * パスの一部を表す内部インターフェース
 */
interface PathPart {
  offset: number;  // パスの始点からの距離
  curve: number[]; // 曲線の値
  index: number;   // 曲線のインデックス
  time: number;    // 曲線上のパラメータ位置
}

/**
 * パスを直線セグメントの集合に変換するためのクラス
 */
export class PathFlattener {
  curves: number[][] = [];
  parts: PathPart[] = [];
  length: number = 0;
  index: number = 0;

  /**
   * PathFlattenerを作成
   * @param path 平坦化するパス
   * @param flatness 許容される最大誤差
   * @param maxRecursion 最大再帰回数
   * @param ignoreStraight 直線を無視するかどうか
   * @param matrix 変換行列
   */
  constructor(
    path: Path,
    flatness: number = 0.25,
    maxRecursion: number = 32,
    ignoreStraight: boolean = false,
    matrix?: Matrix
  ) {
    // 最小スパン（最大再帰回数から計算）
    const minSpan = 1 / (maxRecursion || 32);
    const segments = path.getSegments();
    let segment1 = segments[0];
    let segment2: Segment | undefined;

    /**
     * 曲線を追加する内部関数
     */
    const addCurve = (segment1: Segment, segment2: Segment) => {
      const curve = Curve.getValues(segment1, segment2, matrix);
      this.curves.push(curve);
      computeParts(curve, segment1._index, 0, 1);
    };

    /**
     * 曲線の部分を計算する内部関数
     */
    const computeParts = (curve: number[], index: number, t1: number, t2: number) => {
      // t-スパンが十分に大きいか、直線でない場合は分割
      if (
        (t2 - t1) > minSpan &&
        !(ignoreStraight && CurveGeometry.isStraight(curve)) &&
        !Curve.isFlatEnough(curve, flatness || 0.25)
      ) {
        // 曲線を分割
        const halves = CurveSubdivision.subdivide(curve, 0.5);
        const tMid = (t1 + t2) / 2;
        // 再帰的に部分を計算
        computeParts(halves[0], index, t1, tMid);
        computeParts(halves[1], index, tMid, t2);
      } else {
        // 曲線を直線として解釈し、長さを計算
        const dx = curve[6] - curve[0];
        const dy = curve[7] - curve[1];
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          this.length += dist;
          this.parts.push({
            offset: this.length,
            curve: curve,
            index: index,
            time: t2,
          });
        }
      }
    };

    // すべての曲線を処理
    for (let i = 1, l = segments.length; i < l; i++) {
      segment2 = segments[i];
      addCurve(segment1, segment2);
      segment1 = segment2;
    }

    // 閉じたパスの場合、最後のセグメントから最初のセグメントへの曲線を追加
    if (path.isClosed()) {
      addCurve(segment2 || segment1, segments[0]);
    }
  }

  /**
   * 指定されたオフセット位置のパラメータを取得
   * @param offset オフセット位置
   * @returns パラメータ情報
   */
  _get(offset: number): { index: number; time: number } {
    const parts = this.parts;
    const length = parts.length;
    let start: number;
    let i: number;
    let j = this.index;

    // 開始位置を検索
    for (;;) {
      i = j;
      if (!j || parts[--j].offset < offset) {
        break;
      }
    }

    // オフセットを含む部分を検索
    for (; i < length; i++) {
      const part = parts[i];
      if (part.offset >= offset) {
        // 正しい部分を見つけた、現在の位置を記憶
        this.index = i;
        // 前の部分を取得して線形補間
        const prev = parts[i - 1];
        const prevTime = prev && prev.index === part.index ? prev.time : 0;
        const prevOffset = prev ? prev.offset : 0;
        return {
          index: part.index,
          // 補間
          time: prevTime + (part.time - prevTime) * (offset - prevOffset) / (part.offset - prevOffset)
        };
      }
    }

    // 最後の部分を返す
    return {
      index: parts[length - 1].index,
      time: 1
    };
  }

  /**
   * 指定された範囲の部分を描画
   * @param ctx キャンバスコンテキスト
   * @param from 開始オフセット
   * @param to 終了オフセット
   */
  drawPart(ctx: CanvasRenderingContext2D, from: number, to: number): void {
    const start = this._get(from);
    const end = this._get(to);
    for (let i = start.index, l = end.index; i <= l; i++) {
      const curve = CurveSubdivision.getPart(this.curves[i],
        i === start.index ? start.time : 0,
        i === end.index ? end.time : 1);
      if (i === start.index) {
        ctx.moveTo(curve[0], curve[1]);
      }
      ctx.bezierCurveTo(curve[2], curve[3], curve[4], curve[5], curve[6], curve[7]);
    }
  }

  /**
   * 指定されたオフセット位置の点を取得
   * @param offset オフセット位置
   * @returns 点
   */
  getPointAt(offset: number): Point {
    const param = this._get(offset);
    return CurveCalculation.getPoint(this.curves[param.index], param.time) as Point;
  }

  /**
   * 指定されたオフセット位置の接線を取得
   * @param offset オフセット位置
   * @returns 接線ベクトル
   */
  getTangentAt(offset: number): Point {
    const param = this._get(offset);
    return CurveCalculation.getTangent(this.curves[param.index], param.time) as Point;
  }

  /**
   * 指定されたオフセット位置の法線を取得
   * @param offset オフセット位置
   * @returns 法線ベクトル
   */
  getNormalAt(offset: number): Point {
    const param = this._get(offset);
    return CurveCalculation.getNormal(this.curves[param.index], param.time) as Point;
  }

  /**
   * 指定されたオフセット位置の曲率を取得
   * @param offset オフセット位置
   * @returns 曲率
   */
  getCurvatureAt(offset: number): number {
    const param = this._get(offset);
    return CurveCalculation.getCurvature(this.curves[param.index], param.time);
  }

}