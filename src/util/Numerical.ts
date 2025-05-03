/**
 * Papyrus2D - Numerical Utility Functions (from paper.js)
 * MIT License
 *
 * 数値計算用ユーティリティ関数・定数群
 * paper.jsのsrc/util/Numerical.jsをTypeScript化・イミュータブル設計で移植
 */

/**
 * 範囲の境界を表すインターフェース
 */
export interface Bounds {
    min: number;
    max: number;
}

const abs = Math.abs;
const sqrt = Math.sqrt;
const pow = Math.pow;
const log2 = Math.log2 || ((x: number) => Math.log(x) * Math.LOG2E);

const EPSILON = 1e-12;
const MACHINE_EPSILON = 1.12e-16;

function clamp(value: number, min: number, max: number): number {
    return value < min ? min : value > max ? max : value;
}

function getDiscriminant(a: number, b: number, c: number): number {
    // d = b^2 - a * c  computed accurately enough by a tricky scheme.
    // Ported from @hkrish's polysolve.c
    function split(v: number): [number, number] {
        const x = v * 134217729;
        const y = v - x;
        const hi = y + x; // Don't optimize y away!
        const lo = v - hi;
        return [hi, lo];
    }

    let D = b * b - a * c;
    const E = b * b + a * c;
    if (abs(D) * 3 < E) {
        const ad = split(a);
        const bd = split(b);
        const cd = split(c);
        const p = b * b;
        const dp = (bd[0] * bd[0] - p + 2 * bd[0] * bd[1]) + bd[1] * bd[1];
        const q = a * c;
        const dq = (ad[0] * cd[0] - q + ad[0] * cd[1] + ad[1] * cd[0]) + ad[1] * cd[1];
        D = (p - q) + (dp - dq); // Don't omit parentheses!
    }
    return D;
}

function getNormalizationFactor(...args: number[]): number {
    // Normalize coefficients à la Jenkins & Traub's RPOLY.
    // Normalization is done by scaling coefficients with a power of 2, so
    // that all the bits in the mantissa remain unchanged.
    // Use the infinity norm (max(sum(abs(a)…)) to determine the appropriate
    // scale factor. See @hkrish in #1087#issuecomment-231526156
    const norm = Math.max.apply(Math, args);
    return norm && (norm < 1e-8 || norm > 1e8)
        ? pow(2, -Math.round(log2(norm)))
        : 0;
}

export const Numerical = {
    EPSILON,
    MACHINE_EPSILON,
    // paper.jsと同じ値に調整
    CURVETIME_EPSILON: 1e-8,
    GEOMETRIC_EPSILON: 1e-7,
    TRIGONOMETRIC_EPSILON: 1e-8,
    ANGULAR_EPSILON: 1e-5,
    KAPPA: 4 * (sqrt(2) - 1) / 3,

    isZero(val: number): boolean {
        return val >= -EPSILON && val <= EPSILON;
    },

    isMachineZero(val: number): boolean {
        return val >= -MACHINE_EPSILON && val <= MACHINE_EPSILON;
    },

    clamp,

    getNormalizationFactor,

    /**
     * Gauss-Legendre Numerical Integration.
     */
    integrate(f: (x: number) => number, a: number, b: number, n: number): number {
        // Lookup tables for abscissas and weights with values for n = 2 .. 16.
        // As values are symmetric, only store half of them and adapt algorithm
        // to factor in symmetry.
        n = Math.min(n, 16); // 配列長に合わせて上限を16に制限
        const abscissas = [
            [0.5773502691896257],
            [0, 0.7745966692414834],
            [0.3399810435848563, 0.8611363115940526],
            [0, 0.5384693101056831, 0.906179845938664],
            [0.2386191860831969, 0.6612093864662645, 0.932469514203152],
            [0, 0.4058451513773972, 0.7415311855993944, 0.9491079123427585],
            [0.1834346424956498, 0.525532409916329, 0.7966664774136267, 0.9602898564975363],
            [0, 0.3242534234038089, 0.6133714327005904, 0.8360311073266358, 0.9681602395076261],
            [0.1488743389816312, 0.4333953941292472, 0.6794095682990244, 0.8650633666889845, 0.9739065285171717],
            [0, 0.269543155952345, 0.5190961292068118, 0.7301520055740493, 0.8870625997680953, 0.978228658146057],
            [0.1252334085114689, 0.3678314989981802, 0.5873179542866174, 0.7699026741943047, 0.9041172563704749, 0.9815606342467193],
            [0, 0.2304583159551348, 0.44849275103644685, 0.6423493394403402, 0.8015780907333099, 0.917598399222978, 0.9841830547185881],
            [0.10805494870734366, 0.31911236892788976, 0.5152486363581541, 0.6872929048116855, 0.827201315069765, 0.9284348836635735, 0.9862838086968123],
            [0, 0.20119409399743452, 0.39415134707756337, 0.5709721726085388, 0.7244177313601701, 0.8482065834104272, 0.9372733924007059, 0.9879925180204854],
            [0.09501250983763744, 0.2816035507792589, 0.4580167776572274, 0.6178762444026437, 0.755404408355003, 0.8656312023878317, 0.9445750230732326, 0.9894009349916499]
        ];
        const weights = [
            [1],
            [0.8888888888888888, 0.5555555555555556],
            [0.6521451548625461, 0.34785484513745385],
            [0.5688888888888889, 0.47862867049936647, 0.23692688505618908],
            [0.46791393457269105, 0.3607615730481386, 0.17132449237917035],
            [0.4179591836734694, 0.38183005050511894, 0.27970539148927667, 0.1294849661688697],
            [0.36268378337836196, 0.3137066458778873, 0.22238103445337447, 0.10122853629037626],
            [0.33023935500125976, 0.31234707704000284, 0.26061069640293546, 0.1806481606948574, 0.08127438836157441],
            [0.29552422471475287, 0.26926671930999636, 0.21908636251598204, 0.1494513491505806, 0.06667134430868814],
            [0.27292508677790063, 0.26280454451024666, 0.23319376459199048, 0.18629021092773425, 0.12558036946490462, 0.05566856711617367],
            [0.24914704581340278, 0.2334925365383548, 0.20316742672306592, 0.16007832854334623, 0.10693932599531843, 0.04717533638651183],
            [0.2325515532308739, 0.22628318026289724, 0.2078160475368885, 0.17814598076194574, 0.13887351021978724, 0.09212149983772845, 0.04048400476531588],
            [0.2152638534631578, 0.2051984637212956, 0.1855383974779378, 0.15720316715819353, 0.12151857068790318, 0.08015808715976021, 0.03511946033175186],
            [0.20257824192556127, 0.19843148532711158, 0.1861610000155622, 0.16626920581699393, 0.1395706779261543, 0.10715922046717194, 0.07036604748810812, 0.030753241996117268],
            [0.1894506104550685, 0.1826034150449236, 0.16915651939500254, 0.14959598881657673, 0.12462897125553387, 0.09515851168249278, 0.06225352393864789, 0.027152459411754095]
        ];
        const x = abscissas[n - 2];
        const w = weights[n - 2];
        const A = (b - a) * 0.5;
        const B = A + a;
        let i = 0;
        const m = (n + 1) >> 1;
        let sum = n & 1 ? w[i++] * f(B) : 0;
        while (i < m) {
            const Ax = A * x[i];
            sum += w[i] * (f(B + Ax) + f(B - Ax));
            i++;
        }
        return A * sum;
    },

    /**
     * Root finding using Newton-Raphson Method combined with Bisection.
     */
    findRoot(
        f: (x: number) => number,
        df: (x: number) => number,
        x: number,
        a: number,
        b: number,
        n: number,
        tolerance: number
    ): number {
        for (let i = 0; i < n; i++) {
            const fx = f(x);
            const dx = fx / df(x);
            const nx = x - dx;
            if (abs(dx) < tolerance) {
                x = nx;
                break;
            }
            if (fx > 0) {
                b = x;
                x = nx <= a ? (a + b) * 0.5 : nx;
            } else {
                a = x;
                x = nx >= b ? (a + b) * 0.5 : nx;
            }
        }
        return clamp(x, a, b);
    },

    /**
     * Solve a quadratic equation in a numerically robust manner;
     * given a quadratic equation ax² + bx + c = 0, find the values of x.
     *
     * References:
     *  Kahan W. - "To Solve a Real Cubic Equation"
     *  http://www.cs.berkeley.edu/~wkahan/Math128/Cubic.pdf
     *  Blinn J. - "How to solve a Quadratic Equation"
     *  Harikrishnan G.
     *  https://gist.github.com/hkrish/9e0de1f121971ee0fbab281f5c986de9
     */
    solveQuadratic(
        a: number,
        b: number,
        c: number,
        roots: number[],
        bounds?: Bounds
    ): number {
        let x1: number = 0, x2: number = Infinity;
        if (abs(a) < EPSILON) {
            if (abs(b) < EPSILON)
                return abs(c) < EPSILON ? -1 : 0;
            x1 = -c / b;
        } else {
            b *= -0.5;
            let D = getDiscriminant(a, b, c);
            if (D && abs(D) < MACHINE_EPSILON) {
                const f = getNormalizationFactor(abs(a), abs(b), abs(c));
                if (f) {
                    a *= f;
                    b *= f;
                    c *= f;
                    D = getDiscriminant(a, b, c);
                }
            }
            if (D >= -MACHINE_EPSILON) {
                const Q = D < 0 ? 0 : sqrt(D);
                const R = b + (b < 0 ? -Q : Q);
                if (R === 0) {
                    x1 = c / a;
                    x2 = -x1;
                } else {
                    x1 = R / a;
                    x2 = c / R;
                }
            }
        }
        let count = 0;
        const boundless = bounds == null;
        if (isFinite(x1) && (boundless || (x1 > bounds.min - EPSILON && x1 < bounds.max + EPSILON)))
            roots[count++] = boundless ? x1 : clamp(x1, bounds.min, bounds.max);
        if (x2 !== x1
                && isFinite(x2) && (boundless || (x2 > bounds.min - EPSILON && x2 < bounds.max + EPSILON)))
            roots[count++] = boundless ? x2 : clamp(x2, bounds.min, bounds.max);
        return count;
    },

    /**
     * Solve a cubic equation, using numerically stable methods,
     * given an equation of the form ax³ + bx² + cx + d = 0.
     *
     * This algorithm avoids the trigonometric/inverse trigonometric
     * calculations required by the "Italins"' formula. Cardano's method
     * works well enough for exact computations, this method takes a
     * numerical approach where the double precision error bound is kept
     * very low.
     *
     * References:
     *  Kahan W. - "To Solve a Real Cubic Equation"
     *   http://www.cs.berkeley.edu/~wkahan/Math128/Cubic.pdf
     *  Harikrishnan G.
     *  https://gist.github.com/hkrish/9e0de1f121971ee0fbab281f5c986de9
     */
    solveCubic(
        a: number,
        b: number,
        c: number,
        d: number,
        roots: number[],
        bounds?: Bounds
    ): number {
        const f = getNormalizationFactor(abs(a), abs(b), abs(c), abs(d));
        // TypeScriptでは初期値を設定する必要がある
        let x: number = 0, b1: number = 0, c2: number = 0, qd: number = 0, q: number = 0;
        let _a = a, _b = b, _c = c, _d = d;
        if (f) {
            _a *= f;
            _b *= f;
            _c *= f;
            _d *= f;
        }

        function evaluate(x0: number) {
            x = x0;
            // Evaluate q, q', b1 and c2 at x
            const tmp = _a * x;
            b1 = tmp + _b;
            c2 = b1 * x + _c;
            qd = (tmp + b1) * x + c2;
            q = c2 * x + _d;
        }

        if (abs(_a) < EPSILON) {
            _a = _b;
            b1 = _c;
            c2 = _d;
            x = Infinity;
        } else if (abs(_d) < EPSILON) {
            b1 = _b;
            c2 = _c;
            x = 0;
        } else {
            // Here onwards we iterate for the leftmost root. Proceed to
            // deflate the cubic into a quadratic (as a side effect to the
            // iteration) and solve the quadratic.
            evaluate(-(_b / _a) / 3);
            // Get a good initial approximation.
            const t = q / _a;
            const r = pow(abs(t), 1 / 3);
            const s = t < 0 ? -1 : 1;
            const td = -qd / _a;
            // See Kahan's notes on why 1.324718*... works.
            const rd = td > 0 ? 1.324717957244746 * Math.max(r, sqrt(td)) : r;
            let x0 = x - s * rd;
            if (x0 !== x) {
                do {
                    evaluate(x0);
                    // Newton's. Divide by 1 + MACHINE_EPSILON (1.000...002)
                    // to avoid x0 crossing over a root.
                    x0 = qd === 0 ? x : x - q / qd / (1 + MACHINE_EPSILON);
                } while (s * x0 > s * x);
                // Adjust the coefficients for the quadratic.
                if (abs(_a) * x * x > abs(_d / x)) {
                    c2 = -_d / x;
                    b1 = (c2 - _c) / x;
                }
            }
        }
        // The cubic has been deflated to a quadratic.
        let count = Numerical.solveQuadratic(_a, b1, c2, roots, bounds);
        const boundless = bounds == null;
        if (isFinite(x) && (count === 0
                || count > 0 && x !== roots[0] && x !== roots[1])
                && (boundless || (x > bounds.min - EPSILON && x < bounds.max + EPSILON))) {
            roots[count++] = boundless ? x : clamp(x, bounds.min, bounds.max);
        }
        return count;
    }
};