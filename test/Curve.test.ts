import { describe, it, expect } from 'vitest';
import { Curve } from '../src/path/Curve';
import { Segment } from '../src/path/Segment';
import { Point } from '../src/basic/Point';
import { Numerical } from '../src/util/Numerical';
import { CurveGeometry } from '../src/path/CurveGeometry';
import { Path } from '../src/path/Path';

// テスト用のヘルパー関数
function testClassify(curve: Curve, expected: { type: string; roots?: number[] | null }, message?: string) {
  const info = CurveGeometry.classify(curve.getValues());
  if (expected.type) {
    expect(info.type).toBe(expected.type);
  }
  if (expected.roots !== undefined) {
    if (expected.roots === null) {
      expect(info.roots).toBeUndefined();
    } else {
      expect(info.roots).toEqual(expected.roots);
    }
  }
}

describe('Curve', () => {
  describe('classify()', () => {
    it('should classify curves correctly', () => {
      // ポイント（始点と終点が同じ）
      const point = new Curve(
        new Segment(new Point(100, 100), null, null),
        new Segment(new Point(100, 100), null, null)
      );
      
      // 直線
      const line = new Curve(
        new Segment(new Point(100, 100), null, null),
        new Segment(new Point(200, 200), null, null)
      );
      
      // カスプ
      const cusp = new Curve(
        new Segment(new Point(100, 200), null, new Point(100, -100)),
        new Segment(new Point(200, 200), new Point(-100, -100), null)
      );
      
      // ループ
      const loop = new Curve(
        new Segment(new Point(100, 200), null, new Point(150, -100)),
        new Segment(new Point(200, 200), new Point(-150, -100), null)
      );
      
      // 蛇行曲線（1つの変曲点）
      const single = new Curve(
        new Segment(new Point(100, 100), null, new Point(50, 0)),
        new Segment(new Point(200, 200), new Point(-27, -46), null)
      );
      
      // 蛇行曲線（2つの変曲点）
      const double = new Curve(
        new Segment(new Point(100, 200), null, new Point(100, -100)),
        new Segment(new Point(200, 200), new Point(-40, -80), null)
      );
      
      // アーチ
      const arch = new Curve(
        new Segment(new Point(100, 100), null, new Point(50, 0)),
        new Segment(new Point(200, 200), new Point(0, -50), null)
      );
      
      testClassify(point, { type: 'line', roots: null });
      testClassify(line, { type: 'line', roots: null });
      testClassify(cusp, { type: 'cusp', roots: [0.5] });
      testClassify(loop, { type: 'loop', roots: [0.17267316464601132, 0.8273268353539888] });
      testClassify(single, { type: 'serpentine', roots: [0.870967741935484] });
      testClassify(double, { type: 'serpentine', roots: [0.15047207654837885, 0.7384168123405099] });
      testClassify(arch, { type: 'arch', roots: null });
    });
  });

  describe('getPointAtTime()', () => {
    it('should return correct points at given time parameters', () => {
      // 円の最初のセグメントでテスト
      const path = new Path();
      path.add(new Segment(new Point(0, 100)));
      path.add(new Segment(new Point(100, 0)));
      
      // 円の曲線に変換
      path.getSegments()[0].setHandleOut(new Point(0, -55.22847));
      path.getSegments()[1].setHandleIn(new Point(-55.22847, 0));
      
      const curve = path.getCurves()[0];
      
      // 時間パラメータでのポイント位置をテスト
      const points = [
        [0, new Point(0, 100)],
        [0.25, new Point(7.8585, 61.07549)],
        [0.5, new Point(29.28932, 29.28932)],
        [0.75, new Point(61.07549, 7.8585)],
        [1, new Point(100, 0)]
      ];
      
      for (const [t, expectedPoint] of points) {
        const point = curve.getPointAtTime(t as number);
        expect(point.x).toBeCloseTo((expectedPoint as Point).x, 4);
        expect(point.y).toBeCloseTo((expectedPoint as Point).y, 4);
      }
      
      // 範囲外のオフセットはnullを返すが、getPointAtはエラーをスローするので
      // getLocationAtでテストする
      expect(curve.getLocationAt(curve.getLength() + 1)).toBeNull();
    });
    
    it('should accurately calculate points at extreme values', () => {
      // paper.js issue #960 テスト
      const curve = new Curve(
        new Segment(new Point(178.58559999999994, 333.41440000000006), null, null),
        new Segment(new Point(178.58559999999994, 178.58560000000008), null, null)
      );
      
      expect(curve.getPointAtTime(0).y).toBe(curve.getPoint1().y);
      expect(curve.getPointAtTime(1).y).toBe(curve.getPoint2().y);
    });
  });

  describe('getTangentAtTime()', () => {
    it('should return correct tangents at given time parameters', () => {
      // 円の最初のセグメントでテスト
      const path = new Path();
      path.add(new Segment(new Point(0, 100)));
      path.add(new Segment(new Point(100, 0)));
      
      // 円の曲線に変換
      path.getSegments()[0].setHandleOut(new Point(0, -55.22847));
      path.getSegments()[1].setHandleIn(new Point(-55.22847, 0));
      
      const curve = path.getCurves()[0];
      
      const tangents = [
        [0, new Point(0, -165.68542)],
        [0.25, new Point(60.7233, -143.56602)],
        [0.5, new Point(108.57864, -108.57864)],
        [0.75, new Point(143.56602, -60.7233)],
        [1, new Point(165.68542, 0)]
      ];
      
      for (const [t, expectedTangent] of tangents) {
        // 正規化された接線をテスト
        const tangent = curve.getTangentAtTime(t as number);
        const expectedNormalized = (expectedTangent as Point).normalize();
        expect(tangent.x).toBeCloseTo(expectedNormalized.x, 4);
        expect(tangent.y).toBeCloseTo(expectedNormalized.y, 4);
        
        // 重み付き接線をテスト
        const weightedTangent = curve.getWeightedTangentAtTime(t as number);
        expect(weightedTangent.x).toBeCloseTo((expectedTangent as Point).x, 4);
        expect(weightedTangent.y).toBeCloseTo((expectedTangent as Point).y, 4);
      }
    });
  });

  describe('getNormalAtTime()', () => {
    it('should return correct normals at given time parameters', () => {
      // 円の最初のセグメントでテスト
      const path = new Path();
      path.add(new Segment(new Point(0, 100)));
      path.add(new Segment(new Point(100, 0)));
      
      // 円の曲線に変換
      path.getSegments()[0].setHandleOut(new Point(0, -55.22847));
      path.getSegments()[1].setHandleIn(new Point(-55.22847, 0));
      
      const curve = path.getCurves()[0];
      
      const normals = [
        [0, new Point(-165.68542, 0)],
        [0.25, new Point(-143.56602, -60.7233)],
        [0.5, new Point(-108.57864, -108.57864)],
        [0.75, new Point(-60.7233, -143.56602)],
        [1, new Point(0, -165.68542)]
      ];
      
      for (const [t, expectedNormal] of normals) {
        // 正規化された法線をテスト
        const normal = curve.getNormalAtTime(t as number);
        const expectedNormalized = (expectedNormal as Point).normalize();
        expect(normal.x).toBeCloseTo(expectedNormalized.x, 4);
        expect(normal.y).toBeCloseTo(expectedNormalized.y, 4);
        
        // 重み付き法線をテスト
        const weightedNormal = curve.getWeightedNormalAtTime(t as number);
        expect(weightedNormal.x).toBeCloseTo((expectedNormal as Point).x, 4);
        expect(weightedNormal.y).toBeCloseTo((expectedNormal as Point).y, 4);
      }
    });
  });

  describe('getCurvatureAtTime()', () => {
    it('should return correct curvature for a circle', () => {
      // 円の最初のセグメントでテスト
      const path = new Path();
      path.add(new Segment(new Point(0, 100)));
      path.add(new Segment(new Point(100, 0)));
      
      // 円の曲線に変換
      path.getSegments()[0].setHandleOut(new Point(0, -55.22847));
      path.getSegments()[1].setHandleIn(new Point(-55.22847, 0));
      
      const curve = path.getCurves()[0];
      
      const curvatures = [
        [0, 0.009785533905932729],
        [0.25, 0.010062133221584524],
        [0.5, 0.009937576453041297],
        [0.75, 0.010062133221584524],
        [1, 0.009785533905932727]
      ];
      
      for (const [t, expectedCurvature] of curvatures) {
        const curvature = curve.getCurvatureAtTime(t as number);
        expect(curvature).toBeCloseTo(expectedCurvature as number, 10);
      }
    });

    it('should return zero curvature for a straight line', () => {
      const curve = new Curve(
        new Segment(new Point(100, 100), null, null),
        new Segment(new Point(200, 200), null, null)
      );
      
      const curvatures = [
        [0, 0],
        [0.25, 0],
        [0.5, 0],
        [0.75, 0],
        [1, 0]
      ];
      
      for (const [t, expectedCurvature] of curvatures) {
        const curvature = curve.getCurvatureAtTime(t as number);
        expect(curvature).toBeCloseTo(expectedCurvature as number, 10);
      }
    });
  });

  describe('getTimeAt()', () => {
    it('should handle positive and negative offsets correctly', () => {
      const curve = new Curve(
        new Segment(new Point(0, 0), null, new Point(100, 0)),
        new Segment(new Point(200, 200), null, null)
      );
      
      for (let f = 0; f <= 1; f += 0.1) {
        const o1 = curve.getLength() * f;
        const o2 = -curve.getLength() * (1 - f);
        const t1 = curve.getTimeAt(o1);
        const t2 = curve.getTimeAt(o2);
        
        expect(t1).toBeCloseTo(t2, Numerical.CURVETIME_EPSILON);
        
        // papyrus2dではgetOffsetAtTimeがない
        // 代わりにgetPartLengthを使用
        if (t1 !== null) {
          const offset1 = curve.getPartLength(0, t1);
          expect(offset1).toBeCloseTo(o1);
        }
        if (t2 !== null) {
          const offset2 = curve.getPartLength(0, t2);
          expect(offset2).toBeCloseTo(curve.getLength() + o2);
        }
        
        // 異なるオフセットでの接線が同じかテスト
        const tangent1 = t1 !== null ? curve.getTangentAtTime(t1) : new Point(0, 0);
        const tangent2 = t2 !== null ? curve.getTangentAtTime(t2) : new Point(0, 0);
        if (t1 !== null && t2 !== null) {
          expect(tangent1.x).toBeCloseTo(tangent2.x, 5);
          expect(tangent1.y).toBeCloseTo(tangent2.y, 5);
        }
      }
      
      // 範囲外のオフセットはnullを返す
      expect(curve.getTimeAt(curve.getLength() + 1)).toBeNull();
    });

    it('should handle straight curves', () => {
      const path = new Path();
      const seg1 = new Segment(new Point(100, 100));
      const seg2 = new Segment(new Point(500, 500));
      path.add(seg1);
      path.add(seg2);
      const curve = path.getCurves()[0];
      
      const length = curve.getLength();
      const t = curve.getTimeAt(length / 3);
      expect(t).toBeCloseTo(0.3869631475722452, 10);
    });

    it('should handle edge cases in straight curves', () => {
      // paper.js issue #1000 テスト
      const curve = new Curve(
        new Segment(new Point(1584.4999999999998, 1053.2499999999995), null, null),
        new Segment(new Point(1520.5, 1053.2499999999995), null, null)
      );
      
      const offset = 63.999999999999716;
      expect(offset < curve.getLength()).toBe(true);
      expect(curve.getTimeAt(offset)).toBeCloseTo(1, 10);
    });

    it('should handle offset at end of curve', () => {
      // paper.js issue #1149 テスト
      const values = [-7500, 0, -7500, 4142.135623730952, -4142.135623730952, 7500, 0, 7500];
      expect(Curve.getTimeAt(values, 11782.625235553916)).toBeCloseTo(1, 10);
    });
  });

  describe('getLocationAt()', () => {
    it('should return null for out of range offset', () => {
      const curve = new Curve(
        new Segment(new Point(0, 0), null, new Point(100, 0)),
        new Segment(new Point(200, 200), null, null)
      );
      
      expect(curve.getLocationAt(curve.getLength() + 1)).toBeNull();
    });
  });

  describe('isStraight()', () => {
    it('should detect straight curves', () => {
      // ハンドルなし
      const curve1 = new Curve(
        new Segment(new Point(100, 100), null, null),
        new Segment(new Point(200, 200), null, null)
      );
      expect(CurveGeometry.isStraight(curve1.getValues())).toBe(true);
      
      // 1つ目のセグメントのみハンドルあり（方向が違う）
      const curve2 = new Curve(
        new Segment(new Point(100, 100), null, new Point(-50, -50)),
        new Segment(new Point(200, 200), null, null)
      );
      expect(CurveGeometry.isStraight(curve2.getValues())).toBe(false);
      
      // 1つ目のセグメントのみハンドルあり（方向が同じ）
      const curve3 = new Curve(
        new Segment(new Point(100, 100), null, new Point(50, 50)),
        new Segment(new Point(200, 200), null, null)
      );
      expect(CurveGeometry.isStraight(curve3.getValues())).toBe(true);
      
      // 両方のセグメントにハンドルあり（方向が同じ）
      const curve4 = new Curve(
        new Segment(new Point(100, 100), null, new Point(50, 50)),
        new Segment(new Point(200, 200), new Point(-50, -50), null)
      );
      expect(CurveGeometry.isStraight(curve4.getValues())).toBe(true);
      
      // 両方のセグメントにハンドルあり（方向が違う）
      const curve5 = new Curve(
        new Segment(new Point(100, 100), null, new Point(50, 50)),
        new Segment(new Point(200, 200), new Point(50, 50), null)
      );
      expect(CurveGeometry.isStraight(curve5.getValues())).toBe(false);
      
      // 2つ目のセグメントのみハンドルあり（方向が同じ）
      const curve6 = new Curve(
        new Segment(new Point(100, 100), null, null),
        new Segment(new Point(200, 200), new Point(-50, -50), null)
      );
      expect(CurveGeometry.isStraight(curve6.getValues())).toBe(true);
      
      // 2つ目のセグメントのみハンドルあり（方向が違う）
      const curve7 = new Curve(
        new Segment(new Point(100, 100), null, null),
        new Segment(new Point(200, 200), new Point(50, 50), null)
      );
      expect(CurveGeometry.isStraight(curve7.getValues())).toBe(false);
      
      // 点の場合
      const curve8 = new Curve(
        new Segment(new Point(100, 100), null, null),
        new Segment(new Point(100, 100), null, null)
      );
      expect(CurveGeometry.isStraight(curve8.getValues())).toBe(true);
      
      // 点にハンドルがある場合
      const curve9 = new Curve(
        new Segment(new Point(100, 100), null, new Point(50, 50)),
        new Segment(new Point(100, 100), null, null)
      );
      expect(CurveGeometry.isStraight(curve9.getValues())).toBe(false);
      
      const curve10 = new Curve(
        new Segment(new Point(100, 100), null, null),
        new Segment(new Point(100, 100), new Point(-50, -50), null)
      );
      expect(CurveGeometry.isStraight(curve10.getValues())).toBe(false);
      
      // issue #1269 テスト
      const curve11 = new Curve(
        new Segment(new Point(100, 300), null, new Point(20, -20)),
        new Segment(new Point(200, 200), new Point(-10, 10), null)
      );
      expect(CurveGeometry.isStraight(curve11.getValues())).toBe(true);
    });
  });

  describe('divide()', () => {
    it('should divide curve at offset', () => {
      const point1 = new Point(0, 0);
      const point2 = new Point(100, 0);
      const middle = point1.add(point2).divide(2);
      
      // tでの分割
      const curve = new Curve(
        new Segment(point1, null, null),
        new Segment(point2, null, null)
      );
      
      const [left, right] = curve.divide(0.5);
      expect(left.getPoint2().x).toBeCloseTo(middle.x, 8);
      expect(left.getPoint2().y).toBeCloseTo(middle.y, 8);
    });
  });

  describe('getTimesWithTangent()', () => {
    it('should find times with specified tangent direction', () => {
      const curve = new Curve(
        new Segment(new Point(0, 0), null, new Point(100, 0)),
        new Segment(new Point(200, 200), new Point(0, -100), null)
      );
      
      const tangent1 = new Point(1, 0);
      const times1 = curve.getTimesWithTangent(tangent1);
      expect(times1).toEqual([0]);
      
      const tangent2 = new Point(-1, 0);
      const times2 = curve.getTimesWithTangent(tangent2);
      expect(times2).toEqual([0]);
      
      const tangent3 = new Point(0, 1);
      const times3 = curve.getTimesWithTangent(tangent3);
      expect(times3).toEqual([1]);
      
      const tangent4 = new Point(1, 1);
      const times4 = curve.getTimesWithTangent(tangent4);
      expect(times4).toEqual([0.5]);
      
      const tangent5 = new Point(1, -1);
      const times5 = curve.getTimesWithTangent(tangent5);
      expect(times5).toEqual([]);
      
      // 自己交差曲線でのテスト
      const curve2 = new Curve(
        new Segment(new Point(0, 0), null, new Point(100, 0)),
        new Segment(new Point(-500, -500), new Point(500, -500), null)
      );
      
      const tangent6 = new Point(1, 0);
      const times6 = curve2.getTimesWithTangent(tangent6);
      expect(times6.length).toBe(2);
      
      // 放物線曲線でのテスト
      const curve3 = new Curve(
        new Segment(new Point(0, 0), null, new Point(100, 0)),
        new Segment(new Point(0, -100), new Point(0, -100), null)
      );
      
      const tangent7 = new Point(1, 0);
      const times7 = curve3.getTimesWithTangent(tangent7);
      expect(times7.length).toBe(2);
    });
  });

  describe('getTimeOf()', () => {
    it('should find time parameter for point on curve', () => {
      const path = new Path();
      
      // 長方形を作成
      const topLeft = new Point(300, 100);
      const size = new Point(100, 100);
      
      path.add(new Segment(topLeft));
      path.add(new Segment(new Point(topLeft.x + size.x, topLeft.y)));
      path.add(new Segment(new Point(topLeft.x + size.x, topLeft.y + size.y)));
      path.add(new Segment(new Point(topLeft.x, topLeft.y + size.y)));
      path.setClosed(true);
      
      const curves = path.getCurves();
      
      // パス上の点を10単位ごとにテスト
      let totalLength = 0;
      for (const curve of curves) {
        totalLength += curve.getLength();
      }
      
      for (let pos = 0; pos < totalLength; pos += 10) {
        let point1: Point | null = null;
        let distance = 0;
        
        // パス上のpos位置の点を見つける
        for (const curve of curves) {
          const curveLength = curve.getLength();
          if (distance + curveLength > pos) {
            const t = curve.getTimeAt(pos - distance);
            if (t >= 0) {
              point1 = curve.getPointAtTime(t);
              break;
            }
          }
          distance += curveLength;
        }
        
        let point2: Point | null = null;
        
        // point1がパス上にあるか確認
        for (const curve of curves) {
          const time = curve.getTimeOf(point1!);
          if (time !== null) {
            const loc = curve.getLocationAtTime(time);
            if (loc !== null) {
              point2 = loc.point;
              break;
            }
          }
        }
        
        // 変換前後の点が一致するか
        if (point1 && point2) {
          expect(point1.x).toBeCloseTo(point2.x, 8);
          expect(point1.y).toBeCloseTo(point2.y, 8);
        }
      }
    });
  });

  describe('getPartLength()', () => {
    it('should calculate partial curve length correctly for straight curve', () => {
      const curve = new Curve(
        new Segment(new Point(0, 0), null, null),
        new Segment(new Point(64, 0), null, null)
      );
      
      // Paper.jsと一致させる
      expect(curve.getPartLength(0.0, 0.25)).toBeCloseTo(10, 8);
      expect(curve.getPartLength(0.25, 0.5)).toBeCloseTo(22, 8);
      expect(curve.getPartLength(0.25, 0.75)).toBeCloseTo(44, 8);
      expect(curve.getPartLength(0.5, 0.75)).toBeCloseTo(22, 8);
      expect(curve.getPartLength(0.75, 1)).toBeCloseTo(10, 8);
    });
  });
});