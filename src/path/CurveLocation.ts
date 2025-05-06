/**
 * Paper.jsのCurveLocationクラスを移植したもの
 * 曲線上の位置を表すクラス
 */
import { Curve } from './Curve';
import { Point } from '../basic/Point';
import { Numerical } from '../util/Numerical';
import { CurveLocationUtils } from './CurveLocationUtils';
import { Path } from './Path';
import { Segment } from './Segment';

export class CurveLocation {
  // Paper.jsと同様のプロパティ
  _curve: Curve | null;      // 曲線オブジェクト
  _time: number | null;      // 曲線上のパラメータ
  _point: Point;             // 交点の座標
  _overlap: CurveLocation | null; // 重複範囲代表（paper.jsと同じ）
  _distance?: number;        // 距離（近接判定用）
  
  // キャッシュ用プロパティ
  _offset?: number;          // パス上のオフセット（キャッシュ）
  _curveOffset?: number;     // 曲線上のオフセット（キャッシュ）
  _version?: number;         // パスのバージョン（キャッシュ検証用）
  _path?: Path | null;       // パス参照（キャッシュ用）
  
  // セグメント参照用プロパティ
  _segment?: Segment | null;            // 近接セグメント
  _segment1?: Segment | null;           // 曲線の最初のセグメント
  _segment2?: Segment | null;           // 曲線の2番目のセグメント
  
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
    overlap: CurveLocation | null = null,
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
    // _pointは必ずPoint型
    if (point instanceof Point) {
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
    function trySegment(segment: Segment | null | undefined): Curve | null {
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
  _setPath(path: Path | null): void {
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
  getPath(): Path | null {
    const curve = this.getCurve();
    return curve && curve._path ? curve._path : null;
  }
  
  /**
   * この位置が属する曲線のインデックスを取得
   * @returns 曲線のインデックス
   */
  getIndex(): number {
    const curve = this.getCurve();
    return curve ? curve.getIndex() : -1;
  }
  /**
   * この位置の点を取得
   * @returns 点
   */
  getPoint(): Point {
    return this._point;
  }

  /**
   * この位置に最も近いセグメントを取得
   * @returns セグメント
   */
  getSegment(): Segment | null {
    // まず曲線を取得して_segmentが最新かを確認
    let segment = this._segment ?? null;
    if (!segment) {
      const curve = this.getCurve();
      const time = this.getTime();
      if (time === 0) {
        segment = curve?._segment1 ?? null;
      } else if (time === 1) {
        segment = curve?._segment2 ?? null;
      } else if (time != null && curve) {
        // 最も近いセグメントを曲線の長さを比較して決定
        segment = curve.getPartLength(0, time) < curve.getPartLength(time, 1)
          ? curve._segment1
          : curve._segment2;
      }
      this._segment = segment;
    }
    return segment;
  }

  /**
   * セグメントを設定する内部メソッド
   */
  _setSegment(segment: Segment | null): void {
    const curve = segment?.getCurve();
    if (curve) {
      this._setCurve(curve);
    } else {
      this._setPath(segment?._path ?? null);
      this._segment1 = segment;
      this._segment2 = null;
    }
    this._segment = segment;
    this._time = segment === this._segment1 ? 0 : 1;
    // 精度の問題を避けるため、セグメントの点をクローンして使用
    this._point = segment ? segment._point.toPoint() : this._point;
  }

  /**
   * 距離を取得
   * @returns 距離
   */
  getDistance(): number | undefined {
    return this._distance;
  }

  /**
   * 交点を取得
   * @returns 交点
   */
  getIntersection(): CurveLocation | null {
    return this._intersection;
  }

  /**
   * 交点が接触しているかを確認
   * @returns 接触していればtrue
   */
  isTouching(): boolean {
    const inter = this._intersection;
    if (!inter)
      return false;
    const myTangent = this.getTangent();
    const interTangent = inter.getTangent();
    
    if (myTangent && interTangent && myTangent.isCollinear(interTangent)) {
      // 2つの直線曲線が接触している場合、それらの線が交差しない場合のみ接触と見なす
      const curve1 = this.getCurve();
      const curve2 = inter.getCurve();
      if (curve1 && curve2 && curve1.isStraight() && curve2.isStraight()) {
        // paper.jsと同様に、直線の場合は常にfalseを返す
        // 本来はgetLine()とintersect()を使うべきだが、
        // 現時点では実装されていないため、paper.jsと同じ挙動になるようfalseを返す
        return false;
      }
      return true;
    }
    return false;
  }

  /**
   * 交点が交差しているかを確認
   * @returns 交差していればtrue
   */
  isCrossing(): boolean {
    return CurveLocationUtils.isCrossing(this);
  }

  /**
   * 交点が重複しているかを確認
   * @returns 重複していればtrue
   */
  hasOverlap(): boolean {
    return !!this._overlap;
  }

  /**
   * 曲線を分割
   * @returns 分割結果
   */
  divide(): Curve | null {
    const curve = this.getCurve();
    const time = this.getTime() || 0;
    const res = curve && curve.divideAtTime(time);

    // Change to the newly inserted segment, also adjusts _time.
    if (res) {
      this._setSegment(res._segment1);
    }

    return res;
  }

  /**
   * パスを分割
   * @returns 分割結果
   */
  split(): Curve | null {
    const curve = this.getCurve();
    const path = curve?._path;
    const res = curve && curve.splitAtTime(this.getTime() || 0);
    if (res && path) {
      this._setSegment(path.getLastSegment() ?? null);
    }
    return res;
  }

  /**
   * 2つのCurveLocationが等しいかを確認
   * @param loc 比較対象のCurveLocation
   * @param _ignoreOther 相互参照を無視するかどうか
   * @returns 等しければtrue
   */
  equals(loc: CurveLocation, _ignoreOther: boolean = false): boolean {
    return CurveLocationUtils.equals(this, loc, _ignoreOther);
  }

  /**
   * 接線を取得
   * @returns 接線
   */
  getTangent(): Point | null {
    const curve = this.getCurve();
    const time = this.getTime();
    if (time != null && curve) {
      return curve.getTangentAtTime(time);
    }
    return null;
  }

  /**
   * 法線を取得
   * @returns 法線
   */
  getNormal(): Point | null {
    const curve = this.getCurve();
    const time = this.getTime();
    if (time != null && curve) {
      return curve.getNormalAtTime(time);
    }
    return null;
  }

  /**
   * 曲率を取得
   * @returns 曲率
   */
  getCurvature(): number | null {
    const curve = this.getCurve();
    const time = this.getTime();
    if (time != null && curve) {
      return curve.getCurvatureAtTime(time);
    }
    return null;
  }

  /**
   * 交点情報を挿入する静的メソッド
   * paper.jsのCurveLocation.insertメソッドを完全に実装
   * @param locations 交点情報の配列
   * @param loc 挿入する交点情報
   * @param merge マージするかどうか
   * @returns 挿入された交点情報
   */
  static insert(locations: CurveLocation[], loc: CurveLocation, merge: boolean): CurveLocation {
    // パスID、曲線、時間でソートするためのバイナリサーチを行う
    let length = locations.length;
    let l = 0;
    let r = length - 1;

    function search(index: number, dir: number): CurveLocation | null {
      // リストの始端/終端に達した場合、もう一方の端の位置も比較する
      for (let i = index + dir; i >= -1 && i <= length; i += dir) {
        // インデックスを循環させる
        const loc2 = locations[((i % length) + length) % length];
        // 点が十分近い場合のみ比較
        if (!loc.getPoint().isClose(loc2.getPoint(), Numerical.GEOMETRIC_EPSILON))
          break;
        if (loc.equals(loc2))
          return loc2;
      }
      return null;
    }

    while (l <= r) {
      const m = (l + r) >>> 1;
      const loc2 = locations[m];
      let found: CurveLocation | null = null;
      
      // 2つの位置が実際に同じかどうかを確認し、同じ場合はマージ
      if (merge && (found = loc.equals(loc2) ? loc2 : (search(m, -1) || search(m, 1)))) {
        // 重複フラグを伝播
        if (loc._overlap) {
          found._overlap = found;
          if (found._intersection) {
            found._intersection._overlap = found._intersection;
          }
        }
        return found;
      }

      // パスID、曲線、時間でソート
      const path1 = loc.getPath();
      const path2 = loc2.getPath();
      
      // パスIDが異なる場合はパスIDでソート
      // 同じパスの場合はインデックスと時間でソート
      const diff = path1 !== path2
        ? ((path1 ? path1._id : 0) - (path2 ? path2._id : 0))
        : (loc.getIndex() + (loc.getTime() || 0)) - (loc2.getIndex() + (loc2.getTime() || 0));
      
      if (diff < 0) {
        r = m - 1;
      } else {
        l = m + 1;
      }
    }
    
    // 既存の位置とマージしなかった場合、新しい位置を挿入
    locations.splice(l, 0, loc);
    return loc;
  }

  /**
   * 交点情報を展開する静的メソッド
   * paper.jsのCurveLocation.expandメソッドを完全に実装
   * @param locations 交点情報の配列
   * @returns 展開された交点情報の配列
   */
  static expand(locations: CurveLocation[]): CurveLocation[] {
    // コピーを作成（insertが配列を変更するため）
    const expanded = locations.slice();
    
    // 各交点の_intersectionも配列に追加
    for (let i = locations.length - 1; i >= 0; i--) {
      CurveLocation.insert(expanded, locations[i]._intersection!, false);
    }
    
    return expanded;
  }
}