/**
 * An Algorithm for Automatically Fitting Digitized Curves
 * by Philip J. Schneider
 * from "Graphics Gems", Academic Press, 1990
 * Modifications and optimizations of original algorithm by Jürg Lehni.
 * 
 * TypeScript implementation for Papyrus2D based on paper.js PathFitter.js
 */

import { Point } from '../basic/Point';
import { Segment } from './Segment';
import { Path } from './Path';
import { Numerical } from '../util/Numerical';

/**
 * PathFitter クラス
 * パスを単純化するためのアルゴリズムを提供します。
 * @private
 */
export class PathFitter {
  private points: Point[];
  private closed: boolean;

  /**
   * PathFitterのコンストラクタ
   * @param path 単純化するパス
   */
  constructor(path: Path) {
    const points: Point[] = [];
    const segments: Segment[] = path.getSegments();
    const closed = path.isClosed();
    console.log(`🔥 segments = ${segments.length} closed=${closed}`);
    
    // パスからポイントをコピーし、隣接する重複を除外
    for (let i = 0, prev: Point | null = null, l = segments.length; i < l; i++) {
      const point = segments[i].point;
      if (!prev || !prev.equals(point)) {
        points.push(prev = point.clone());
      }
    }
    
    console.log(`🔥 points(before) = ${points.length}`);
    // 閉じたパスを単純化する場合、最初と最後のセグメントを複製する必要がある
    if (closed) {
      points.unshift(points[points.length - 1]);
      points.push(points[1]); // インデックス0にあったポイントは現在1にある
    }
    console.log(`🔥 points(seq) = ${JSON.stringify(points.map(p => ({x:p.x, y:p.y})))});`);
    console.log(`🔥 points(after) = ${points.length}`);
    
    this.points = points;
    this.closed = closed;
  }

  /**
   * 指定された誤差でパスを単純化
   * @param error 許容誤差
   * @returns 単純化されたセグメントの配列、または単純化できない場合はnull
   */
  fit(error: number): Segment[] | null {
    const points = this.points;
    const length = points.length;
      let segments: Segment[] | null = null;
    console.log(`🔥 ${length}`);
    
    if (length > 0) {
      // 同じ場所に複数のポイントがあるパスを1つのセグメントに減らすことをサポート
      segments = [new Segment(points[0])];
      
      if (length > 1) {
        this.fitCubic(
          segments,
          error,
          0,
          length - 1,
          // 左の接線
          points[1].subtract(points[0]),
          // 右の接線
          points[length - 2].subtract(points[length - 1])
        );
        
        // 閉じたパスの場合、複製されたセグメントを再び削除
        if (this.closed) {
          segments.shift();
          segments.pop();
        }
      }
    }
    
    return segments;
  }

  /**
   * ベジエ曲線をデジタル化されたポイントの（サブ）セットに適合させる
   * @param segments 結果のセグメント配列
   * @param error 許容誤差
   * @param first 開始インデックス
   * @param last 終了インデックス
   * @param tan1 開始点の接線
   * @param tan2 終了点の接線
   */
  private fitCubic(
    segments: Segment[],
    error: number,
    first: number,
    last: number,
    tan1: Point,
    tan2: Point
  ): void {
    const points = this.points;
    
    // 領域に2つのポイントしかない場合はヒューリスティックを使用
    if (last - first === 1) {
      const pt1 = points[first];
      const pt2 = points[last];
      const dist = pt1.getDistance(pt2) / 3;
      this.addCurve(segments, [
        pt1,
        pt1.add(tan1.normalize(dist)),
        pt2.add(tan2.normalize(dist)),
        pt2
      ]);
      return;
    }
    
    // ポイントをパラメータ化し、曲線の適合を試みる
    const uPrime = this.chordLengthParameterize(first, last);
    let maxError = Math.max(error, error * error);
    let split = 0;
    let parametersInOrder = true;
    
    // 4回の反復を試みる
    for (let i = 0; i <= 4; i++) {
      const curve = this.generateBezier(first, last, uPrime, tan1, tan2);
      // ポイントから適合曲線への最大偏差を見つける
      const max = this.findMaxError(first, last, curve, uPrime);
      
      if (max.error < error && parametersInOrder) {
        this.addCurve(segments, curve);
        return;
      }
      
      split = max.index;
      
      // エラーが大きすぎない場合は、再パラメータ化と反復を試みる
      if (max.error >= maxError) {
        break;
      }
      
      parametersInOrder = this.reparameterize(first, last, uPrime, curve);
      maxError = max.error;
    }
    
    // 適合に失敗 - 最大エラーポイントで分割し、再帰的に適合させる
    const tanCenter = points[split - 1].subtract(points[split + 1]);
    this.fitCubic(segments, error, first, split, tan1, tanCenter);
    this.fitCubic(segments, error, split, last, tanCenter.negate(), tan2);
  }

  /**
   * 曲線をセグメント配列に追加
   * @param segments セグメント配列
   * @param curve 追加する曲線の制御点
   */
  private addCurve(segments: Segment[], curve: Point[]): void {
    const prev = segments[segments.length - 1];
    prev.setHandleOut(curve[1].subtract(curve[0]));
    segments.push(new Segment(curve[3], curve[2].subtract(curve[3])));
  }

  /**
   * 領域のベジエ制御点を見つけるために最小二乗法を使用
   * @param first 開始インデックス
   * @param last 終了インデックス
   * @param uPrime パラメータ値の配列
   * @param tan1 開始点の接線
   * @param tan2 終了点の接線
   * @returns ベジエ曲線の制御点
   */
  private generateBezier(
    first: number,
    last: number,
    uPrime: number[],
    tan1: Point,
    tan2: Point
  ): Point[] {
    const epsilon = Numerical.EPSILON;
    const abs = Math.abs;
    const points = this.points;
    const pt1 = points[first];
    const pt2 = points[last];
    
    // C行列とX行列を作成
    const C = [[0, 0], [0, 0]];
    const X = [0, 0];

    for (let i = 0, l = last - first + 1; i < l; i++) {
      const u = uPrime[i];
      const t = 1 - u;
      const b = 3 * u * t;
      const b0 = t * t * t;
      const b1 = b * t;
      const b2 = b * u;
      const b3 = u * u * u;
      const a1 = tan1.normalize(b1);
      const a2 = tan2.normalize(b2);
      const tmp = points[first + i]
        .subtract(pt1.multiply(b0 + b1))
        .subtract(pt2.multiply(b2 + b3));
      
      C[0][0] += a1.dot(a1);
      C[0][1] += a1.dot(a2);
      // C[1][0] += a1.dot(a2);
      C[1][0] = C[0][1];
      C[1][1] += a2.dot(a2);
      X[0] += a1.dot(tmp);
      X[1] += a2.dot(tmp);
    }

    // C行列とXの行列式を計算
    const detC0C1 = C[0][0] * C[1][1] - C[1][0] * C[0][1];
    let alpha1: number;
    let alpha2: number;
    
    if (abs(detC0C1) > epsilon) {
      // クラメールの法則
      const detC0X = C[0][0] * X[1] - C[1][0] * X[0];
      const detXC1 = X[0] * C[1][1] - X[1] * C[0][1];
      // アルファ値を導出
      alpha1 = detXC1 / detC0C1;
      alpha2 = detC0X / detC0C1;
    } else {
      // 行列が不定 - alpha1 == alpha2と仮定
      const c0 = C[0][0] + C[0][1];
      const c1 = C[1][0] + C[1][1];
      alpha1 = alpha2 = abs(c0) > epsilon ? X[0] / c0
                      : abs(c1) > epsilon ? X[1] / c1
                      : 0;
    }

    // アルファが負の場合、Wu/Barskyのヒューリスティックを使用
    // (アルファが0の場合、後続のNewtonRaphsonRootFind()呼び出しでゼロ除算が発生)
    const segLength = pt2.getDistance(pt1);
    const eps = epsilon * segLength;
    let handle1: Point | null = null;
    let handle2: Point | null = null;
    
    if (alpha1 < eps || alpha2 < eps) {
      // 標準的な（おそらく不正確な）公式にフォールバック
      // 必要に応じてさらに細分化
      alpha1 = alpha2 = segLength / 3;
    } else {
      // 見つかった制御点が、pt1とpt2を通る線に投影されたときに
      // 正しい順序にあるかどうかを確認
      const line = pt2.subtract(pt1);
      // 制御点1と2は、それぞれ左右の接線上にアルファ距離に配置される
      handle1 = tan1.normalize(alpha1);
      handle2 = tan2.normalize(alpha2);
      
      if (handle1.dot(line) - handle2.dot(line) > segLength * segLength) {
        // 上記のWu/Barskyヒューリスティックにフォールバック
        alpha1 = alpha2 = segLength / 3;
        handle1 = handle2 = null; // 再計算を強制
      }
    }

    // ベジエ曲線の最初と最後の制御点は
    // 正確に最初と最後のデータポイントに配置される
    return [
      pt1,
      pt1.add(handle1 || tan1.normalize(alpha1)),
      pt2.add(handle2 || tan2.normalize(alpha2)),
      pt2
    ];
  }

  /**
   * ポイントのセットとそのパラメータ化が与えられた場合、より良いパラメータ化を見つける
   * @param first 開始インデックス
   * @param last 終了インデックス
   * @param u パラメータ値の配列
   * @param curve ベジエ曲線の制御点
   * @returns 新しいパラメータ化がポイントを並べ替えていない場合はtrue
   */
  private reparameterize(
    first: number,
    last: number,
    u: number[],
    curve: Point[]
  ): boolean {
    for (let i = first; i <= last; i++) {
      u[i - first] = this.findRoot(curve, this.points[i], u[i - first]);
    }
    
    // 新しいパラメータ化がポイントを並べ替えたかどうかを検出
    // その場合、パスのポイントを間違った順序で適合させることになる
    for (let i = 1, l = u.length; i < l; i++) {
      if (u[i] <= u[i - 1]) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * より良い根を見つけるためにニュートン・ラフソン反復法を使用
   * @param curve ベジエ曲線の制御点
   * @param point 適合させるポイント
   * @param u 初期パラメータ値
   * @returns 改善されたパラメータ値
   */
  private findRoot(curve: Point[], point: Point, u: number): number {
    const curve1: Point[] = [];
    const curve2: Point[] = [];
    
    // Q'の制御頂点を生成
    for (let i = 0; i <= 2; i++) {
      curve1[i] = curve[i + 1].subtract(curve[i]).multiply(3);
    }
    
    // Q''の制御頂点を生成
    for (let i = 0; i <= 1; i++) {
      curve2[i] = curve1[i + 1].subtract(curve1[i]).multiply(2);
    }
    
    // Q(u)、Q'(u)、Q''(u)を計算
    const pt = this.evaluate(3, curve, u);
    const pt1 = this.evaluate(2, curve1, u);
    const pt2 = this.evaluate(1, curve2, u);
    const diff = pt.subtract(point);
    const df = pt1.dot(pt1) + diff.dot(pt2);
    
    // u = u - f(u) / f'(u)
    return Numerical.isMachineZero(df) ? u : u - diff.dot(pt1) / df;
  }

  /**
   * 特定のパラメータ値でベジエ曲線を評価
   * @param degree 曲線の次数
   * @param curve 曲線の制御点
   * @param t パラメータ値
   * @returns 評価された点
   */
  private evaluate(degree: number, curve: Point[], t: number): Point {
    // 配列をコピー
    const tmp = curve.slice();
    // 三角計算
    for (let i = 1; i <= degree; i++) {
      for (let j = 0; j <= degree - i; j++) {
        tmp[j] = tmp[j].multiply(1 - t).add(tmp[j + 1].multiply(t));
      }
    }
    return tmp[0];
  }

  /**
   * ポイント間の相対距離を使用してパラメータ値をデジタル化されたポイントに割り当て
   * @param first 開始インデックス
   * @param last 終了インデックス
   * @returns パラメータ値の配列
   */
  private chordLengthParameterize(first: number, last: number): number[] {
    const u: number[] = [0];
    
    for (let i = first + 1; i <= last; i++) {
      u[i - first] = u[i - first - 1] + this.points[i].getDistance(this.points[i - 1]);
    }
    
    for (let i = 1, m = last - first; i <= m; i++) {
      u[i] /= u[m];
    }
    
    return u;
  }

  /**
   * デジタル化されたポイントから適合曲線への最大二乗距離を見つける
   * @param first 開始インデックス
   * @param last 終了インデックス
   * @param curve ベジエ曲線の制御点
   * @param u パラメータ値の配列
   * @returns 最大エラーとそのインデックス
   */
  private findMaxError(
    first: number,
    last: number,
    curve: Point[],
    u: number[]
  ): { error: number; index: number } {
    let index = Math.floor((last - first + 1) / 2);
    let maxDist = 0;
    
    for (let i = first + 1; i < last; i++) {
      const P = this.evaluate(3, curve, u[i - first]);
      const v = P.subtract(this.points[i]);
      const dist = v.x * v.x + v.y * v.y; // 二乗
      
      if (dist >= maxDist) {
        maxDist = dist;
        index = i;
      }
    }
    
    return {
      error: maxDist,
      index: index
    };
  }
}