/**
 * Papyrus2D Size クラス（イミュータブル設計, TypeScript）
 * paper.js の Size 実装をベースに、イミュータブル・副作用なし・グローバル排除で再設計
 */

import { Numerical } from '../util/Numerical';

export class Size {
  readonly width: number;
  readonly height: number;

  constructor(width: number = 0, height: number = 0) {
    this.width = width;
    this.height = height;
    Object.freeze(this);
  }

  equals(other: Size | number[]): boolean {
    return other === this || other && (
      this.width === (other instanceof Size ? other.width : other[0]) &&
      this.height === (other instanceof Size ? other.height : other[1])
    ) || false;
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
    const { isZero } = Numerical;
    return isZero(this.width) && isZero(this.height);
  }

  isNaN(): boolean {
    return isNaN(this.width) || isNaN(this.height);
  }

  modulo(value: number | Size): Size {
    if (value instanceof Size) {
      return new Size(this.width % value.width, this.height % value.height);
    }
    return new Size(this.width % value, this.height % value);
  }

  negate(): Size {
    return new Size(-this.width, -this.height);
  }

  round(): Size {
    return new Size(Math.round(this.width), Math.round(this.height));
  }

  ceil(): Size {
    return new Size(Math.ceil(this.width), Math.ceil(this.height));
  }

  floor(): Size {
    return new Size(Math.floor(this.width), Math.floor(this.height));
  }

  abs(): Size {
    return new Size(Math.abs(this.width), Math.abs(this.height));
  }

  toString(): string {
    return `{ width: ${this.width}, height: ${this.height} }`;
  }

  static min(size1: Size, size2: Size): Size {
    return new Size(
      Math.min(size1.width, size2.width),
      Math.min(size1.height, size2.height)
    );
  }

  static max(size1: Size, size2: Size): Size {
    return new Size(
      Math.max(size1.width, size2.width),
      Math.max(size1.height, size2.height)
    );
  }

  static random(): Size {
    return new Size(Math.random(), Math.random());
  }
}