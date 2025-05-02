import { Point } from './Point';
import { Size } from './Size';

/**
 * Rectangle（イミュータブル設計）
 * - topLeft（x, y）, width, height で矩形領域を表現
 * - すべての操作は新しいRectangleインスタンスを返す
 */
export class Rectangle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;

  constructor(x: number, y: number, width: number, height: number);
  constructor(topLeft: Point, size: Size);
  constructor(from: Point, to: Point);
  constructor(rect: Rectangle);
  constructor(
    arg0: number | Point | Rectangle,
    arg1?: number | Size | Point,
    arg2?: number,
    arg3?: number
  ) {
    if (typeof arg0 === 'number' && typeof arg1 === 'number' && typeof arg2 === 'number' && typeof arg3 === 'number') {
      this.x = arg0;
      this.y = arg1;
      this.width = arg2;
      this.height = arg3;
    } else if (arg0 instanceof Point && arg1 instanceof Size) {
      this.x = arg0.x;
      this.y = arg0.y;
      this.width = arg1.width;
      this.height = arg1.height;
    } else if (arg0 instanceof Point && arg1 instanceof Point) {
      const x1 = arg0.x, y1 = arg0.y, x2 = arg1.x, y2 = arg1.y;
      this.x = Math.min(x1, x2);
      this.y = Math.min(y1, y2);
      this.width = Math.abs(x2 - x1);
      this.height = Math.abs(y2 - y1);
    } else if (arg0 instanceof Rectangle) {
      this.x = arg0.x;
      this.y = arg0.y;
      this.width = arg0.width;
      this.height = arg0.height;
    } else {
      throw new Error('Invalid Rectangle constructor arguments');
    }
    Object.freeze(this);
  }

  get topLeft(): Point {
    return new Point(this.x, this.y);
  }

  get bottomRight(): Point {
    return new Point(this.x + this.width, this.y + this.height);
  }

  get center(): Point {
    return new Point(this.x + this.width / 2, this.y + this.height / 2);
  }

  get size(): Size {
    return new Size(this.width, this.height);
  }

  clone(): Rectangle {
    return new Rectangle(this.x, this.y, this.width, this.height);
  }

  equals(rect: Rectangle): boolean {
    return (
      rect instanceof Rectangle &&
      this.x === rect.x &&
      this.y === rect.y &&
      this.width === rect.width &&
      this.height === rect.height
    );
  }

  toString(): string {
    return `{ x: ${this.x}, y: ${this.y}, width: ${this.width}, height: ${this.height} }`;
  }

  /**
   * 指定点が矩形内に含まれるか判定
   */
  contains(point: Point): boolean {
    return (
      point.x >= this.x &&
      point.x <= this.x + this.width &&
      point.y >= this.y &&
      point.y <= this.y + this.height
    );
  }

  /**
   * 他の矩形と交差しているか判定
   */
  /**
   * 他の矩形と交差しているか判定
   * @param rect 判定対象の矩形
   * @param epsilon 許容誤差（デフォルトは0）
   */
  intersects(rect: Rectangle, epsilon: number = 0): boolean {
    return !(
      rect.x > this.x + this.width + epsilon ||
      rect.x + rect.width < this.x - epsilon ||
      rect.y > this.y + this.height + epsilon ||
      rect.y + rect.height < this.y - epsilon
    );
  }

  /**
   * 他の矩形と合体した最小矩形を返す
   */
  unite(rect: Rectangle): Rectangle {
    const x1 = Math.min(this.x, rect.x);
    const y1 = Math.min(this.y, rect.y);
    const x2 = Math.max(this.x + this.width, rect.x + rect.width);
    const y2 = Math.max(this.y + this.height, rect.y + rect.height);
    return new Rectangle(x1, y1, x2 - x1, y2 - y1);
  }
}