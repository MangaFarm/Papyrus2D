import { describe, it } from 'vitest';
import { Curve } from '../src/path/Curve';
import { Segment } from '../src/path/Segment';
import { Point } from '../src/basic/Point';
import { Path } from '../src/path/Path';

describe('Curve_getTimeOf_debug', () => {
  it('should debug getTimeOf accuracy for rectangle path', () => {
    const path = new Path();
    const topLeft = new Point(300, 100);
    const size = new Point(100, 100);

    path.add(new Segment(topLeft));
    path.add(new Segment(new Point(topLeft.x + size.x, topLeft.y)));
    path.add(new Segment(new Point(topLeft.x + size.x, topLeft.y + size.y)));
    path.add(new Segment(new Point(topLeft.x, topLeft.y + size.y)));
    path.setClosed(true);

    const curves = path.getCurves();

    let totalLength = 0;
    for (const curve of curves) {
      totalLength += curve.getLength();
    }

    for (let pos = 0; pos < totalLength; pos += 10) {
      let point1: Point | null = null;
      let distance = 0;

      for (const curve of curves) {
        const curveLength = curve.getLength();
        if (distance + curveLength > pos) {
          const t = curve.getTimeAt(pos - distance);
          if (t !== null && t >= 0) {
            point1 = curve.getPointAtTime(t);
            // getTimeOfのデバッグ
            const t2 = curve.getTimeOf(point1);
            let point2: Point | null = null;
            if (t2 !== null) {
              const loc = curve.getLocationAtTime(t2);
              if (loc !== null) {
                point2 = loc.getPoint();
              }
            }
            const dx = point1.x - (point2?.x ?? NaN);
            const dy = point1.y - (point2?.y ?? NaN);
            const dist = Math.sqrt(dx * dx + dy * dy);
            // 🔥デバッグ出力
            // t, t2, point1, point2, 誤差
            // eslint-disable-next-line no-console
            break;
          }
        }
        distance += curveLength;
      }
    }
  });
});