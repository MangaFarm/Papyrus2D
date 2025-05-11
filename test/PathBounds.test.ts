import { describe, it, expect } from 'vitest';
import { Path } from '../src/path/Path';
import { Segment } from '../src/path/Segment';
import { Point } from '../src/basic/Point';
import { Rectangle } from '../src/basic/Rectangle';

describe('Path Bounds', () => {
  it('getBounds', () => {
    const path1 = new Path([
      new Segment(new Point(10, 10)),
      new Segment(new Point(40, 40)),
      new Segment(new Point(70, 50)),
      new Segment(new Point(50, 20)),
    ]);
    
    const bounds = path1.getBounds(null, {});
    expect(bounds).toEqual(new Rectangle(10, 10, 60, 40));
  });

  it('getStrokeBounds', () => {
    const path1 = new Path([
      new Segment(new Point(10, 10)),
      new Segment(new Point(40, 40)),
      new Segment(new Point(70, 50)),
      new Segment(new Point(50, 20)),
    ]);
    const style = path1.getStyle();
    style.strokeColor = { alpha: 1 };
    style.strokeWidth = 10;
    style.strokeJoin = 'round';
    style.strokeCap = 'round';
    
    const bounds = path1.getBounds(null, { stroke: true });
    expect(bounds).toEqual(new Rectangle(5, 5, 70, 50));
  });

});
