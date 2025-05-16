// vitest形式への変換: PathBoolean.test.ts (Papyrus2D正式API対応)
import { describe, it, expect } from 'vitest';
import { Path } from '../src/path/Path';
import { PathItem, fromPathData } from '../src/path/PathItem';
import { CompoundPath } from '../src/path/CompoundPath';
import { PathConstructors } from '../src/path/PathConstructors';
import { unite, subtract, intersect, exclude, divide } from '../src/path/PathBoolean';
import { calculateBounds, comparePaths, saveAsPng } from '../src/util/PathPixelComparator';
import { Matrix } from '../src/basic/Matrix';

// QUnitのcompareBoolean/equals/testをvitest形式に変換
async function compareBoolean(f: () => PathItem, expected: string, message?: string) {
  const expectedPath = fromPathData(expected);
  const actualPath = f();
  const bounds = calculateBounds([expectedPath, actualPath]);
  saveAsPng(expectedPath, `${message}-expected.png`, bounds);
  saveAsPng(actualPath, `${message}-actual.png`, bounds);
  // expect((actualPath as Path).getPathData(Matrix.identity(), 5), message).toBe(expected);
  expect(await comparePaths(expectedPath, actualPath), message).toBe(true);
}

describe('Path Boolean Operations', () => {
  async function testOperations(path1: any, path2: any, results: string[]) {
    await compareBoolean(() => unite(path1, path2), results[0], 'unite1');
    await compareBoolean(() => unite(path2, path1), results[0], 'unite2');
    await compareBoolean(() => subtract(path1, path2), results[1], 'subtract1');
    await compareBoolean(() => subtract(path2, path1), results[2], 'subtract2');
    await compareBoolean(() => intersect(path1, path2), results[3], 'intersect1');
    await compareBoolean(() => intersect(path2, path1), results[3], 'intersect2');
    await compareBoolean(() => exclude(path1, path2), results[4], 'exclude1');
    await compareBoolean(() => exclude(path2, path1), results[4], 'exclude2');
  }

  it('Boolean operations without crossings', async () => {
    const path1 = PathConstructors.Rectangle({
      point: { x: 0, y: 0 },
      size: { width: 200, height: 200 },
    });
    const path2 = PathConstructors.Rectangle({
      point: { x: 50, y: 50 },
      size: { width: 100, height: 100 },
    });
    const path3 = PathConstructors.Rectangle({
      point: { x: 250, y: 50 },
      size: { width: 100, height: 100 },
    });

    await testOperations(path1, path2, [
      'M0,200v-200h200v200z',
      'M0,200v-200h200v200zM150,150v-100h-100v100z',
      '',
      'M50,150v-100h100v100z',
      'M0,200v-200h200v200zM150,150v-100h-100v100z',
    ]);

    // testOperations(path1, path3, [
    //   'M0,200v-200h200v200zM250,150v-100h100v100z',
    //   'M0,200v-200h200v200z',
    //   'M350,150v-100h-100v100z',
    //   '',
    //   'M0,200v-200h200v200zM250,150v-100h100v100z',
    // ]);
  });

  it.skip('frame.intersect(rect)', () => {
    const rectPath1 = PathConstructors.Rectangle({ point: { x: 140, y: 10 }, size: { width: 100, height: 300 } });
    const rectPath2 = PathConstructors.Rectangle({ point: { x: 150, y: 80 }, size: { width: 50, height: 80 } });

    const frame = new CompoundPath();
    frame.addChild(PathConstructors.Rectangle({ point: { x: 140, y: 10 }, size: { width: 100, height: 300 } }));
    frame.addChild(PathConstructors.Rectangle({ point: { x: 150, y: 80 }, size: { width: 50, height: 80 } }));
    console.log(frame.getPathData());
    const rect = PathConstructors.Rectangle({ point: { x: 50, y: 50 }, size: { width: 100, height: 150 } });

    const intersectedPath = intersect(frame, rect);

    const bounds = calculateBounds([rectPath1, rectPath2, frame, intersectedPath])
    saveAsPng(rectPath1, 'rectPath1.png', bounds);
    saveAsPng(rectPath2, 'rectPath2.png', bounds);
    saveAsPng(frame, 'frame.png', bounds);

    saveAsPng(intersectedPath, 'intersected.png', bounds);
    // saveAsPng((intersectedPath as Path).getPathData(), 'intersectedPath.png');

    compareBoolean(() => intersect(frame, rect), 'M140,50l10,0l0,150l-10,0z');
  });

  it.skip('PathItem#resolveCrossings()', () => {
    const paths = [
      'M100,300l0,-50l50,-50l-50,0l150,0l-150,0l50,0l-50,0l100,0l-100,0l0,-100l200,0l0,200z',
      'M50,300l0,-150l50,25l0,-75l200,0l0,200z M100,200l50,0l-50,-25z',
      'M330.1,388.5l-65,65c0,0 -49.1,-14.5 -36.6,-36.6c12.5,-22.1 92.4,25.1 92.4,25.1c0,0 -33.3,-73.3 -23.2,-85.9c10,-12.8 32.4,32.4 32.4,32.4z',
      'M570,290l5.8176000300452415,33.58556812220928l-28.17314339506561,-14.439003967264455l31.189735425395614,-4.568209255479985c-5.7225406635552645e-9,-3.907138079739525e-8 -59.366611385062015,8.695139599513823 -59.366611385062015,8.695139599513823z',
      'M228.26666666666668,222.72h55.46666666666667c3.05499999999995,0 5.546666666666624,2.4916666666666742 5.546666666666624,5.546666666666681v55.46666666666667c0,3.05499999999995 -2.4916666666666742,5.546666666666624 -5.546666666666624,5.546666666666624h-55.46666666666667c-3.055000000000007,0 -5.546666666666681,-2.4916666666666742 -5.546666666666681,-5.546666666666624v-55.46666666666667c0,-3.055000000000007 2.4916666666666742,-5.546666666666681 5.546666666666681,-5.546666666666681zM283.73333399705655,289.2799999999998c-2.212411231994338e-7,1.1368683772161603e-13 2.212409526691772e-7,0 0,0z',
    ];
    const results = [
      'M100,300l0,-50l50,-50l-50,0l0,-100l200,0l0,200z',
      'M50,300l0,-150l50,25l0,-75l200,0l0,200z M100,200l50,0l-50,-25z',
      'M291.85631,426.74369l-26.75631,26.75631c0,0 -49.1,-14.5 -36.6,-36.6c7.48773,-13.23831 39.16013,-1.61018 63.35631,9.84369z M330.1,388.5l-22.09831,22.09831c-8.06306,-21.54667 -15.93643,-47.46883 -10.30169,-54.49831c10,-12.8 32.4,32.4 32.4,32.4z M320.9,442c0,0 -12.84682,-7.58911 -29.04369,-15.25631l16.14539,-16.14539c6.38959,17.07471 12.89831,31.40169 12.89831,31.40169z',
      'M570,290l5.8176,33.58557l-28.17314,-14.439c-14.32289,2.0978 -28.17688,4.12693 -28.17688,4.12693z',
      'M228.26666666666668,222.72h55.46666666666667c3.05499999999995,0 5.546666666666624,2.4916666666666742 5.546666666666624,5.546666666666681v55.46666666666667c0,3.05499999999995 -2.4916666666666742,5.546666666666624 -5.546666666666624,5.546666666666624h-55.46666666666667c-3.055000000000007,0 -5.546666666666681,-2.4916666666666742 -5.546666666666681,-5.546666666666624v-55.46666666666667c0,-3.055000000000007 2.4916666666666742,-5.546666666666681 5.546666666666681,-5.546666666666681z',
    ];
    for (let i = 0; i < paths.length; i++) {
      const path = Path.fromPathData(paths[i]);
      const result = Path.fromPathData(results[i]);
      path._style.fillRule = 'evenodd';
      const resolved = path.resolveCrossings();
      compareBoolean(
        () => resolved,
        result.getPathData(),
        'path.resolveCrossings(); // Test ' + (i + 1)
      );
    }
  });
});
