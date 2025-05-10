import { Resvg } from '@resvg/resvg-js';

/**
 * 2つのSVG pathDataをピクセル単位で比較するユーティリティ
 * 
 * - キャンバスサイズは固定（例: 200x200）
 * - SVG pathDataは中央に配置
 * - 完全一致で比較（将来的に許容誤差も対応可能）
 */

const CANVAS_SIZE = 512;

function createSVG(pathData: string): string {
    // pathを中央に配置するためviewBoxを設定
    return `
<svg width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}" xmlns="http://www.w3.org/2000/svg">
  <path d="${pathData}" fill="black" stroke="none"/>
</svg>
`.trim();
}

function createSVG2(pathData1: string, color: string, pathData2: string, color2: string): string {
    // pathを中央に配置するためviewBoxを設定

    return `
<svg width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}" xmlns="http://www.w3.org/2000/svg">
  <path d="${pathData1}" fill="${color}" stroke="none"/>
  <path d="${pathData2}" fill="${color2}" stroke="none"/>
</svg>
`.trim();
}

async function renderToBuffer(svg: string): Promise<Uint8Array> {
    const resvg = new Resvg(svg, {
        fitTo: {
            mode: 'width',
            value: CANVAS_SIZE,
        },
        background: 'white',
    });
    const rendered = resvg.render();
    // RGBAバッファを返す
    return rendered.pixels;
}

export async function saveAsPng(pathData: string, filename: string): Promise<void> {
    const svg = createSVG(pathData);
    const resvg = new Resvg(svg, {
        fitTo: {
            mode: 'width',
            value: CANVAS_SIZE,
        },
        background: 'white',
    });
    const rendered = resvg.render();
    const buffer = rendered.asPng();
    const fs = require('fs');
    fs.writeFileSync(filename, buffer);
}   

export async function saveAsPng2(pathData1: string, pathData2: string, filename: string): Promise<void> {
    const svg = createSVG2(pathData1, 'red', pathData2, 'blue');
    const resvg = new Resvg(svg, {
        fitTo: {
            mode: 'width',
            value: CANVAS_SIZE,
        },
        background: 'white',
    });
    const rendered = resvg.render();
    const buffer = rendered.asPng();
    const fs = require('fs');
    fs.writeFileSync(filename, buffer);
}

/**
 * 2つのSVG pathDataをピクセル単位で比較する
 * @param pathData1 SVG pathData文字列
 * @param pathData2 SVG pathData文字列
 * @returns 完全一致ならtrue、そうでなければfalse
 */
export async function comparePaths(pathData1: string, pathData2: string): Promise<boolean> {
    const svg1 = createSVG(pathData1);
    const svg2 = createSVG(pathData2);

    const [buf1, buf2] = await Promise.all([
        renderToBuffer(svg1),
        renderToBuffer(svg2),
    ]);

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