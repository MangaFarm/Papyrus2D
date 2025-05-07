// paper.js Path#reduce の精密移植
// 参照元: /paper.js/src/path/Path.js

import { Path } from './Path';
import { Curve } from './Curve';
import { Numerical } from '../util/Numerical';

/**
 * Pathをreduce（不要なカーブやコリニアなセグメントを除去）する。
 * paper.jsのアルゴリズムを忠実に移植。
 * @param path 対象のPath
 * @param options { simplify?: boolean }
 *   - simplify: trueの場合、コリニアな直線も除去
 * @returns reduce後のPath（破壊的操作）
 */
export function reducePath(path: Path, options?: { simplify?: boolean }): Path {
    // 🔥DEBUG: reduction start
    if (path.closed) {
        console.log("🔥[reducePath] before reduction (closed):", path.getSegments().map(s => s.getPoint().toString()));
    } else {
        console.log("🔥[reducePath] before reduction (open):", path.getSegments().map(s => s.getPoint().toString()));
    }

    const curves = path.getCurves();
    const simplify = options && options.simplify;
    const tolerance = simplify ? Numerical.GEOMETRIC_EPSILON : 0;
    for (let i = curves.length - 1; i >= 0; i--) {
        const curve = curves[i];
        if (
            !curve.hasHandles() &&
            (!curve.hasLength(tolerance) ||
                (simplify && (() => {
                    const next = curve.getNext();
                    return next ? curve.isCollinear(next) : false;
                })()))
        ) {
            console.log("🔥[reducePath] removing curve at", i, "seg1:", curve._segment1.getPoint().toString(), "seg2:", curve._segment2.getPoint().toString());
            curve.remove();
        }
    }

    if (path.closed) {
        console.log("🔥[reducePath] after reduction (closed):", path.getSegments().map(s => s.getPoint().toString()));
    } else {
        console.log("🔥[reducePath] after reduction (open):", path.getSegments().map(s => s.getPoint().toString()));
    }
    return path;
}