import { describe, it, expect } from 'vitest';
import { Path } from '../src/path/Path';
import { CompoundPath } from '../src/path/CompoundPath';
import { PathConstructors } from '../src/path/PathConstructors';
import { Point } from '../src/basic/Point';
import { Size } from '../src/basic/Size';
import { Rectangle } from '../src/basic/Rectangle';

// Helper function from test/PathBoolean.test.ts
function compareBoolean(actualFn: () => any, expected: any, message?: string, options?: any) {
  const actual = typeof actualFn === 'function' ? actualFn() : actualFn;
  // const tolerance = options?.tolerance ?? 1e-9; // Papyrus default tolerance

  if (expected && typeof expected === 'object' && 'pathData' in expected && typeof actual === 'object' && 'pathData' in actual) {
    // Compare Path objects by pathData
    // A more robust comparison might involve segment-by-segment checks with tolerance.
    // For now, we rely on pathData string equality, assuming normalization.
    expect(actual.pathData).toBe(expected.pathData);
  } else if (typeof actual === 'object' && actual && 'pathData' in actual && typeof expected === 'string') {
    // Compare Path object's pathData with expected SVG string
    expect(actual.pathData).toBe(expected);
  } else if (actual instanceof Path && expected instanceof Path && actual.isEmpty() && expected.isEmpty()) {
    expect(true).toBe(true); // Both are empty paths
  }
   else {
    // Fallback to direct comparison (e.g., for empty paths or other types)
    expect(actual.toString()).toBe(expected.toString());
  }
}


describe('Path Boolean Operations - Part 1', () => {
  it('#541', () => {
    const shape0 = PathConstructors.Rectangle(new Rectangle({
        point: new Point(304, 226),
        size: new Size(328, 328)
    }));
    const shape1 = new Path([
        [213.5, 239],
        [476.5, 279],
        [716, 233.5],
        [469, 74]
    ]);
    shape1.setClosed(true);
    const res1 = shape0.exclude(shape1);
    const shape2 = PathConstructors.Rectangle(new Rectangle({
        point: new Point(174, 128),
        size: new Size(309, 251)
    }));
    const res2 = res1.exclude(shape2);
    const shape3 = PathConstructors.Rectangle(new Rectangle({
        point: new Point(318, 148),
        size: new Size(302, 302)
    }));
    compareBoolean(() => res2.exclude(shape3),
        'M304,554l0,-175l14,0l0,71l302,0l0,-198.262l12,-2.27975l0,304.54175z M318,379l165,0l0,-101.23486l137,-26.02714l0,-25.738l-137,0l0,-78l-128.58788,0l-36.41212,23.51468l0,54.48532l165,0l0,51.76514l-6.5,1.23486l-158.5,-24.10646z M174,379l0,-251l211.38182,0l-30.9697,20l-36.41212,0l0,23.51468l-104.5,67.48532l90.5,13.76426l0,-26.76426l14,0l0,28.89354l-14,-2.12928l0,126.23574z M385.38182,128l83.61818,-54l114.59561,74l-100.59561,0l0,-20z M583.59561,148l36.40439,23.5081l0,-23.5081z M620,171.5081l96,61.9919l-84,15.95825l0,-23.45825l-12,0z');
  });

  it('#609', () => {
    const path1 = new Path();
    path1.moveTo(new Point(100, 100));
    (path1 as any).arcTo(new Point(100, 200)); 
    path1.closePath();

    const path2 = new Path();
    path2.moveTo(new Point(100, 200));
    (path2 as any).arcTo(new Point(100, 100));
    path2.closePath();

    compareBoolean(() => path1.unite(path2),
        'M150,150c0,27.61424 -22.38576,50 -50,50c-27.61424,0 -50,-22.38576 -50,-50c0,-27.61424 22.38576,-50 50,-50c27.61424,0 50,22.38576 50,50z');
  });

  it('#610', () => {
    const square = PathConstructors.Rectangle(new Rectangle({
        center: new Point(140, 0),
        size: new Size(300, 300)
    }));

    const inner = PathConstructors.Circle(new Point(0, 0), 100);
    const outer = PathConstructors.Circle(new Point(0, 0), 132);
    const ring = outer.subtract(inner);

    compareBoolean(() => ring.subtract(square),
        'M-132,0c0,-69.53737 53.7698,-126.51614 122,-131.62689l0,32.12064c-50.53323,5.01724 -90,47.65277 -90,99.50625c0,51.85348 39.46677,94.489 90,99.50625l0,32.12064c-68.2302,-5.11075 -122,-62.08951 -122,-131.62689z');
  });

  it('#719', () => {
    const radius = 50;
    const circle = PathConstructors.Circle(new Point(0, 0), radius);
    
    const arc = new Path();
    arc.moveTo(new Point(0, -radius));
    (arc as any).arcTo(new Point(radius, 0), new Point(0, radius));
    arc.closePath();

    const result = circle.subtract(arc);
    
    const expected = new Path(); 
    expected.moveTo(new Point(0, -radius));
    (expected as any).arcTo(new Point(radius, 0), new Point(0, radius));
    expected.closePath();
    const bounds = expected.getBounds(); 
    if (bounds) { 
        (expected as any).rotate(180, bounds.getCenter()); // Rotate around center as getLeftCenter might not be what's intended without pivot
    }

    compareBoolean(result, expected);
  });

  it('#757 (path1.intersect(pat2, { trace: false }))', () => {
    const rect = PathConstructors.Rectangle(new Rectangle({
        from: new Point(100, 250),
        to: new Point(350, 350)
    }));

    const line = new Path([
        [100, 200],
        [150, 400],
        [200, 200],
        [250, 400],
        [300, 200],
        [350, 400]
    ]);

    const resIntersect = line.intersect(rect); 

    let finalPath: Path;
    if (resIntersect instanceof CompoundPath) {
        const children = resIntersect.getPaths(); 
        if (children && children.length > 0) {
            finalPath = children[0].clone();
            for (let i = 1; i < children.length; i++) {
                const united = finalPath.unite(children[i]);
                // unite can return Path or CompoundPath, ensure finalPath is Path
                if (united instanceof Path) {
                    finalPath = united;
                } else if (united instanceof CompoundPath) {
                    finalPath = united.toPath(); // Convert CompoundPath to Path
                } else {
                    finalPath = new Path(); // Fallback for unexpected result
                }
            }
        } else {
            finalPath = new Path();
        }
    } else if (resIntersect instanceof Path) {
        finalPath = resIntersect;
    } else {
        finalPath = new Path(); 
    }
    
    compareBoolean(() => finalPath,
        'M112.5,250l25,100l25,0l25,-100l25,0l25,100l25,0l25,-100l25,0l25,100');
  });

  it('#784', () => {
    let path1 = Path.fromSVG('M495.9,1693.5c-42.2-203.5-64.5-304.9-78-299.9 c-1.7,0.6-0.3,6.7,5.3,22.5l209.4-74.8l75.8,303.9L495.9,1693.5z');
    let path2 = Path.fromSVG('M632.6,1341.2l-209.4,74.9c95.4,267,135.6,201-60.1-144.5l202.9-85.7 L632.6,1341.2z');
    compareBoolean(() => path1.unite(path2),
        'M495.9,1693.5c-17.51923,-84.48253 -31.60874,-151.36838 -43.06274,-200.34989c-9.02339,-21.58227 -18.9863,-47.24083 -29.63726,-77.05011c-5.6,-15.8 -7,-21.9 -5.3,-22.5c3.68921,-1.36638 8.03561,5.21313 13.26571,19.65076l6.17555,-2.20892c0.00094,0.00191 0.00189,0.00383 0.00283,0.00574l195.25591,-69.74757l75.8,303.9z M632.6,1341.2l-195.25874,69.84183c-19.60056,-39.73292 -44.12819,-86.27851 -74.24126,-139.44183l202.9,-85.7z');

    path1 = Path.fromSVG('M330.1,388.5l-65,65c0,0-49.1-14.5-36.6-36.6 c12.5-22.1,92.4,25.1,92.4,25.1s-33.3-73.3-23.2-85.9C307.7,343.3,330.1,388.5,330.1,388.5z');
    path2 = Path.fromSVG('M395.1,453.4c0,15.2-33.8,65-65,65s-65-65-65-65l65-65 C330.1,388.5,395.1,438.2,395.1,453.4z');
    compareBoolean(() => path1.unite(path2),
        'M265.13434,453.46566l-0.03434,0.03434c0,0 -49.1,-14.5 -36.6,-36.6c7.48073,-13.22593 39.10093,-1.6319 63.28843,9.81157l16.18604,-16.18604c-8.05354,-21.53223 -15.90287,-47.40397 -10.27447,-54.42553c9.77623,-12.51358 31.40373,30.40618 32.36674,32.33326l0.03326,-0.03326c0,0.1 65,49.8 65,65c0,15.2 -33.8,65 -65,65c-30.62393,0 -63.75273,-62.62185 -64.96566,-64.93434z');
  });

  it('#784#issuecomment-144653463', () => {
    const path1 = new Path([
        [400, 300],
        [396.4240965757225, 386.760212367686],
        [363.8902430603039, 336.3464406833805]
    ]);
    path1.setClosed(true);
    const path2 = new Path([
        [380.15716053320796, 361.5533174872367],
        [368.9579765078272, 389.3845783631412],
        [352.11749924000907, 372.22000125020173]
    ]);
    path2.setClosed(true);
    const path3 = new Path([
        [381.9248139754118, 360.88087710036456],
        [352.11749931845384, 372.22000145641056],
        [353.8723170322086, 346.9400510828104]
    ]);
    path3.setClosed(true);
    compareBoolean(() => (path1.unite(path2) as Path).unite(path3),
        'M400,300l-3.5759,86.76021l-16.26693,-25.2069l0,0l-11.19918,27.83126l-16.84048,-17.16458l1.75482,-25.27995l24.8115,12.3302l-14.79357,-22.92381z M352.1175,372.22z');
  });

  it('#784#issuecomment-144993215', () => {
    const path1 = new Path([
        [428.65986693122585, 123.24312916360232],
        [448.9732353341095, 290.23336023178985, -1.297313778199964, -0.24666929481787747, -0.06896642337790126, -0.004714867204086204],
        [448.9732339473677, 290.2333601369859, 0.22704183013848933, 0.04316939284507271, 0.24127512029406262, 0.016494695478172616],
        [375.34013306877415, 150.7568708363977]
    ]);
    path1.setClosed(true);
    compareBoolean(() => path1.unite(), 
        'M428.65987,123.24313c0,0 18.24445,159.97772 20.21157,166.76806c-3.05664,-6.18082 -73.53131,-139.25432 -73.53131,-139.25432z M448.97323,290.23336c0,0 0,0 0,0c0.22704,0.04317 -0.06896,-0.00471 0,0c-0.02659,-0.00506 -0.06063,-0.08007 -0.1018,-0.22217c0.07286,0.14733 0.10741,0.22256 0.1018,0.22217z',
        undefined, { tolerance: 1e-3 });
  });

  it('#784#issuecomment-168605018', () => {
    const path1 = new CompoundPath([
        new Path([
            [401.77542835664826, 286.9803609495646],
            [410.6261525310172, 207.97354059345616],
            [460.3783408790767, 174.43669899386418],
        ]).setClosed(true), new Path([
            [410.6261524612045, 207.9735406405153],
            [410.6261525310172, 207.97354059345614, -0.0005059167983745283, -0.0007686158121771314]
        ]).setClosed(true)
    ]);
    const path2 = new Path([
        [410.6261524612047, 207.97354064051552, 0, 0, 0.19904749518872222, 0.2952886437272184],
        [409.163896522797, 207.2586618457598, 1.6828473498011363, 0.6114523237241087],
        [460.3783408790765, 174.43669899386396]
    ]);
    path2.setClosed(true);
    compareBoolean(() => (path1 as any).unite(path2),
        'M401.77543,286.98036l8.85044,-79.00432c-0.16499,-0.13413 -0.57872,-0.39645 -1.46198,-0.71738l51.21444,-32.82196z M410.62615,207.97354c0,0 0,0 0,0z');
  });

  it('#854', () => {
    const p = new Path([
        [110, 60],
        [99.09349390368303, 54.102707245527334, 0, 0, 0.2109804080034046, -0.3885775729842338],
        [99.76298270272372, 52.95998195277986, -0.2353176636361775, 0.3732505490504639,0,0],
        [107.23497309089953, 78.84996109436266, 0, 0, -9.106249727572695, -5.544212301393825],
        [100.0593186152821, 52.32387941069251, -5.08710486250942, 9.369281629969153, 0, 0],
    ]);
    p.setClosed(true);
    (p as any).translate(new Point(100, 100));
    p.scale(4);
    
    p.setFillRule('evenodd');
    compareBoolean(() => p.unite(),
        'M228.55086,143.23924l-38.88978,-21.02822l27.82967,96.42806c-34.09062,-20.75559 -47.33495,-62.77314 -32.21096,-98.79709l-0.35495,-0.19193c0.64433,-1.18671 1.31713,-2.35551 2.01826,-3.50647c0,0 0,0 0,0c-0.58827,1.22495 -1.1426,2.45812 -1.66331,3.6984l4.38129,2.36902l-2.05829,-7.13185c-0.22261,0.3531 -0.44251,0.70791 -0.6597,1.06443c0.58173,-1.21134 1.19664,-2.41465 1.84504,-3.60884z');

    p.setFillRule('nonzero');
    compareBoolean(() => p.unite(),
        'M228.55086,143.23924l-38.88978,-21.02822l27.82967,96.42806c-34.09062,-20.75559 -47.33495,-62.77314 -32.21096,-98.79709l-0.35495,-0.19193c0.64433,-1.18671 1.31713,-2.35551 2.01826,-3.50647c0.58173,-1.21134 1.19664,-2.41465 1.84504,-3.60884z');
  });

  it('#859', () => {
    const p1 = new Path([
        [230, 360],
        [326.04999999999995, 361.95, 0, 0, 7.100000000000023, 5.300000000000011],
        [347.74999999999994, 377.3, -7.300000000000011, -5, 0, 0],
        [260, 400],
    ]);
    p1.setClosed(true);
    const p2 = new Path([
        [329.8373529833907, 360.99927475751736, 0, 0, -0.5084518552435497, 1.7136677994218417],
        [327.9816245617005, 366.0401044369074, 0.7293957729680756, -1.645975116174725, 0, 0],
        [300, 380]
    ]);
    p2.setClosed(true);
    compareBoolean(() => p1.subtract(p2),
        'M230,360l96.05,1.95c0.3523,0.26298 0.70509,0.52535 1.05835,0.78713l-27.10835,17.26287l27.98162,-13.9599c0.29878,-0.67424 0.57885,-1.35439 0.84036,-2.04026c6.22144,4.55915 12.57473,8.94859 18.92802,13.30016l-87.75,22.7z');
  });

  it('#839', () => {
    const p1 = new Path([
        [522, 352],
        [500, 400],
        [480, 400],
        [448, 448],
        [100, 448],
        [100, 352]
    ]);
    p1.setClosed(true);
    const p2 = PathConstructors.Rectangle(new Rectangle(250, 300, 100, 200));
    compareBoolean(() => p1.subtract(p2),
        'M522,352l-22,48l-20,0l-32,48l-98,0l0,-96z M250,448l-150,0l0,-96l150,0z');
  });

  it('#865', () => {
    function executeTest(offset: number) {
        const p1Original = new Path([
            [300, 100],
            [300, 350],
            [256.00000000000006, 350],
            [256.00000000000006, 250],
            [230, 224],
            [256.00000000000006, 200],
            [256.00000000000006, 100]
        ]);
        p1Original.setClosed(true);
        const p2 = new Path([
            [256, 150],
            [256, 300],
            [200, 300],
            [200, 150]
        ]);
        p2.setClosed(true);

        const p1 = p1Original.clone();
        (p1 as any).translate(new Point(offset, 0));

        compareBoolean(() => p1.subtract(p2),
                'M300,100l0,250l-44,0l0,-250z',
                'p1.subtract(p2); // with offset = ' + offset);
    }
    executeTest(0);
    executeTest(-0.0000001);
    executeTest( 0.0000001);
    executeTest(-0.000000001);
    executeTest( 0.000000001);
  });

  it('#870', () => {
    let path1 = PathConstructors.Rectangle(new Rectangle({
        point: new Point(50, 50),
        size: new Size(150, 50)
    }));

    let path2 = PathConstructors.Rectangle(new Rectangle({
        point: new Point(70, 50),
        size: new Size(150, 50)
    }));

    compareBoolean(() => path1.intersect(path2),
        'M70,50l130,0l0,50l-130,0z');

    path1 = PathConstructors.Rectangle(new Rectangle({
        point: new Point(50, 150),
        size: new Size(50, 100)
    }));

    path2 = PathConstructors.Rectangle(new Rectangle({
        point: new Point(50, 175),
        size: new Size(50, 100)
    }));

    compareBoolean(() => path1.intersect(path2),
        'M50,250l0,-75l50,0l0,75z');
  });

  it('#875', () => {
    const p1 = new Path([
        [158.7, 389.3, 0, 0, -4.95, 4.95],
        [158.7, 407.2, -4.95, -4.95, 4.95, 4.95],
        [176.6, 407.2, -4.95, 4.95, 4.95, -4.95],
        [176.6, 389.3, 4.95, 4.95, -4.95, -4.95],
        [158.7, 389.3, 4.95, -4.95, 0, 0]
    ]);
    p1.setClosed(true);
    const p2 = PathConstructors.Circle(new Point(260, 320), 100);

    compareBoolean(() => p1.subtract(p2),
        'M158.7,407.2c4.95,4.95 12.95,4.95 17.9,0c4.95,-4.95 4.95,-12.95 0,-17.9c-4.95,-4.95 -12.95,-4.95 -17.9,0c-4.95,4.95 -4.95,12.95 0,17.9z');
  });

  it('#877', () => {
    const cp = new CompoundPath([
        PathConstructors.Circle(new Point(100, 60), 50),
        PathConstructors.Circle(new Point(100, 60), 30),
        new Path([
            [120, 140],
            [150, 140],
            [150, 190],
            [120, 190]
        ]).setClosed(true),
    ]);
    cp.setFillRule('evenodd');

    const p = new Path([
        [135, 200],
        [135, 120],
        [170, 120],
        [170, 200]
    ]);
    p.setClosed(true);
    compareBoolean(() => (cp as any).subtract(p),
        'M50,60c0,-27.61424 22.38576,-50 50,-50c27.61424,0 50,22.38576 50,50c0,27.61424 -22.38576,50 -50,50c-27.61424,0 -50,-22.38576 -50,-50z M100,90c16.56854,0 30,-13.43146 30,-30c0,-16.56854 -13.43146,-30 -30,-30c-16.56854,0 -30,13.43146 -30,30c0,16.56854 13.43146,30 30,30z M120,140l15,0l0,50l-15,0z');
  });

  it('#878', () => {
    const p1 = new Path([ [431.90000000000003, 479.99999999999994], [128.00000000000003, 370], [80.00000000000003, 479.99999999999994], ]);
    p1.setClosed(true);
    const p2 = new Path([ [400, 480, 10, 0, 0, 0], [140, 480, 0, 0, -10, 0], [300, 300]]);
    p2.setClosed(true);
    compareBoolean(() => p1.unite(p2),
        'M431.9,480l-35.62956,-12.89652c-19.34292,-41.22209 -96.27044,-167.10348 -96.27044,-167.10348c0,0 -48.3459,51.18977 -91.9573,98.97235l-80.0427,-28.97235l-48,110z');

    compareBoolean(() => p1.subtract(p2),
        'M431.9,480l-35.62956,-12.89652c3.78718,8.07094 5.3669,12.89652 3.72956,12.89652z M208.0427,398.97235l-80.0427,-28.97235l-48,110l60,0c-4.6672,0 29.87455,-39.20895 68.0427,-81.02765z');
  });

  it('#885', () => {
    const p1 = PathConstructors.Rectangle(new Rectangle(100, 100, 100, 100));
    const p2 = p1.clone();
    const empty = new Path();
    compareBoolean(() => p1.unite(p2), p1);
    compareBoolean(() => p1.intersect(p2), p1);
    compareBoolean(() => p1.subtract(p2), empty);
    compareBoolean(() => p1.exclude(p2), empty);
  });

  it('#889', () => {
    const cp = new CompoundPath([
        new Path([ [340.26, 358.4], [576, 396.8], [345.78, 396.8] ]).setClosed(true),
        new Path([ [691.2, 685.76], [672, 550.4, 0, 0, 10, 0], [729.6, 608, 0, -20, 0, 0] ]).setClosed(true)
    ]);
    const p = new Path([ [739, 418], [637, 704], [205, 704], [204.30709922574619, 356.553500194953] ]);
    p.setClosed(true);
    compareBoolean(() => (cp as any).subtract(p),
        'M340.26,358.4l235.74,38.4l-21.47738,0l-212.24889,-24.39148z M691.2,685.76l-13.57151,-95.67911l11.09506,-31.10967c17.43794,12.2938 40.87645,34.99446 40.87645,49.02878z');
  });
});
