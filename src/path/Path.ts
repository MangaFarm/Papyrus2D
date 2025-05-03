/**
 * Path クラス
 * Paper.js の Path (src/path/Path.js) を参考にしたミュータブルなパス表現。
 * segments 配列と closed フラグを持ち、PathItem インターフェースを実装する。
 */

import { Point } from '../basic/Point';
import { Rectangle } from '../basic/Rectangle';
import { Matrix } from '../basic/Matrix';
import { Curve, CurveLocation } from './Curve';
import { Segment } from './Segment';
import { Numerical } from '../util/Numerical';
import { PathItem } from './PathItem';
import { ChangeFlag } from './ChangeFlag';

export class Path implements PathItem {
  _segments: Segment[];
  _closed: boolean;

  // PathItemインターフェースの実装
  _matrix?: Matrix;
  _matrixDirty: boolean = false;
  _curves?: Curve[];
  _version: number = 0;
  _length?: number;
  _area?: number;
  _bounds?: Rectangle;
  _segmentSelection: number = 0;

  constructor(segments: Segment[] = [], closed: boolean = false) {
    this._segments = [];
    this._closed = false;
    this._curves = undefined;
    this._segmentSelection = 0;
    
    // セグメントがある場合は追加
    if (segments.length > 0) {
      this.setSegments(segments);
    }
    
    // 閉じたパスの場合は設定
    if (closed) {
      this._closed = closed;
    }
  }

  /**
   * セグメントの数を取得
   */
  get segmentCount(): number {
    return this._segments.length;
  }

  /**
   * セグメント配列を取得
   */
  getSegments(): Segment[] {
    return this._segments;
  }

  /**
   * セグメント配列を設定
   * @param segments 新しいセグメント配列
   */
  setSegments(segments: Segment[]): void {
    this._segments.length = 0;
    this._segmentSelection = 0;
    this._curves = undefined;
    
    if (segments && segments.length) {
      this._add(segments);
    }
  }

  /**
   * 複数のセグメントを追加
   * @param segments 追加するセグメント配列
   */
  /**
   * セグメントを追加する内部メソッド
   * @param segs 追加するセグメント配列
   * @param index 挿入位置（省略時は末尾に追加）
   */
  _add(segs: Segment[], index?: number): Segment[] {
    const segments = this._segments;
    const curves = this._curves;
    const amount = segs.length;
    const append = index === undefined;
    index = append ? segments.length : index!;

    // セグメントの設定
    for (let i = 0; i < amount; i++) {
      const segment = segs[i];
      // 他のパスに属している場合はクローン
      if (segment._path) {
        segs[i] = segment.clone();
      }
      segs[i]._path = this;
      segs[i]._index = index + i;
      
      // セグメントの選択状態を更新
      if (segment._selection) {
        this._updateSelection(segment, 0, segment._selection);
      }
    }

    // セグメントの挿入
    if (append) {
      segments.push(...segs);
    } else {
      segments.splice(index, 0, ...segs);
      // インデックスの更新
      for (let i = index + amount, l = segments.length; i < l; i++) {
        segments[i]._index = i;
      }
    }

    // カーブの更新
    if (curves) {
      const total = this._countCurves();
      const start = index > 0 && index + amount - 1 === total ? index - 1 : index;
      let insert = start;
      const end = Math.min(start + amount, total);

      // 新しいカーブの挿入
      for (let i = insert; i < end; i++) {
        curves.splice(i, 0, new Curve(this, null, null));
      }
      
      // カーブのセグメントを調整
      this._adjustCurves(start, end);
    }

    this._changed(ChangeFlag.SEGMENTS);
    return segs;
  }

  /**
   * カーブのセグメントを調整する内部メソッド
   */
  _adjustCurves(start: number, end: number): void {
    const segments = this._segments;
    const curves = this._curves;
    
    if (!curves) return;

    for (let i = start; i < end; i++) {
      const curve = curves[i];
      curve._path = this;
      curve._segment1 = segments[i];
      curve._segment2 = segments[i + 1] || segments[0];
      curve._changed();
    }

    // 最初のセグメントの場合、閉じたパスの最後のセグメントも修正
    if (start > 0 && (!start || this._closed)) {
      const curve = curves[this._closed && !start ? segments.length - 1 : start - 1];
      if (curve) {
        curve._segment2 = segments[start] || segments[0];
        curve._changed();
      }
    }

    // 修正範囲の後のセグメントがある場合も修正
    if (end < curves.length) {
      const curve = curves[end];
      if (curve) {
        curve._segment1 = segments[end];
        curve._changed();
      }
    }
  }

  /**
   * セグメントの選択状態を更新する内部メソッド
   */
  _updateSelection(segment: Segment, oldSelection: number, newSelection: number): void {
    segment._selection = newSelection;
    this._segmentSelection += newSelection - oldSelection;
  }

  /**
   * 複数のセグメントを追加
   * @param segments 追加するセグメント配列
   */
  addSegments(segments: Segment[]): Segment[] {
    return this._add(segments);
  }

  /**
   * 最初のセグメントを取得
   */
  getFirstSegment(): Segment | undefined {
    return this._segments[0];
  }

  /**
   * 最後のセグメントを取得
   */
  getLastSegment(): Segment | undefined {
    return this._segments[this._segments.length - 1];
  }

  /**
   * パスが閉じているかどうかを取得
   */
  isClosed(): boolean {
    return this._closed;
  }

  /**
   * パスを閉じるかどうかを設定
   */
  setClosed(closed: boolean): void {
    if (this._closed != (closed = !!closed)) {
      this._closed = closed;
      // カーブの更新
      if (this._curves) {
        const length = this._curves.length = this._countCurves();
        if (closed) {
          this._curves[length - 1] = new Curve(
            this._segments[length - 1],
            this._segments[0]
          );
        }
      }
      this._changed(ChangeFlag.SEGMENTS);
    }
  }
  
  /**
   * PathItemインターフェースの実装のためのgetter
   */
  get closed(): boolean {
    return this._closed;
  }

  getLength(): number {
    if (this._length == null) {
      const curves = this.getCurves();
      let length = 0;
      for (let i = 0, l = curves.length; i < l; i++) {
        length += curves[i].getLength();
      }
      this._length = length;
    }
    return this._length!;
  }

  /**
   * パスの面積を計算します。自己交差するパスの場合、
   * 互いに打ち消し合うサブエリアが含まれる場合があります。
   *
   * @return {number} パスの面積
   */
  getArea(): number {
    if (this._area == null) {
      const segments = this._segments;
      const closed = this._closed;
      let area = 0;
      
      for (let i = 0, l = segments.length; i < l; i++) {
        const last = i + 1 === l;
        
        // Paper.jsと完全に同じ処理
        area += Curve.getArea(Curve.getValues(
          segments[i],
          segments[last ? 0 : i + 1],
          null,
          last && !closed
        ));
      }
      
      this._area = area; // Paper.jsと同じく絶対値を取らない
    }
    
    return this._area!;
  }

  /**
   * 変更通知メソッド
   * @param flags 変更フラグ
   */
  _changed(flags: number): void {
    if (flags & ChangeFlag.GEOMETRY) {
      this._length = this._area = undefined;
      if (flags & ChangeFlag.SEGMENTS) {
        this._version++; // CurveLocationのキャッシュ更新用
      } else if (this._curves) {
        // セグメントの変更でない場合は、すべての曲線に変更を通知
        for (let i = 0, l = this._curves.length; i < l; i++) {
          this._curves[i]._changed();
        }
      }
    } else if (flags & ChangeFlag.STROKE) {
      // ストロークの変更時は境界ボックスのキャッシュをクリア
      this._bounds = undefined;
    }
  }

  /**
   * パスの境界ボックスを取得
   * @param matrix 変換行列（オプション）
   * @returns 境界ボックス
   */
  getBounds(matrix?: Matrix | null): Rectangle {
    // paper.jsのCurve._addBoundsロジックを移植
    let bounds = this._computeBounds(0);
    
    // 行列変換がある場合は適用
    if (matrix) {
      bounds = bounds.transform(matrix);
    }
    
    return bounds;
  }

  /**
   * ストローク境界計算
   * @param strokeWidth 線幅
   * @param matrix 変換行列（オプション）
   */
  getStrokeBounds(strokeWidth: number, matrix?: Matrix | null): Rectangle {
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
    if (this._segments.length === 0) {
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
    for (let i = 0; i < this._segments.length - (this._closed ? 0 : 1); i++) {
      const seg0 = this._segments[i];
      const seg1 = this._segments[(i + 1) % this._segments.length];
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

  /**
   * 指定されたパラメータ位置のパス上の点を取得
   * @param t パラメータ位置（0〜1）
   * @returns パス上の点
   */
  getPointAt(t: number): Point {
    const loc = this.getLocationAt(t);
    return loc ? loc.point : new Point(0, 0);
  }

  /**
   * 指定された点がパス上にある場合、その位置情報を取得
   * @param point パス上の点
   * @returns 曲線位置情報
   */
  getLocationOf(point: Point): CurveLocation | null {
    const curves = this.getCurves();
    for (let i = 0, l = curves.length; i < l; i++) {
      const loc = curves[i].getLocationOf(point);
      if (loc) {
        return loc;
      }
    }
    return null;
  }

  /**
   * 指定された点までのパスの長さを取得
   * @param point パス上の点
   * @returns パスの長さ
   */
  getOffsetOf(point: Point): number | null {
    const loc = this.getLocationOf(point);
    return loc ? loc.getOffset() : null;
  }

  /**
   * 指定されたオフセット位置のパス上の位置情報を取得
   * @param offset オフセット位置（0〜getLength()）
   * @returns 曲線位置情報
   */
  getLocationAt(offset: number): CurveLocation | null {
    if (typeof offset === 'number') {
      const curves = this.getCurves();
      const length = curves.length;
      if (!length) return null;
      
      let curLength = 0;
      
      for (let i = 0; i < length; i++) {
        const start = curLength;
        const curve = curves[i];
        curLength += curve.getLength();
        
        if (curLength > offset) {
          // この曲線上の位置を計算
          return curve.getLocationAt(offset - start);
        }
      }
      
      // 誤差により最後の曲線が見逃された場合、offsetが全長以下であれば最後の曲線の終点を返す
      if (curves.length > 0 && offset <= this.getLength()) {
        return new CurveLocation(curves[length - 1], 1);
      }
    } else if (offset && (offset as any).getPath && (offset as any).getPath() === this) {
      // offsetがすでにCurveLocationの場合はそのまま返す
      return offset as unknown as CurveLocation;
    }
    
    return null;
  }

  /**
   * 指定されたパラメータ位置のパス上の接線ベクトルを取得
   * @param offset オフセット位置（0〜getLength()）
   * @returns 接線ベクトル
   */
  getTangentAt(offset: number): Point {
    const loc = this.getLocationAt(offset);
    return loc && loc.curve ? loc.curve.getTangentAt(loc.time!) : new Point(0, 0);
  }

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
    for (const seg of this._segments) {
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
          const count = Numerical.solveCubic(a, b, c2, d, tempRoots, { min: 0, max: 1 });

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

      Numerical.solveCubic(a, b, c, d, roots, { min: 0, max: 1 });

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
    // ジオメトリが変更されたことを記録
    this._length = this._area = undefined;
    this._bounds = undefined;
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
    // ジオメトリが変更されたことを記録
    this._length = this._area = undefined;
    this._bounds = undefined;
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
    // ジオメトリが変更されたことを記録
    this._length = this._area = undefined;
    this._bounds = undefined;
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
    // ジオメトリが変更されたことを記録
    this._length = this._area = undefined;
    this._bounds = undefined;
    return this;
  }

  /**
   * パスのカーブの数を計算する
   * セグメント数と閉じているかどうかに基づいて計算
   */
  private _countCurves(): number {
    const length = this._segments.length;
    // 開いたパスの場合は長さを1減らす
    return !this._closed && length > 0 ? length - 1 : length;
  }

  getCurves(): Curve[] {
    // paper.jsと同様にキャッシュを使用する
    if (this._curves) {
      return this._curves;
    }
    
    const curves: Curve[] = [];
    const segments = this._segments;
    const length = this._countCurves();
    
    for (let i = 0; i < length; i++) {
      curves.push(new Curve(segments[i], segments[i + 1] || segments[0]));
    }
    
    this._curves = curves;
    return curves;
  }

  /**
   * パスの最初の曲線を取得
   * @returns 最初の曲線
   */
  getFirstCurve(): Curve | undefined {
    const curves = this.getCurves();
    return curves.length > 0 ? curves[0] : undefined;
  }

  /**
   * パスの最後の曲線を取得
   * @returns 最後の曲線
   */
  getLastCurve(): Curve | undefined {
    const curves = this.getCurves();
    return curves.length > 0 ? curves[curves.length - 1] : undefined;
  }

  // --- セグメント操作（ミュータブル: thisを返す） ---

  /**
   * セグメントを追加
   * @param segment 追加するセグメント
   */
  add(segment: Segment): Segment {
    return this._add([segment])[0];
  }

  /**
   * 指定位置にセグメントを挿入
   * @param index 挿入位置
   * @param segment 挿入するセグメント
   */
  insert(index: number, segment: Segment): Segment {
    return this._add([segment], index)[0];
  }

  /**
   * セグメントを削除
   * @param index 削除するセグメントのインデックス
   */
  removeSegment(index: number): Segment | null {
    return this.removeSegments(index, index + 1)[0] || null;
  }

  /**
   * 複数のセグメントを削除
   * @param from 開始インデックス
   * @param to 終了インデックス（省略時は最後まで）
   */
  removeSegments(from: number = 0, to?: number): Segment[] {
    from = from || 0;
    to = to !== undefined ? to : this._segments.length;
    
    const segments = this._segments;
    const curves = this._curves;
    const removed = segments.splice(from, to - from);
    
    if (removed.length === 0) {
      return removed;
    }
    
    // インデックスの更新
    for (let i = from, l = segments.length; i < l; i++) {
      segments[i]._index = i;
    }
    
    // カーブの更新
    if (curves) {
      const index = from > 0 && to === segments.length + removed.length ? from - 1 : from;
      this._curves!.splice(index, removed.length);
      this._adjustCurves(index, index);
    }
    
    this._changed(ChangeFlag.SEGMENTS);
    return removed;
  }

  /**
   * すべてのセグメントを削除
   */
  clear(): Segment[] {
    return this.removeSegments();
  }

  // --- サブパス操作 ---

  /**
   * 新しい位置にパスを移動（既存のセグメントをクリアして新しいセグメントを追加）
   * @param point 移動先の点
   */
  moveTo(point: Point): Path {
    this._segments.length = 0;
    this._curves = undefined;
    this._segmentSelection = 0;
    this.add(new Segment(point));
    return this;
  }

  /**
   * 直線セグメントを追加
   * @param point 線の終点
   */
  lineTo(point: Point): Path {
    this.add(new Segment(point));
    return this;
  }

  /**
   * cubicCurveTo: smoothHandles/selfClosing対応
   * @param handle1
   * @param handle2
   * @param to
   * @param options.smoothHandles: 連続ノードのハンドルを平滑化
   * @param options.selfClosing: 始点と終点が一致していれば自動的にclose
   */
  /**
   * 3次ベジェ曲線セグメントを追加
   * @param handle1 制御点1
   * @param handle2 制御点2
   * @param to 終点
   * @param options オプション
   */
  cubicCurveTo(
    handle1: Point,
    handle2: Point,
    to: Point,
    options?: { smoothHandles?: boolean; selfClosing?: boolean }
  ): Path {
    if (this._segments.length === 0) {
      this.add(new Segment(to));
      return this;
    }
    
    const lastIdx = this._segments.length - 1;
    const lastSeg = this._segments[lastIdx];
    
    // handleOut: handle1 - last.point
    let relHandleOut = handle1.subtract(lastSeg.point);
    let relHandleIn = handle2.subtract(to);

    // smoothHandles: 連続ノードのハンドルを平滑化
    if (options?.smoothHandles && lastIdx > 0) {
      const prev = this._segments[lastIdx - 1].point;
      const curr = lastSeg.point;
      // Catmull-Rom的な平滑化
      relHandleOut = curr.subtract(prev).multiply(1 / 3);
      relHandleIn = to.subtract(lastSeg.point).multiply(-1 / 3);
    }

    // 最後のセグメントのハンドルを設定
    lastSeg._handleOut = new Point(relHandleOut.x, relHandleOut.y);
    
    // 新しいセグメントを追加
    this.add(new Segment(to, relHandleIn, new Point(0, 0)));

    // selfClosing: 始点と終点が一致していれば自動的にclose
    if (options?.selfClosing) {
      const firstPt = this._segments[0].point;
      const lastPt = to;
      if (firstPt.equals(lastPt)) {
        this._closed = true;
      }
    }
    
    return this;
  }

  /**
   * 全セグメントのハンドルを自動補正（paper.jsのsmooth相当, Catmull-Rom的）
   */
  /**
   * 全セグメントのハンドルを自動補正（paper.jsのsmooth相当, Catmull-Rom的）
   */
  smooth(): Path {
    if (this._segments.length < 3) return this;
    
    for (let i = 1; i < this._segments.length - 1; i++) {
      const prev = this._segments[i - 1].point;
      const curr = this._segments[i].point;
      const next = this._segments[i + 1].point;
      // ハンドルは前後点の差分を1/6ずつ
      const handleIn = prev.subtract(next).multiply(-1 / 6);
      const handleOut = next.subtract(prev).multiply(1 / 6);
      this._segments[i]._handleIn = new Point(handleIn.x, handleIn.y);
      this._segments[i]._handleOut = new Point(handleOut.x, handleOut.y);
    }
    
    this._changed(ChangeFlag.GEOMETRY);
    return this;
  }
  
  /**
   * パスを閉じる
   */
  close(): Path {
    this._closed = true;
    this._changed(ChangeFlag.SEGMENTS);
    return this;
  }

  /**
   * パスのセグメントにハンドルが設定されているかどうかを確認
   * @returns ハンドルが設定されていればtrue
   */
  hasHandles(): boolean {
    const segments = this._segments;
    for (let i = 0, l = segments.length; i < l; i++) {
      if (segments[i].hasHandles()) {
        return true;
      }
    }
    return false;
  }

  /**
   * パスのすべてのハンドルをクリア
   * @returns 新しいパス
   */
  /**
   * パスのすべてのハンドルをクリア
   */
  clearHandles(): Path {
    const segments = this._segments;
    for (let i = 0, l = segments.length; i < l; i++) {
      segments[i]._handleIn = new Point(0, 0);
      segments[i]._handleOut = new Point(0, 0);
    }
    this._changed(ChangeFlag.GEOMETRY);
    return this;
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
   * paper.jsのPathItem.getIntersectionsメソッドに相当
   * @param path 交点を求める相手のパス（未指定の場合は自己交差を検出）
   * @param includeParam 交点をフィルタリングするコールバック関数
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
    // includeパラメータの処理
    let include: ((loc: CurveLocation) => boolean) | undefined;
    
    if (includeParam) {
      if (typeof includeParam === 'function') {
        include = includeParam;
      } else if (typeof includeParam === 'object' && 'include' in includeParam && typeof includeParam.include === 'function') {
        include = includeParam.include;
      }
    }
    
    // 自己交差判定
    const self = this === path || !path;
    
    // 行列変換処理
    const matrix1 = this._matrix ? this._matrix._orNullIfIdentity() : null;
    
    let matrix2: Matrix | null = null;
    if (self) {
      matrix2 = matrix1;
    } else if (_matrix) {
      matrix2 = _matrix._orNullIfIdentity();
    } else if (path && path._matrix) {
      matrix2 = path._matrix._orNullIfIdentity();
    }
    
    // 境界ボックスの交差判定
    let shouldCheck = self;
    
    if (!shouldCheck && path) {
      try {
        const bounds1 = this.getBounds(matrix1);
        const bounds2 = path.getBounds(matrix2);
        
        // 境界ボックスの交差を確認
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
              boundsIntersect = true;
            }
          }
        
        }
        
        shouldCheck = boundsIntersect;
      } catch (e) {
        // 境界チェックでエラーが発生した場合は続行
        shouldCheck = true;
      }
    }
    
    if (shouldCheck) {
      const curves1 = this.getCurves();
      const curves2 = self ? curves1 : path!.getCurves();
      
      return Curve.getIntersections(
        curves1,
        curves2,
        include,
        matrix1,
        matrix2,
        _returnFirst);
    } else {
      return [];
    }
  }

  /**
   * 指定された接線に対して曲線が接する時間パラメータを計算
   * @param tangent 接線ベクトル
   * @returns パス上のオフセット位置の配列
   */
  getOffsetsWithTangent(tangent: Point): number[] {
    if (tangent.isZero()) {
      return [];
    }

    const offsets: number[] = [];
    let curveStart = 0;
    const curves = this.getCurves();
    
    for (let i = 0, l = curves.length; i < l; i++) {
      const curve = curves[i];
      // 曲線上の接線ベクトルと一致する時間パラメータを計算
      const curveTimes = curve.getTimesWithTangent(tangent);
      
      for (let j = 0, m = curveTimes.length; j < m; j++) {
        // 曲線上の時間パラメータをパス上のオフセットに変換
        const offset = curveStart + curve.getPartLength(0, curveTimes[j]);
        
        // 重複を避ける
        if (offsets.indexOf(offset) < 0) {
          offsets.push(offset);
        }
      }
      
      curveStart += curve.getLength();
    }
    
    return offsets;
  }
}
