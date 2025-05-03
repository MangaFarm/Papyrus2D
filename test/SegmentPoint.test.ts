import { describe, it, expect, vi } from 'vitest';
import { SegmentPoint } from '../src/path/SegmentPoint';
import { Point } from '../src/basic/Point';

describe('SegmentPoint', () => {
  // モックSegmentオブジェクト
  const createMockSegment = () => {
    return {
      _changed: vi.fn(),
      point: null,
      handleIn: null,
      handleOut: null
    };
  };

  describe('constructor', () => {
    it('should create with default values', () => {
      const point = new SegmentPoint();
      expect(point._x).toBe(0);
      expect(point._y).toBe(0);
    });

    it('should create from Point object', () => {
      const p = new Point(10, 20);
      const point = new SegmentPoint(p);
      expect(point._x).toBe(10);
      expect(point._y).toBe(20);
    });

    it('should create from array', () => {
      const point = new SegmentPoint([30, 40]);
      expect(point._x).toBe(30);
      expect(point._y).toBe(40);
    });

    it('should create from x,y values', () => {
      const point = new SegmentPoint(50, 60);
      expect(point._x).toBe(50);
      expect(point._y).toBe(60);
    });

    it('should assign owner and key', () => {
      const segment = createMockSegment();
      const point = new SegmentPoint(new Point(5, 10), segment, 'point');
      expect(point._owner).toBe(segment);
      expect(segment.point).toBe(point);
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
      const point = new SegmentPoint(new Point(0, 0), segment, 'point');
      point._set(10, 20);
      
      expect(point._x).toBe(10);
      expect(point._y).toBe(20);
      expect(segment._changed).toHaveBeenCalledWith(point);
    });

    it('should set values without notifying when change=false', () => {
      const segment = createMockSegment();
      const point = new SegmentPoint(new Point(0, 0), segment, 'point');
      point._set(10, 20, false);
      
      expect(point._x).toBe(10);
      expect(point._y).toBe(20);
      expect(segment._changed).not.toHaveBeenCalled();
    });

    it('should set values from another SegmentPoint', () => {
      const segment = createMockSegment();
      const point1 = new SegmentPoint(new Point(10, 20), segment, 'point');
      const point2 = new SegmentPoint(new Point(30, 40));
      
      point1.set(point2);
      
      expect(point1._x).toBe(30);
      expect(point1._y).toBe(40);
      expect(segment._changed).toHaveBeenCalledWith(point1);
    });
  });

  describe('getX, setX, getY, setY methods', () => {
    it('should get and set X,Y values', () => {
      const segment = createMockSegment();
      const point = new SegmentPoint(new Point(0, 0), segment, 'point');
      
      point.setX(10);
      expect(point.getX()).toBe(10);
      expect(segment._changed).toHaveBeenCalledWith(point);
      
      segment._changed.mockClear();
      
      point.setY(20);
      expect(point.getY()).toBe(20);
      expect(segment._changed).toHaveBeenCalledWith(point);
    });
  });

  describe('isZero method', () => {
    it('should detect zero vector', () => {
      const point1 = new SegmentPoint(new Point(0, 0));
      const point2 = new SegmentPoint(new Point(1e-13, 0)); // 1e-12よりも小さい値
      const point3 = new SegmentPoint(new Point(10, 20));
      
      expect(point1.isZero()).toBe(true);
      expect(point2.isZero()).toBe(true); // Numerical.EPSILON(1e-12)の許容範囲内
      expect(point3.isZero()).toBe(false);
    });
  });

  describe('isCollinear method', () => {
    it('should detect collinear points', () => {
      const point1 = new SegmentPoint(new Point(0, 0));
      const point2 = new SegmentPoint(new Point(1, 1));
      const point3 = new SegmentPoint(new Point(2, 2));
      const point4 = new SegmentPoint(new Point(1, 2));
      
      expect(point2.isCollinear(point3)).toBe(true);
      expect(point1.isCollinear(point2)).toBe(true);
      expect(point2.isCollinear(point4)).toBe(false);
    });
  });

  describe('equals method', () => {
    it('should compare two points correctly', () => {
      const point1 = new SegmentPoint(new Point(10, 20));
      const point2 = new SegmentPoint(new Point(10, 20));
      const point3 = new SegmentPoint(new Point(30, 40));
      
      expect(point1.equals(point1)).toBe(true); // 同じインスタンス
      expect(point1.equals(point2)).toBe(true); // 同じ値
      expect(point1.equals(point3)).toBe(false); // 異なる値
    });
  });

  describe('toString method', () => {
    it('should create proper string representation', () => {
      const point = new SegmentPoint(new Point(10, 20));
      expect(point.toString()).toBe('{ x: 10, y: 20 }');
    });
  });

  describe('clone method', () => {
    it('should create a new independent instance', () => {
      const point = new SegmentPoint(new Point(10, 20));
      const clone = point.clone();
      
      expect(clone._x).toBe(10);
      expect(clone._y).toBe(20);
      expect(clone).not.toBe(point);
    });
  });

  describe('toPoint and setPoint methods', () => {
    it('should convert to and from Point', () => {
      const segment = createMockSegment();
      const segPoint = new SegmentPoint(new Point(10, 20), segment, 'point');
      
      const point = segPoint.toPoint();
      expect(point).toBeInstanceOf(Point);
      expect(point.x).toBe(10);
      expect(point.y).toBe(20);
      
      segment._changed.mockClear();
      
      segPoint.setPoint(new Point(30, 40));
      expect(segPoint._x).toBe(30);
      expect(segPoint._y).toBe(40);
      expect(segment._changed).toHaveBeenCalledWith(segPoint);
    });
  });

  describe('getDistance method', () => {
    it('should calculate distance between points', () => {
      const point1 = new SegmentPoint(new Point(0, 0));
      const point2 = new SegmentPoint(new Point(3, 4));
      
      expect(point1.getDistance(point2)).toBe(5);
    });
  });

  describe('subtract method', () => {
    it('should subtract points and return a Point', () => {
      const point1 = new SegmentPoint(new Point(10, 20));
      const point2 = new SegmentPoint(new Point(4, 8));
      
      const result = point1.subtract(point2);
      
      expect(result).toBeInstanceOf(Point);
      expect(result.x).toBe(6);
      expect(result.y).toBe(12);
    });
  });

  describe('multiply method', () => {
    it('should multiply by scalar', () => {
      const point = new SegmentPoint(new Point(10, 20));
      
      const result = point.multiply(2);
      
      expect(result).toBeInstanceOf(Point);
      expect(result.x).toBe(20);
      expect(result.y).toBe(40);
    });

    it('should multiply by Point', () => {
      const point = new SegmentPoint(new Point(10, 20));
      
      const result = point.multiply(new Point(3, 4));
      
      expect(result).toBeInstanceOf(Point);
      expect(result.x).toBe(30);
      expect(result.y).toBe(80);
    });
  });
});