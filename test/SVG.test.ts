import { describe, it, expect } from 'vitest';
import { Path } from '../src/path/Path';

describe('SVG', () => {
  it('foo', () => {
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
});
