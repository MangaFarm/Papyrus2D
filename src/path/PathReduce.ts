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
    const curves = path.getCurves();
    // TODO: Find a better name, to not confuse with PathItem#simplify()
    const simplify = options && options.simplify;
    // When not simplifying, only remove curves if their lengths are absolutely 0.
    const tolerance = simplify ? Numerical.GEOMETRIC_EPSILON : 0;
    for (let i = curves.length - 1; i >= 0; i--) {
        const curve = curves[i];
        // When simplifying, compare curves with isCollinear() will remove
        // any collinear neighboring curves regardless of their orientation.
        // This serves as a reliable way to remove linear overlaps but only
        // as long as the lines are truly overlapping.
        if (
            !curve.hasHandles() &&
            (!curve.hasLength(tolerance) ||
                (simplify && (() => {
                    const next = curve.getNext();
                    return next ? curve.isCollinear(next) : false;
                })()))
        ) {
            curve.remove();
        }
    }
    return path;
}