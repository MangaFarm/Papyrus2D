/**
 * Papyrus2D Size クラス（イミュータブル設計, TypeScript）
 * paper.js の Size 実装をベースに、イミュータブル・副作用なし・グローバル排除で再設計
 */

export class Size {
  readonly width: number;
  readonly height: number;

  constructor(width: number = 0, height: number = 0) {
    this.width = width;
    this.height = height;
    Object.freeze(this);
  }

  equals(other: Size): boolean {
    return other instanceof Size && this.width === other.width && this.height === other.height;
  }

  clone(): Size {
    return new Size(this.width, this.height);
  }

  add(other: Size): Size {
    return new Size(this.width + other.width, this.height + other.height);
  }

  subtract(other: Size): Size {
    return new Size(this.width - other.width, this.height - other.height);
  }

  multiply(value: number | Size): Size {
    if (value instanceof Size) {
      return new Size(this.width * value.width, this.height * value.height);
    }
    return new Size(this.width * value, this.height * value);
  }

  divide(value: number | Size): Size {
    if (value instanceof Size) {
      return new Size(this.width / value.width, this.height / value.height);
    }
    return new Size(this.width / value, this.height / value);
  }

  isZero(): boolean {
    return this.width === 0 && this.height === 0;
  }

  toString(): string {
    return `{ width: ${this.width}, height: ${this.height} }`;
  }
}