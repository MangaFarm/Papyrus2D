import { describe, it, expect } from 'vitest';
import { Path } from '../src/path/Path';
import { Segment } from '../src/path/Segment';
import { Point } from '../src/basic/Point';
import { Rectangle } from '../src/basic/Rectangle';
import { Matrix } from '../src/basic/Matrix';

describe('SVG', () => {

  it('singlePath', () => {
    const pathData = 'M0,200v-200h200v200z';
    const path = Path.fromPathData(pathData);
    const cs = path.getCurves();
  })

  it('subPath', () => {
    const pathData = 'M0,200v-200h200v200zM150,150v-100h-100v100z';
    const path = Path.fromPathData(pathData);
    const cs = path.getCurves();
  })

  it('Path.fromPathData', () => {
    const svg = 'M100,300l0,-50l50,-50l-50,0l150,0l-150,0l50,0l-50,0l100,0l-100,0l0,-100l200,0l0,200z';
    const path = Path.fromPathData(svg);
    const expected = [ 
      '{ point: { x: 100, y: 300 } }',
      '{ point: { x: 100, y: 250 } }',
      '{ point: { x: 150, y: 200 } }',
      '{ point: { x: 100, y: 200 } }',
      '{ point: { x: 250, y: 200 } }',
      '{ point: { x: 100, y: 200 } }',
      '{ point: { x: 150, y: 200 } }',
      '{ point: { x: 100, y: 200 } }',
      '{ point: { x: 200, y: 200 } }',
      '{ point: { x: 100, y: 200 } }',
      '{ point: { x: 100, y: 100 } }',
      '{ point: { x: 300, y: 100 } }',
      '{ point: { x: 300, y: 300 } }' 
    ]
    expect(path.getSegments().map(s => s && s.toString())).toEqual(expected);
  });

  it('Path.getPathData(translate, 5)', () => {
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

    const matrix = Matrix.identity().translate(-15, 5);
    const pathData = path1.getPathData(matrix, 5);
    const expected = 'M-5,15l30,30l30,10l-20,-30';
    expect(pathData).toEqual(expected);
  });

});
