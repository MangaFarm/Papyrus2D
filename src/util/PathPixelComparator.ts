import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';
import { Rectangle } from '../basic/Rectangle';
import { PathItem } from '../path/PathItem';
import { Path } from '../path/Path';
import { CompoundPath } from '../path/CompoundPath';
import { Matrix } from '../basic/Matrix';

const CANVAS_WIDTH = 256;
const CANVAS_HEIGHT = 256;

const colors = [
  '#FF0000', // red
  '#00FF00', // green
  '#0000FF', // blue
  '#FFFF00', // yellow
  '#FF00FF', // magenta
  '#00FFFF', // cyan
];

function calculateBounds(paths: Path[]): Rectangle {
  let bounds = paths[0].getBounds(null, { stroke: true });
  for (let i = 1; i < paths.length; i++) {
    const pathBounds = paths[i].getBounds(null, { stroke: true });
    bounds = bounds.unite(pathBounds);
  }
  return bounds;
}

function createSVG(paths: Path[], bounds: Rectangle): string {
  // 通常bounding box, stroke bounding boxを計算
  let combinedPathData = '';
  let colorIndex = 0;
  for (const path of paths) {
    const pathData = path.getPathData(Matrix.identity(), 0);
    combinedPathData += `<path d="${pathData}" fill="${colors[colorIndex]}" stroke="none"/>`;
    colorIndex = (colorIndex + 1) % colors.length;
  }

  // pathを中央に配置するためviewBoxを設定
  return `
<svg 
  width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" 
  viewBox="${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}" 
  align="meet" xmlns="http://www.w3.org/2000/svg">
  ${combinedPathData}
</svg>
`.trim();
}

async function renderToBuffer(svg: string): Promise<Uint8Array> {
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'original',
    },
    background: 'white',
  });
  const rendered = resvg.render();
  // RGBAバッファを返す
  return rendered.pixels;
}

export async function saveAsPng(pathItem: PathItem, filename: string): Promise<void> {
  const bounds = calculateBounds(pathItem.getPaths());
  const svg = createSVG(pathItem.getPaths(), bounds);
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'original',
    },
    background: 'white',
  });
  const rendered = resvg.render();
  const buffer = rendered.asPng();
  fs.writeFileSync('output/' + filename, buffer);
}

/**
 * 2つのSVG pathDataをピクセル単位で比較する
 * @param pathData1 SVG pathData文字列
 * @param pathData2 SVG pathData文字列
 * @returns 完全一致ならtrue、そうでなければfalse
 */
export async function comparePaths(path1: Path, path2: Path): Promise<boolean> {
  const bounds = calculateBounds([path1, path2]);
  const svg1 = createSVG([path1], bounds);
  const svg2 = createSVG([path2], bounds);

  const [buf1, buf2] = await Promise.all([renderToBuffer(svg1), renderToBuffer(svg2)]);

  if (buf1.length !== buf2.length) {
    return false;
  }
  for (let i = 0; i < buf1.length; i++) {
    if (buf1[i] !== buf2[i]) {
      return false;
    }
  }
  return true;
}
