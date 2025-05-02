import { Point } from './Point';

/**
 * 2Dアフィン変換行列（イミュータブル設計）
 * [ a c tx ]
 * [ b d ty ]
 * [ 0 0  1 ]
 */
export class Matrix {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly tx: number;
  readonly ty: number;

  /**
   * 単位行列
   */
  static identity(): Matrix {
    return new Matrix(1, 0, 0, 1, 0, 0);
  }

  constructor(a: number, b: number, c: number, d: number, tx: number, ty: number) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.tx = tx;
    this.ty = ty;
  }

  /**
   * 配列またはMatrixから生成
   */
  static fromArray(values: number[]): Matrix {
    if (values.length !== 6) throw new Error('配列の長さは6でなければなりません');
    return new Matrix(values[0], values[1], values[2], values[3], values[4], values[5]);
  }

  static fromMatrix(matrix: Matrix): Matrix {
    return new Matrix(matrix.a, matrix.b, matrix.c, matrix.d, matrix.tx, matrix.ty);
  }

  /**
   * 配列として取得
   */
  getValues(): number[] {
    return [this.a, this.b, this.c, this.d, this.tx, this.ty];
  }

  /**
   * 等価判定
   */
  equals(mx: Matrix): boolean {
    return (
      this.a === mx.a &&
      this.b === mx.b &&
      this.c === mx.c &&
      this.d === mx.d &&
      this.tx === mx.tx &&
      this.ty === mx.ty
    );
  }

  /**
   * 文字列表現
   */
  toString(): string {
    return `[[${this.a}, ${this.c}, ${this.tx}], [${this.b}, ${this.d}, ${this.ty}]]`;
  }

  /**
   * 単位行列かどうか
   */
  isIdentity(): boolean {
    return this.equals(Matrix.identity());
  }

  /**
   * シンギュラリティ判定（逆行列が存在しない場合true）
   */
  isSingular(): boolean {
    return this.a * this.d - this.b * this.c === 0;
  }

  /**
   * 複製
   */
  clone(): Matrix {
    return Matrix.fromMatrix(this);
  }

  /**
   * 平行移動
   */
  translate(x: number, y: number): Matrix {
    // 新しい行列を返す
    return this.append(new Matrix(1, 0, 0, 1, x, y));
  }

  /**
   * スケーリング
   */
  scale(sx: number, sy?: number, center?: Point): Matrix {
    if (sy === undefined) sy = sx;
    let m = new Matrix(sx, 0, 0, sy, 0, 0);
    if (center) {
      // centerを原点に移動→スケール→戻す
      return this.translate(center.x, center.y)
        .append(m)
        .translate(-center.x, -center.y);
    }
    return this.append(m);
  }

  /**
   * 回転（degree, center指定可）
   */
  rotate(angle: number, center?: Point): Matrix {
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    let m = new Matrix(cos, sin, -sin, cos, 0, 0);
    if (center) {
      return this.translate(center.x, center.y)
        .append(m)
        .translate(-center.x, -center.y);
    }
    return this.append(m);
  }

  /**
   * 行列の合成（右から掛ける）
   */
  append(mx: Matrix): Matrix {
    const a1 = this.a, b1 = this.b, c1 = this.c, d1 = this.d, tx1 = this.tx, ty1 = this.ty;
    const a2 = mx.a, b2 = mx.b, c2 = mx.c, d2 = mx.d, tx2 = mx.tx, ty2 = mx.ty;
    return new Matrix(
      a1 * a2 + c1 * b2,
      b1 * a2 + d1 * b2,
      a1 * c2 + c1 * d2,
      b1 * c2 + d1 * d2,
      a1 * tx2 + c1 * ty2 + tx1,
      b1 * tx2 + d1 * ty2 + ty1
    );
  }

  /**
   * 行列の合成（左から掛ける）
   */
  prepend(mx: Matrix): Matrix {
    return mx.append(this);
  }

  /**
   * 逆行列
   */
  invert(): Matrix | null {
    const det = this.a * this.d - this.b * this.c;
    if (det === 0) return null;
    return new Matrix(
      this.d / det,
      -this.b / det,
      -this.c / det,
      this.a / det,
      (this.c * this.ty - this.d * this.tx) / det,
      (this.b * this.tx - this.a * this.ty) / det
    );
  }
/**
   * シアー変換
   */
  shear(shx: number, shy: number = 0, center?: Point): Matrix {
    let m = new Matrix(1, shy, shx, 1, 0, 0);
    if (center) {
      return this.translate(center.x, center.y)
        .append(m)
        .translate(-center.x, -center.y);
    }
    return this.append(m);
  }

  /**
   * スキュー変換（角度指定, degree）
   */
  skew(skewX: number, skewY: number = 0, center?: Point): Matrix {
    const toRad = Math.PI / 180;
    return this.shear(Math.tan(skewX * toRad), Math.tan(skewY * toRad), center);
  }

  /**
   * 新しい行列としてappend
   */
  appended(mx: Matrix): Matrix {
    return this.append(mx);
  }

  /**
   * 新しい行列としてprepend
   */
  prepended(mx: Matrix): Matrix {
    return this.prepend(mx);
  }

  /**
   * 新しい行列としてinverted
   */
  inverted(): Matrix | null {
    const inv = this.invert();
    return inv ? inv : null;
  }

  /**
   * 逆行列が存在するか
   */
  isInvertible(): boolean {
    return (this.a * this.d - this.b * this.c) !== 0;
  }

  /**
   * 平行移動成分を取得
   */
  getTranslation(): Point {
    return new Point(this.tx, this.ty);
  }

  /**
   * 行列の分解（回転角・スケール成分を返す）
   */
  decompose(): { scaling: Point; rotation: number; translation: Point } {
    // paper.js準拠の2Dアフィン分解
    const { a, b, c, d, tx, ty } = this;
    const det = a * d - b * c;
    const sqrt = Math.sqrt;
    const atan2 = Math.atan2;
    const acos = Math.acos;
    const asin = Math.asin;
    const degrees = 180 / Math.PI;
    let rotate = 0;
    let scale: [number, number] = [0, 0];
    if (a !== 0 || b !== 0) {
      const r = sqrt(a * a + b * b);
      rotate = acos(a / r) * (b > 0 ? 1 : -1);
      scale = [r, det / r];
    } else if (c !== 0 || d !== 0) {
      const s = sqrt(c * c + d * d);
      rotate = asin(c / s) * (d > 0 ? 1 : -1);
      scale = [det / s, s];
    }
    // translation
    const translation = new Point(tx, ty);
    return {
      translation,
      rotation: rotate * degrees,
      scaling: new Point(scale[0], scale[1])
    };
  }

  /**
   * スケール成分
   */
  getScaling(): Point {
    return this.decompose().scaling;
  }

  /**
   * 回転角（degree）
   */
  getRotation(): number {
    return this.decompose().rotation;
  }

  /**
   * 点または配列を変換
   */
  transform(point: Point): Point {
    const x = point.x, y = point.y;
    return new Point(
      x * this.a + y * this.c + this.tx,
      x * this.b + y * this.d + this.ty
    );
  }

  /**
   * 逆変換
   */
  inverseTransform(point: Point): Point | null {
    const inv = this.invert();
    return inv ? inv.transform(point) : null;
  }

  /**
   * Canvas用（Papyrus2Dでは空実装）
   */
  applyToContext(_ctx: unknown): void {
    // レンダリング非対応
  }
}