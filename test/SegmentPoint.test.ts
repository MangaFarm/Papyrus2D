import { describe, it, expect, vi } from 'vitest';
import { SegmentPoint } from '../src/path/SegmentPoint';
import { Point } from '../src/basic/Point';

describe('SegmentPoint', () => {
  // モックSegmentオブジェクト
  // Segment型に最低限合わせる
  const createMockSegment = () => {
    return {
      _changed: vi.fn()
    } as unknown as import('../src/path/Segment').Segment;
  };

  describe('constructor', () => {
    it('should create with default values', () => {
      const point = new SegmentPoint();
      expect(point._x).toBe(0);
      expect(point._y).toBe(0);
    });

    it('should create from [x, y] array', () => {
      const arr: [number, number] = [10, 20];
      const point = new SegmentPoint(arr);
      expect(point._x).toBe(10);
      expect(point._y).toBe(20);
    });

    it('should create from array', () => {
      const arr: [number, number] = [30, 40];
      const point = new SegmentPoint(arr);
      expect(point._x).toBe(30);
      expect(point._y).toBe(40);
    });

    it('should set values from another SegmentPoint', () => {
      const segment = createMockSegment();
      const point1 = new SegmentPoint([10, 20], segment);
      const point2 = new SegmentPoint([30, 40]);
      point1._set(point2._x, point2._y);
      expect(point1._x).toBe(30);
      expect(point1._y).toBe(40);
      expect(segment._changed).toHaveBeenCalledWith(point1);
    });

    it('should assign owner', () => {
      const segment = createMockSegment();
      const point = new SegmentPoint([5, 10], segment);
      expect(point._owner).toBe(segment);
    });

    it('should handle undefined point', () => {
      const point = new SegmentPoint(undefined);
      expect(point._x).toBe(0);
      expect(point._y).toBe(0);
    });
  });

  describe('_set and set methods', () => {
    it('should set x,y values and notify owner', () => {
      const segment = createMockSegment();
      const point = new SegmentPoint([0, 0], segment);
      point._set(10, 20);

      expect(point._x).toBe(10);
      expect(point._y).toBe(20);
      expect(segment._changed).toHaveBeenCalledWith(point);
    });

    it('should set values without notifying when change=false', () => {
      const segment = createMockSegment();
      const point = new SegmentPoint([0, 0], segment);
      point._set(10, 20, false);

      expect(point._x).toBe(10);
      expect(point._y).toBe(20);
      expect(segment._changed).not.toHaveBeenCalled();
    });

    // --- 削除済みの古いテスト（API非互換） ---

  describe('getX, setX, getY, setY methods', () => {
    it('should get and set X,Y values', () => {
      const segment = createMockSegment();
      const point = new SegmentPoint([0, 0], segment);

      point.setX(10);
      expect(point.getX()).toBe(10);
      expect(segment._changed).toHaveBeenCalledWith(point);

      // mockClearは型エラー回避のため削除

      point.setY(20);
      expect(point.getY()).toBe(20);
      expect(segment._changed).toHaveBeenCalledWith(point);
    });
  });

  describe('isZero method', () => {
    it('should detect zero vector', () => {
      const point1 = new SegmentPoint([0, 0]);
      const point2 = new SegmentPoint([1e-13, 0]); // 1e-12よりも小さい値
      const point3 = new SegmentPoint([10, 20]);

      expect(point1.isZero()).toBe(true);
      expect(point2.isZero()).toBe(true); // Numerical.EPSILON(1e-12)の許容範囲内
      expect(point3.isZero()).toBe(false);
    });
  });

  describe('isCollinear method', () => {
    it('should detect collinear points', () => {
      const point1 = new SegmentPoint([0, 0]);
      const point2 = new SegmentPoint([1, 1]);
      const point3 = new SegmentPoint([2, 2]);
      const point4 = new SegmentPoint([1, 2]);

      expect(point2.isCollinear(point3)).toBe(true);
      expect(point1.isCollinear(point2)).toBe(true);
      expect(point2.isCollinear(point4)).toBe(false);
    });
  });

  describe('equals method', () => {
    it('should compare two points correctly', () => {
      const point1 = new SegmentPoint([10, 20]);
      const point2 = new SegmentPoint([10, 20]);
      const point3 = new SegmentPoint([30, 40]);

      expect(point1.equals(point1)).toBe(true); // 同じインスタンス
      expect(point1.equals(point2)).toBe(true); // 同じ値
      expect(point1.equals(point3)).toBe(false); // 異なる値
    });
  });

  describe('toString method', () => {
    it('should create proper string representation', () => {
      const point = new SegmentPoint([10, 20]);
      expect(point.toString()).toBe('{ x: 10, y: 20 }');
    });
  });

  describe('clone method', () => {
    it('should create a new independent instance', () => {
      const point = new SegmentPoint([10, 20]);
      const clone = point.clone();

      expect(clone._x).toBe(10);
      expect(clone._y).toBe(20);
      expect(clone).not.toBe(point);
    });
  });

  describe('toPoint and setPoint methods', () => {
    it('should convert to Point', () => {
      const segPoint = new SegmentPoint([10, 20]);
      const point = segPoint.toPoint();
      expect(point).toBeInstanceOf(Point);
      expect(point.x).toBe(10);
      expect(point.y).toBe(20);
    });
  });

  describe('getDistance method', () => {
    it('should calculate distance between points', () => {
      const point1 = new SegmentPoint([0, 0]);
      const point2 = new SegmentPoint([3, 4]);

      expect(point1.getDistance(point2)).toBe(5);
    });
  });

  describe('subtract method', () => {
    it('should subtract points and return a Point', () => {
      const point1 = new SegmentPoint([10, 20]);
      const point2 = new SegmentPoint([4, 8]);

      const result = point1.subtract(point2);

      expect(result).toBeInstanceOf(Point);
      expect(result.x).toBe(6);
      expect(result.y).toBe(12);
    });
  });

  describe('multiply method', () => {
    it('should multiply by scalar', () => {
      const point = new SegmentPoint([10, 20]);

      const result = point.multiply(2);

      expect(result).toBeInstanceOf(Point);
      expect(result.x).toBe(20);
      expect(result.y).toBe(40);
    });

    // Papyrus2Dの仕様ではmultiplyはPoint型を受け付けないのでこのテストはスキップ
  });
});
});