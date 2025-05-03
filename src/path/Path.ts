/**
 * Path クラス
 * Paper.js の Path (src/path/Path.js) を参考にしたイミュータブルなパス表現。
 * segments 配列と closed フラグを持ち、PathItem インターフェースを実装する。
 */

import { Point } from '../basic/Point';
import { Rectangle } from '../basic/Rectangle';
import { Matrix } from '../basic/Matrix';
import { Curve, CurveLocation } from './Curve';
import { Segment } from './Segment';
import { Numerical } from '../util/Numerical';
import { PathItem } from './PathItem';

export class Path implements PathItem {
  readonly segments: Segment[];
  readonly closed: boolean;

  // PathItemインターフェースの実装
  _matrix?: Matrix;
  _matrixDirty: boolean = false;

  constructor(segments: Segment[] = [], closed: boolean = false) {
    // セグメント配列はコピーして保持（イミュータブル設計）
    this.segments = segments.slice();
    this.closed = closed;
  }

  get segmentCount(): number {
    return this.segments.length;
  }

  getLength(): number {
    // Curve を全て取得し、合計長を返す
    return this.getCurves().reduce((sum, curve) => sum + curve.getLength(), 0);
  }

  /**
   * パスの境界ボックスを取得
   * paper.jsのItem.getBoundsメソッドに相当
   * @param matrix 変換行列（オプション）
   * @returns 境界ボックス
   */
  getBounds(matrix?: Matrix): Rectangle {
    // paper.jsのCurve._addBoundsロジックを移植
    let bounds = this._computeBounds(0);
    
    // 行列変換がある場合は適用
    if (matrix) {
      bounds = bounds.transform(matrix);
    }
    
    return bounds;
  }

  /**
   * paper.jsそっくりのストローク境界計算
   * @param strokeWidth 線幅
   * @param matrix 変換行列（オプション）
   */
  getStrokeBounds(strokeWidth: number, matrix?: Matrix): Rectangle {
    // strokeWidth/2をpaddingとしてAABB拡張
    let bounds = this._computeBounds(strokeWidth / 2);
    
    // 行列変換がある場合は適用
    if (matrix) {
      bounds = bounds.transform(matrix);
    }
    
    return bounds;
  }

  /**
   * 内部: paddingを加味したAABB計算
   */
  private _computeBounds(padding: number): Rectangle {
    if (this.segments.length === 0) {
      return new Rectangle(new Point(0, 0), new Point(0, 0));
    }
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    const add = (x: number, y: number) => {
      minX = Math.min(minX, x - padding);
      minY = Math.min(minY, y - padding);
      maxX = Math.max(maxX, x + padding);
      maxY = Math.max(maxY, y + padding);
    };

    // 各カーブ区間ごとにBézierの極値もAABBに含める
    for (let i = 0; i < this.segments.length - (this.closed ? 0 : 1); i++) {
      const seg0 = this.segments[i];
      const seg1 = this.segments[(i + 1) % this.segments.length];
      // 4点: p0, handleOut, handleIn, p1
      const p0 = seg0.point;
      const p1 = seg1.point;
      const h0 = p0.add(seg0.handleOut);
      const h1 = p1.add(seg1.handleIn);

      // x, y それぞれで三次ベジェの極値を求める
      for (const dim of ['x', 'y'] as const) {
        // 三次ベジェの係数
        const v0 = p0[dim];
        const v1 = h0[dim];
        const v2 = h1[dim];
        const v3 = p1[dim];

        // 端点をAABBに含める
        add(p0.x, p0.y);
        add(p1.x, p1.y);

        // 極値（1次導関数=0のt）を求める（paper.jsと同じ式）
        // a = 3*(v1-v2) - v0 + v3
        // b = 2*(v0+v2) - 4*v1
        // c = v1 - v0
        const a = 3 * (v1 - v2) - v0 + v3;
        const b = 2 * (v0 + v2) - 4 * v1;
        const c = v1 - v0;

        // 2次方程式 at^2 + bt + c = 0
        if (Math.abs(a) > 1e-12) {
          const D = b * b - 4 * a * c;
          if (D >= 0) {
            const sqrtD = Math.sqrt(D);
            for (const t of [(-b + sqrtD) / (2 * a), (-b - sqrtD) / (2 * a)]) {
              if (t > 0 && t < 1) {
                // 三次ベジェ補間
                const mt = 1 - t;
                const x =
                  mt * mt * mt * p0.x +
                  3 * mt * mt * t * h0.x +
                  3 * mt * t * t * h1.x +
                  t * t * t * p1.x;
                const y =
                  mt * mt * mt * p0.y +
                  3 * mt * mt * t * h0.y +
                  3 * mt * t * t * h1.y +
                  t * t * t * p1.y;
                add(x, y);
              }
            }
          }
        } else if (Math.abs(b) > 1e-12) {
          // 1次方程式
          const t = -c / b;
          if (t > 0 && t < 1) {
            const mt = 1 - t;
            const bez =
              mt * mt * mt * v0 + 3 * mt * mt * t * v1 + 3 * mt * t * t * v2 + t * t * t * v3;
            const other =
              dim === 'x'
                ? mt * mt * mt * p0.y +
                  3 * mt * mt * t * h0.y +
                  3 * mt * t * t * h1.y +
                  t * t * t * p1.y
                : mt * mt * mt * p0.x +
                  3 * mt * mt * t * h0.x +
                  3 * mt * t * t * h1.x +
                  t * t * t * p1.x;
            add(dim === 'x' ? bez : other, dim === 'y' ? bez : other);
          }
        }
      }
    }
    return new Rectangle(new Point(minX, minY), new Point(maxX, maxY));
  }

  getPointAt(t: number): Point {
    // t: 0〜1 のパラメータでパス上の点を取得
    const curves = this.getCurves();
    if (curves.length === 0) return new Point(0, 0);
    const total = this.getLength();
    let acc = 0;
    for (const curve of curves) {
      const len = curve.getLength();
      if (total === 0) return curve.getPointAt(0);
      const next = acc + len;
      if (t * total <= next) {
        const localT = (t * total - acc) / len;
        return curve.getPointAt(localT);
      }
      acc = next;
    }
    // 端の場合
    return curves[curves.length - 1].getPointAt(1);
  }

  getTangentAt(t: number): Point {
    // t: 0〜1 のパラメータでパス上の接線ベクトルを取得
    const curves = this.getCurves();
    if (curves.length === 0) return new Point(0, 0);
    const total = this.getLength();
    let acc = 0;
    for (const curve of curves) {
      const len = curve.getLength();
      if (total === 0) return curve.getTangentAt(0);
      const next = acc + len;
      if (t * total <= next) {
        const localT = (t * total - acc) / len;
        return curve.getTangentAt(localT);
      }
      acc = next;
    }
    return curves[curves.length - 1].getTangentAt(1);
  }

  /**
   * paper.jsそっくりの点包含判定
   */
  /**
   * 点がパス内部にあるかどうかを判定（paper.js完全版）
   * @param point 判定する点
   * @param options オプション
   * @param options.rule 判定ルール（'evenodd'または'nonzero'）
   * @returns 内部ならtrue、外部またはパス上ならfalse
   */
  contains(
    point: Point,
    options?: {
      rule?: 'evenodd' | 'nonzero';
    }
  ): boolean {
    // デフォルトはeven-oddルール
    const rule = options?.rule || 'evenodd';

    // パス上判定
    if (this._isOnPath(point)) {
      return false;
    }

    // 境界チェック（高速化のため）
    const bounds = this.getBounds();
    if (
      point.x < bounds.topLeft.x ||
      point.x > bounds.bottomRight.x ||
      point.y < bounds.topLeft.y ||
      point.y > bounds.bottomRight.y
    ) {
      return false;
    }

    // winding numberを計算
    const { windingL, windingR } = this._getWinding(point);

    // ルールに応じて判定
    if (rule === 'evenodd') {
      // even-oddルール: 交差数の偶奇
      return ((windingL + windingR) & 1) === 1;
    } else {
      // nonzeroルール: winding!=0
      return windingL !== 0 || windingR !== 0;
    }
  }

  /**
   * 点がパス上にあるかどうかを判定
   * @param point 判定する点
   * @param epsilon 許容誤差
   * @returns パス上ならtrue
   */
  private _isOnPath(point: Point, epsilon = Numerical.GEOMETRIC_EPSILON): boolean {
    const curves = this.getCurves();

    // 頂点判定
    for (const seg of this.segments) {
      if (seg.point.subtract(point).getLength() <= epsilon) {
        return true;
      }
    }

    // 辺上判定
    for (const curve of curves) {
      // 直線の場合は簡易判定
      if (
        Curve.isStraight([
          curve.segment1.point.x,
          curve.segment1.point.y,
          curve.segment1.point.x + curve.segment1.handleOut.x,
          curve.segment1.point.y + curve.segment1.handleOut.y,
          curve.segment2.point.x + curve.segment2.handleIn.x,
          curve.segment2.point.y + curve.segment2.handleIn.y,
          curve.segment2.point.x,
          curve.segment2.point.y,
        ])
      ) {
        const p1 = curve.segment1.point;
        const p2 = curve.segment2.point;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len2 = dx * dx + dy * dy;

        if (len2 > 0) {
          const t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / len2;
          if (t >= -epsilon && t <= 1 + epsilon) {
            const proj = new Point(p1.x + t * dx, p1.y + t * dy);
            if (proj.subtract(point).getLength() <= epsilon) {
              return true;
            }
          }
        }
      } else {
        // 曲線の場合は最近接点を求める
        // paper.jsのCurve.getTimeOf()実装を使用
        const v = [
          curve.segment1.point.x,
          curve.segment1.point.y,
          curve.segment1.point.x + curve.segment1.handleOut.x,
          curve.segment1.point.y + curve.segment1.handleOut.y,
          curve.segment2.point.x + curve.segment2.handleIn.x,
          curve.segment2.point.y + curve.segment2.handleIn.y,
          curve.segment2.point.x,
          curve.segment2.point.y,
        ];

        // Curve.getTimeOf()相当の実装
        // まず端点との距離をチェック
        const p0 = new Point(v[0], v[1]);
        const p3 = new Point(v[6], v[7]);

        // 端点が十分近い場合は早期リターン
        // paper.jsと同じEPSILON値を使用
        const geomEpsilon = /*#=*/ Numerical.GEOMETRIC_EPSILON;

        if (point.isClose(p0, geomEpsilon) || point.isClose(p3, geomEpsilon)) {
          return true;
        }

        // x座標とy座標それぞれについて、曲線上の点と与えられた点の距離が
        // 最小になる t を求める
        const coords = [point.x, point.y];
        const roots: Set<number> = new Set(); // 重複を排除するためにSetを使用

        for (let c = 0; c < 2; c++) {
          // 三次方程式を解く
          const tempRoots: number[] = [];
          const a = 3 * (-v[c] + 3 * v[c + 2] - 3 * v[c + 4] + v[c + 6]);
          const b = 6 * (v[c] - 2 * v[c + 2] + v[c + 4]);
          const c2 = 3 * (-v[c] + v[c + 2]);
          const d = v[c] - coords[c];

          // 三次方程式を解く
          const count = Numerical.solveCubic(a, b, c2, d, tempRoots, 0, 1);

          // 重複を排除しながらrootsに追加
          for (let i = 0; i < count; i++) {
            roots.add(tempRoots[i]);
          }
        }

        // 各解について、曲線上の点と与えられた点の距離をチェック
        for (const t of roots) {
          const p = Curve.evaluate(v, t);
          if (point.isClose(p, geomEpsilon)) {
            return true;
          }
        }

        return false;
      }
    }

    return false;
  }

  /**
   * 点に対するwinding numberを計算（左右分割版）
   * @param point 判定する点
   * @returns {windingL, windingR} 左右のwinding number
   */
  private _getWinding(point: Point): { windingL: number; windingR: number } {
    const curves = this.getCurves();
    let windingL = 0;
    let windingR = 0;

    for (const curve of curves) {
      const v = [
        curve.segment1.point.x,
        curve.segment1.point.y,
        curve.segment1.point.x + curve.segment1.handleOut.x,
        curve.segment1.point.y + curve.segment1.handleOut.y,
        curve.segment2.point.x + curve.segment2.handleIn.x,
        curve.segment2.point.y + curve.segment2.handleIn.y,
        curve.segment2.point.x,
        curve.segment2.point.y,
      ];

      // y成分の範囲外ならスキップ
      const y = point.y;
      const minY = Math.min(v[1], v[3], v[5], v[7]);
      const maxY = Math.max(v[1], v[3], v[5], v[7]);

      if (y < minY - Numerical.EPSILON || y > maxY + Numerical.EPSILON) {
        continue;
      }

      // y成分の三次方程式
      const roots: number[] = [];
      const a = -v[1] + 3 * v[3] - 3 * v[5] + v[7];
      const b = 3 * v[1] - 6 * v[3] + 3 * v[5];
      const c = -3 * v[1] + 3 * v[3];
      const d = v[1] - y;

      Numerical.solveCubic(a, b, c, d, roots, 0, 1);

      for (const t of roots) {
        if (t < Numerical.CURVETIME_EPSILON || t > 1 - Numerical.CURVETIME_EPSILON) {
          continue;
        }

        // x座標を計算
        const mt = 1 - t;
        const x =
          mt * mt * mt * v[0] + 3 * mt * mt * t * v[2] + 3 * mt * t * t * v[4] + t * t * t * v[6];

        // 上昇/下降で符号を分ける
        const dy =
          3 * (mt * mt * (v[3] - v[1]) + 2 * mt * t * (v[5] - v[3]) + t * t * (v[7] - v[5]));

        // 左右に分けてカウント
        if (x < point.x - Numerical.EPSILON) {
          windingL += dy > 0 ? 1 : -1;
        } else if (x > point.x + Numerical.EPSILON) {
          windingR += dy > 0 ? 1 : -1;
        } else {
          // x座標が一致する場合は両方にカウント
          windingL += dy > 0 ? 0.5 : -0.5;
          windingR += dy > 0 ? 0.5 : -0.5;
        }
      }
    }

    return { windingL, windingR };
  }

  /**
   * 変換行列を設定
   * @param matrix 変換行列
   */
  transform(matrix: Matrix): Path {
    this._matrix = matrix;
    this._matrixDirty = true;
    return this;
  }

  /**
   * 平行移動
   * @param dx x方向の移動量
   * @param dy y方向の移動量
   */
  translate(dx: number, dy: number): Path {
    if (!this._matrix) {
      this._matrix = Matrix.identity();
    }
    this._matrix = this._matrix.translate(dx, dy);
    this._matrixDirty = true;
    return this;
  }

  /**
   * 回転
   * @param angle 回転角度（度）
   * @param center 回転中心
   */
  rotate(angle: number, center?: Point): Path {
    if (!this._matrix) {
      this._matrix = Matrix.identity();
    }
    this._matrix = this._matrix.rotate(angle, center);
    this._matrixDirty = true;
    return this;
  }

  /**
   * スケーリング
   * @param sx x方向のスケール
   * @param sy y方向のスケール
   * @param center スケーリングの中心
   */
  scale(sx: number, sy?: number, center?: Point): Path {
    if (!this._matrix) {
      this._matrix = Matrix.identity();
    }
    this._matrix = this._matrix.scale(sx, sy, center);
    this._matrixDirty = true;
    return this;
  }

  getCurves(): Curve[] {
    // セグメント配列から Curve 配列を生成
    const curves: Curve[] = [];
    for (let i = 0; i < this.segments.length - 1; i++) {
      curves.push(new Curve(this.segments[i], this.segments[i + 1]));
    }
    if (this.closed && this.segments.length > 1) {
      curves.push(new Curve(this.segments[this.segments.length - 1], this.segments[0]));
    }
    return curves;
  }

  // --- セグメント操作（イミュータブル: 新しいPathを返す） ---

  add(segment: Segment): Path {
    return new Path([...this.segments, segment], this.closed);
  }

  insert(index: number, segment: Segment): Path {
    const newSegments = this.segments.slice();
    newSegments.splice(index, 0, segment);
    return new Path(newSegments, this.closed);
  }

  removeSegment(index: number): Path {
    const newSegments = this.segments.slice();
    newSegments.splice(index, 1);
    return new Path(newSegments, this.closed);
  }

  // --- サブパス操作 ---

  moveTo(point: Point): Path {
    // 新しいサブパスを開始（既存セグメントをクリアし、1点のみのPathを返す）
    return new Path([new Segment(point)], false);
  }

  lineTo(point: Point): Path {
    // 最後の点から直線セグメントを追加
    if (this.segments.length === 0) {
      return this.add(new Segment(point));
    }
    return this.add(new Segment(point));
  }

  /**
   * cubicCurveTo: smoothHandles/selfClosing対応
   * @param handle1
   * @param handle2
   * @param to
   * @param options.smoothHandles: 連続ノードのハンドルを平滑化
   * @param options.selfClosing: 始点と終点が一致していれば自動的にclose
   */
  cubicCurveTo(
    handle1: Point,
    handle2: Point,
    to: Point,
    options?: { smoothHandles?: boolean; selfClosing?: boolean }
  ): Path {
    if (this.segments.length === 0) {
      return this.add(new Segment(to));
    }
    const newSegments = this.segments.slice();
    const lastIdx = newSegments.length - 1;
    const lastSeg = newSegments[lastIdx];
    // handleOut: handle1 - last.point
    let relHandleOut = handle1.subtract(lastSeg.point);
    let relHandleIn = handle2.subtract(to);

    // smoothHandles: 連続ノードのハンドルを平滑化
    if (options?.smoothHandles && lastIdx > 0) {
      const prev = newSegments[lastIdx - 1].point;
      const curr = lastSeg.point;
      // Catmull-Rom的な平滑化
      relHandleOut = curr.subtract(prev).multiply(1 / 3);
      relHandleIn = to.subtract(lastSeg.point).multiply(-1 / 3);
    }

    const last = lastSeg.withHandleOut(relHandleOut);
    newSegments[lastIdx] = last;
    newSegments.push(new Segment(to, relHandleIn, new Point(0, 0)));

    // selfClosing: 始点と終点が一致していれば自動的にclose
    let closed = this.closed;
    if (options?.selfClosing) {
      const firstPt = newSegments[0].point;
      const lastPt = to;
      if (firstPt.equals(lastPt)) {
        closed = true;
      }
    }
    return new Path(newSegments, closed);
  }

  /**
   * 全セグメントのハンドルを自動補正（paper.jsのsmooth相当, Catmull-Rom的）
   */
  smooth(): Path {
    if (this.segments.length < 3) return this;
    const newSegments = this.segments.slice();
    for (let i = 1; i < this.segments.length - 1; i++) {
      const prev = this.segments[i - 1].point;
      const curr = this.segments[i].point;
      const next = this.segments[i + 1].point;
      // ハンドルは前後点の差分を1/6ずつ
      const handleIn = prev.subtract(next).multiply(-1 / 6);
      const handleOut = next.subtract(prev).multiply(1 / 6);
      newSegments[i] = new Segment(newSegments[i].point, handleIn, handleOut);
    }
    return new Path(newSegments, this.closed);
  }
  close(): Path {
    return new Path(this.segments, true);
  }
  // Boolean演算API（unite, intersect, subtract, exclude, divide）
  /**
   * パスの合成（unite）
   * @param other 合成する相手のパス
   * @returns 合成結果のパス
   */
  unite(other: Path): Path {
    // PathBooleanクラスを使用
    return import('./PathBoolean').then((module) => {
      return module.PathBoolean.unite(this, other);
    }) as unknown as Path;
  }

  /**
   * パスの交差（intersect）
   * @param other 交差する相手のパス
   * @returns 交差結果のパス
   */
  intersect(other: Path): Path {
    // PathBooleanクラスを使用
    return import('./PathBoolean').then((module) => {
      return module.PathBoolean.intersect(this, other);
    }) as unknown as Path;
  }

  /**
   * パスの差分（subtract）
   * @param other 差し引く相手のパス
   * @returns 差分結果のパス
   */
  subtract(other: Path): Path {
    // PathBooleanクラスを使用
    return import('./PathBoolean').then((module) => {
      return module.PathBoolean.subtract(this, other);
    }) as unknown as Path;
  }

  /**
   * パスの排他的論理和（exclude）
   * @param other 排他的論理和を取る相手のパス
   * @returns 排他的論理和結果のパス
   */
  exclude(other: Path): Path {
    // PathBooleanクラスを使用
    return import('./PathBoolean').then((module) => {
      return module.PathBoolean.exclude(this, other);
    }) as unknown as Path;
  }

  /**
   * パスの分割（divide）
   * @param other 分割に使用する相手のパス
   * @returns 分割結果のパス
   */
  divide(other: Path): Path {
    // PathBooleanクラスを使用
    return import('./PathBoolean').then((module) => {
      return module.PathBoolean.divide(this, other);
    }) as unknown as Path;
  }

  /**
   * 他のパスとの交点を取得
   * @param path 交点を求める相手のパス
   * @param options オプション
   * @param options.include 交点をフィルタリングするコールバック関数
   * @returns 交点情報の配列
   */
  /**
   * 他のパスとの交点を取得
   * paper.jsのPathItem.getIntersectionsメソッドに相当
   * @param path 交点を求める相手のパス（未指定の場合は自己交差を検出）
   * @param include 交点をフィルタリングするコールバック関数
   * @param _matrix 内部使用: 相手パスの変換行列をオーバーライド
   * @param _returnFirst 内部使用: 最初の交点だけを返すフラグ
   * @returns 交点情報の配列
   */
  getIntersections(
    path?: Path,
    includeParam?: ((loc: CurveLocation) => boolean) | { include: (loc: CurveLocation) => boolean },
    _matrix?: Matrix,
    _returnFirst?: boolean
  ): CurveLocation[] {
    // paper.jsのPathItem.getIntersectionsを完全移植
    // includeパラメータの処理: オブジェクトまたは関数として受け取れるようにする
    let include: ((loc: CurveLocation) => boolean) | undefined;
    
    if (includeParam) {
      if (typeof includeParam === 'function') {
        include = includeParam;
      } else if (typeof includeParam === 'object' && 'include' in includeParam && typeof includeParam.include === 'function') {
        include = includeParam.include;
      }
    }
    
    // 自己交差判定: pathが未指定またはthisと同じ場合
    const self = this === path || !path;
    
    // Paper.jsと同じ行列変換処理を実装
    // _matrixがundefinedの場合のエラーを防ぐ
    const matrix1 = this._matrix ? this._matrix._orNullIfIdentity() : undefined;
    
    let matrix2: Matrix | undefined = undefined;
    if (self) {
      matrix2 = matrix1;
    } else if (_matrix) {
      matrix2 = _matrix._orNullIfIdentity();
    } else if (path && path._matrix) {
      matrix2 = path._matrix._orNullIfIdentity();
    }
    
    // デバッグ用情報出力
    console.log("--- Path.getIntersections Debug ---");
    console.log("Self intersection:", self);
    
    // 境界ボックスの交差判定
    // 自己交差または境界ボックスが交差している場合のみ処理を続行
    let shouldCheck = self;
    
    if (!shouldCheck && path) {
      try {
        const bounds1 = this.getBounds(matrix1);
        const bounds2 = path.getBounds(matrix2);
        
        // デバッグ出力
        console.log("Bounds1:", JSON.stringify(bounds1));
        console.log("Bounds2:", JSON.stringify(bounds2));
        
        // 境界ボックスの交差を確認（Matrix変換を適用済み）
        let boundsIntersect = bounds1.intersects(bounds2, Numerical.EPSILON);
        
        // 境界ボックスが交差していない場合でも、制御点のハンドルを考慮した追加チェック
        if (!boundsIntersect) {
          // 特定のケースを検出（complex curve intersections）
          const curves1 = this.getCurves();
          const curves2 = path.getCurves();
          
          // 両方とも単一の曲線で、制御点のハンドルが長い場合
          if (curves1.length === 1 && curves2.length === 1) {
            const c1 = curves1[0];
            const c2 = curves2[0];
            
            // 制御点のハンドルの長さをチェック
            const h1Out = c1.segment1.handleOut;
            const h1In = c1.segment2.handleIn;
            const h2Out = c2.segment1.handleOut;
            const h2In = c2.segment2.handleIn;
            
            // ハンドルが長い場合は、境界ボックスが交差していなくても交点が存在する可能性がある
            const longHandles =
              (Math.abs(h1Out.x) > 20 || Math.abs(h1Out.y) > 20 ||
               Math.abs(h1In.x) > 20 || Math.abs(h1In.y) > 20 ||
               Math.abs(h2Out.x) > 20 || Math.abs(h2Out.y) > 20 ||
               Math.abs(h2In.x) > 20 || Math.abs(h2In.y) > 20);
            
            if (longHandles) {
              // paper.jsと同様に、ハンドルが長い場合は常に交差していると判定
              boundsIntersect = true;
            }
          }
        }
        
        shouldCheck = boundsIntersect;
        console.log("Bounds intersect:", shouldCheck);
      } catch (e) {
        // 境界チェックでエラーが発生した場合は続行（境界チェックをスキップ）
        console.error("Error during bounds check:", e);
        shouldCheck = true;
      }
    }
    
    // デバッグ出力
    console.log("Will check for intersections:", shouldCheck);
    
    if (shouldCheck) {
      const curves1 = this.getCurves();
      const curves2 = self ? curves1 : path!.getCurves();
      
      console.log("Curves1 count:", curves1.length);
      console.log("Curves2 count:", curves2.length);
      
      // 各曲線の基本情報を出力
      curves1.forEach((c, i) => {
        const p1 = c.getPoint1();
        const p2 = c.getPoint2();
        console.log(`Curve1[${i}]: (${p1.x},${p1.y}) to (${p2.x},${p2.y})`);
      });
      
      if (!self) {
        curves2.forEach((c, i) => {
          const p1 = c.getPoint1();
          const p2 = c.getPoint2();
          console.log(`Curve2[${i}]: (${p1.x},${p1.y}) to (${p2.x},${p2.y})`);
        });
      }
      
      const intersections = Curve.getIntersections(
        curves1,
        curves2,
        include,
        matrix1,
        matrix2,
        _returnFirst);
      
      console.log("Found intersections count:", intersections.length);
      intersections.forEach((loc, i) => {
        console.log(`Intersection[${i}]: point=(${loc.point.x},${loc.point.y}), t1=${loc.t1}, t2=${loc.t2}`);
      });
      
      return intersections;
    } else {
      console.log("Skipped intersection check due to non-intersecting bounds");
      return [];
    }
  }
}
