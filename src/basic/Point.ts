/**
 * Papyrus2D Point クラス（イミュータブル設計, TypeScript）
 * paper.js の Point 実装をベースに、イミュータブル・副作用なし・グローバル排除で再設計
 */

export class Point {
  readonly x: number;
  readonly y: number;

  constructor(x: number = 0, y: number = 0) {
    this.x = x;
    this.y = y;
    Object.freeze(this);
  }

  equals(other: Point): boolean {
    return other instanceof Point && this.x === other.x && this.y === other.y;
  }

  clone(): Point {
    return new Point(this.x, this.y);
  }

  add(other: Point): Point {
    return new Point(this.x + other.x, this.y + other.y);
  }

  subtract(other: Point): Point {
    return new Point(this.x - other.x, this.y - other.y);
  }

  multiply(value: number | Point): Point {
    if (value instanceof Point) {
      return new Point(this.x * value.x, this.y * value.y);
    }
    return new Point(this.x * value, this.y * value);
  }

  divide(value: number | Point): Point {
    if (value instanceof Point) {
      return new Point(this.x / value.x, this.y / value.y);
    }
    return new Point(this.x / value, this.y / value);
  }

  getLength(): number {
    return Math.hypot(this.x, this.y);
  }

  getAngle(): number {
    return (Math.atan2(this.y, this.x) * 180) / Math.PI;
  }

  normalize(length: number = 1): Point {
    const current = this.getLength();
    if (current === 0) return new Point(0, 0);
    const scale = length / current;
    return new Point(this.x * scale, this.y * scale);
  }

  rotate(angle: number, center: Point = new Point(0, 0)): Point {
    if (angle === 0) return this.clone();
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = this.x - center.x;
    const dy = this.y - center.y;
    return new Point(dx * cos - dy * sin + center.x, dx * sin + dy * cos + center.y);
  }

  toString(): string {
    return `{ x: ${this.x}, y: ${this.y} }`;
  }
}
