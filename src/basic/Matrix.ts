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
    return this.a === 1 && this.b === 0 && this.c === 0 && this.d === 1
           && this.tx === 0 && this.ty === 0;
  }

  /**
   * シンギュラリティ判定（逆行列が存在しない場合true）
   */
  isSingular(): boolean {
    return !this.isInvertible();
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
    return new Matrix(
      this.a,
      this.b,
      this.c,
      this.d,
      this.tx + x * this.a + y * this.c,
      this.ty + x * this.b + y * this.d
    );
  }

  /**
   * スケーリング
   */
  scale(sx: number, sy?: number, center?: Point): Matrix {
    if (sy === undefined) sy = sx;
    
    if (center) {
      const x = center.x;
      const y = center.y;
      return this.translate(x, y)
        .scale(sx, sy)
        .translate(-x, -y);
    }
    
    return new Matrix(
      this.a * sx,
      this.b * sx,
      this.c * sy,
      this.d * sy,
      this.tx,
      this.ty
    );
  }

  /**
   * 回転（degree, center指定可）
   */
  rotate(angle: number, center?: Point): Matrix {
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    
    if (center) {
      const x = center.x;
      const y = center.y;
      const tx = x - x * cos + y * sin;
      const ty = y - x * sin - y * cos;
      
      return new Matrix(
        cos * this.a + sin * this.c,
        cos * this.b + sin * this.d,
        -sin * this.a + cos * this.c,
        -sin * this.b + cos * this.d,
        this.tx + tx * this.a + ty * this.c,
        this.ty + tx * this.b + ty * this.d
      );
    }
    
    return new Matrix(
      cos * this.a + sin * this.c,
      cos * this.b + sin * this.d,
      -sin * this.a + cos * this.c,
      -sin * this.b + cos * this.d,
      this.tx,
      this.ty
    );
  }

  /**
   * 行列の合成（右から掛ける）
   */
  append(mx: Matrix): Matrix {
    if (!mx) return this.clone();
    
    const a1 = this.a, b1 = this.b, c1 = this.c, d1 = this.d, tx1 = this.tx, ty1 = this.ty;
    const a2 = mx.a, b2 = mx.c, c2 = mx.b, d2 = mx.d, tx2 = mx.tx, ty2 = mx.ty;
    return new Matrix(
      a2 * a1 + c2 * c1,
      a2 * b1 + c2 * d1,
      b2 * a1 + d2 * c1,
      b2 * b1 + d2 * d1,
      tx1 + tx2 * a1 + ty2 * c1,
      ty1 + tx2 * b1 + ty2 * d1
    );
  }

  /**
   * 行列の合成（左から掛ける）
   */
  prepend(mx: Matrix): Matrix {
    if (!mx) return this.clone();
    
    const a1 = this.a, b1 = this.b, c1 = this.c, d1 = this.d, tx1 = this.tx, ty1 = this.ty;
    const a2 = mx.a, b2 = mx.c, c2 = mx.b, d2 = mx.d, tx2 = mx.tx, ty2 = mx.ty;
    return new Matrix(
      a2 * a1 + b2 * b1,
      a2 * c1 + b2 * d1,
      c2 * a1 + d2 * b1,
      c2 * c1 + d2 * d1,
      a2 * tx1 + b2 * ty1 + tx2,
      c2 * tx1 + d2 * ty1 + ty2
    );
  }

  /**
   * 逆行列
   */
  invert(): Matrix | null {
    const a = this.a;
    const b = this.b;
    const c = this.c;
    const d = this.d;
    const tx = this.tx;
    const ty = this.ty;
    const det = a * d - b * c;
    
    if (det && !isNaN(det) && isFinite(tx) && isFinite(ty)) {
      return new Matrix(
        d / det,
        -b / det,
        -c / det,
        a / det,
        (c * ty - d * tx) / det,
        (b * tx - a * ty) / det
      );
    }
    return null;
  }
/**
   * シアー変換
   */
  shear(shx: number, shy: number = 0, center?: Point): Matrix {
    if (center) {
      const x = center.x;
      const y = center.y;
      return this.translate(x, y)
        .shear(shx, shy)
        .translate(-x, -y);
    }
    
    return new Matrix(
      this.a + shy * this.c,
      this.b + shy * this.d,
      this.c + shx * this.a,
      this.d + shx * this.b,
      this.tx,
      this.ty
    );
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
    const det = this.a * this.d - this.b * this.c;
    return det !== 0 && !isNaN(det) && isFinite(this.tx) && isFinite(this.ty);
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
  decompose(): { scaling: Point; rotation: number; translation: Point; skewing: Point } {
    // http://dev.w3.org/csswg/css3-2d-transforms/#matrix-decomposition
    // http://www.maths-informatique-jeux.com/blog/frederic/?post/2013/12/01/Decomposition-of-2D-transform-matrices
    const { a, b, c, d, tx, ty } = this;
    const det = a * d - b * c;
    const sqrt = Math.sqrt;
    const atan2 = Math.atan2;
    const degrees = 180 / Math.PI;
    let rotate = 0;
    let scale: [number, number] = [0, 0];
    let skew: [number, number] = [0, 0];
    
    if (a !== 0 || b !== 0) {
      const r = sqrt(a * a + b * b);
      rotate = Math.acos(a / r) * (b > 0 ? 1 : -1);
      scale = [r, det / r];
      skew = [atan2(a * c + b * d, r * r), 0];
    } else if (c !== 0 || d !== 0) {
      const s = sqrt(c * c + d * d);
      // rotate = Math.PI/2 - (d > 0 ? Math.acos(-c/s) : -Math.acos(c/s));
      rotate = Math.asin(c / s) * (d > 0 ? 1 : -1);
      scale = [det / s, s];
      skew = [0, atan2(a * c + b * d, s * s)];
    } else { // a = b = c = d = 0
      scale = [0, 0];
      skew = [0, 0];
    }
    
    return {
      translation: new Point(tx, ty),
      rotation: rotate * degrees,
      scaling: new Point(scale[0], scale[1]),
      skewing: new Point(skew[0] * degrees, skew[1] * degrees)
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
    const a = this.a;
    const b = this.b;
    const c = this.c;
    const d = this.d;
    const tx = this.tx;
    const ty = this.ty;
    const det = a * d - b * c;
    
    if (det && !isNaN(det) && isFinite(tx) && isFinite(ty)) {
      const x = point.x - tx;
      const y = point.y - ty;
      
      return new Point(
        (x * d - y * c) / det,
        (y * a - x * b) / det
      );
    }
    return null;
  }

  /**
   * Canvas用（Papyrus2Dでは空実装）
   */
  applyToContext(ctx: any): void {
    if (!this.isIdentity()) {
      ctx.transform(this.a, this.b, this.c, this.d, this.tx, this.ty);
    }
  }

  /**
   * 単位行列の場合はundefinedを返し、そうでない場合は行列自身を返す
   * paper.jsの_orNullIfIdentity()メソッドに相当
   */
  _orNullIfIdentity(): Matrix | null {
    return this.isIdentity() ? null : this;
  }
}