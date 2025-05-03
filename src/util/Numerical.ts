/*
 * Paper.js - The Swiss Army Knife of Vector Graphics Scripting.
 * http://paperjs.org/
 *
 * Copyright (c) 2011 - 2020, Jürg Lehni & Jonathan Puckey
 * http://juerglehni.com/ & https://puckey.studio/
 *
 * Distributed under the MIT license. See LICENSE file for details.
 *
 * All rights reserved.
 */

import { NumericalImp } from './NumericalImp';

/**
 * 範囲制限のためのインターフェース
 */
export interface RangeConstraint {
  min: number;
  max: number;
}

/**
 * Numerical型定義
 * 数値計算に関するユーティリティ関数と定数を提供する名前空間
 */
export namespace Numerical {
  // 定数
  /**
   * 非常に小さい絶対値。値がゼロに非常に近いかどうかをチェックするために使用される。
   * 浮動小数点ノイズを相殺するのに十分な大きさであるべきだが、
   * 公称範囲での計算において意味を持つのに十分小さいべき。
   */
  export const EPSILON: number = NumericalImp.EPSILON;

  /**
   * 倍精度（JavaScriptのNumber）のマシンイプシロンは2.220446049250313e-16。
   * このマシンイプシロン定数は、64ビット浮動小数点（jsのNumber）での
   * 加算、乗算によって導入される誤差がδとεより小さくなるような定数δとεを指す。
   */
  export const MACHINE_EPSILON: number = NumericalImp.MACHINE_EPSILON;

  /**
   * 曲線時間パラメータを扱う際に使用するイプシロン。
   * 再帰的な分割の結果として、ベジェ太線クリッピングコードでは
   * 誤差が約2e-7まで蓄積するため、これより小さくすることはできない。
   */
  export const CURVETIME_EPSILON: number = NumericalImp.CURVETIME_EPSILON;

  /**
   * 点と線の間の距離など、「幾何学的」チェックを実行する際に使用するイプシロン。
   */
  export const GEOMETRIC_EPSILON: number = NumericalImp.GEOMETRIC_EPSILON;

  /**
   * 共線性をチェックするための外積の検査など、「三角法」チェックを実行する際に使用するイプシロン。
   */
  export const TRIGONOMETRIC_EPSILON: number = NumericalImp.TRIGONOMETRIC_EPSILON;

  /**
   * 角度チェックを度単位で実行する際に使用するイプシロン（例：arcTo()）。
   */
  export const ANGULAR_EPSILON: number = NumericalImp.ANGULAR_EPSILON;

  /**
   * Kappaは、ベジェ曲線で円を描く際に曲線ハンドルをスケーリングする値。
   */
  export const KAPPA: number = NumericalImp.KAPPA;

  /**
   * 値がNumerical.EPSILONで定義された許容範囲内で0かどうかをチェックする。
   * @param val チェックする値
   * @returns 値が許容範囲内で0の場合はtrue
   */
  export function isZero(val: number): boolean {
    return NumericalImp.isZero(val);
  }

  /**
   * 値がMACHINE_EPSILONで定義された許容範囲内で0かどうかをチェックする。
   * @param val チェックする値
   * @returns 値が許容範囲内で0の場合はtrue
   */
  export function isMachineZero(val: number): boolean {
    return NumericalImp.isMachineZero(val);
  }

  /**
   * 指定された範囲によって値を制限した数値を返す。
   * @param value 制限する値
   * @param min 範囲の下限
   * @param max 範囲の上限
   * @returns [min, max]の範囲内の数値
   */
  export function clamp(value: number, min: number, max: number): number {
    return NumericalImp.clamp(value, min, max);
  }

  /**
   * ガウス・ルジャンドル数値積分。
   * @param f 積分する関数
   * @param a 積分の下限
   * @param b 積分の上限
   * @param n 積分点の数
   * @returns 積分値
   */
  export function integrate(f: (x: number) => number, a: number, b: number, n: number): number {
    return NumericalImp.integrate(f, a, b, n);
  }

  /**
   * 二分法と組み合わせたニュートン・ラフソン法を使用した根の発見。
   * @param f 関数
   * @param df 関数の導関数
   * @param x 初期推定値
   * @param a 範囲の下限
   * @param b 範囲の上限
   * @param n 最大反復回数
   * @param tolerance 許容誤差
   * @returns 見つかった根
   */
  export function findRoot(
    f: (x: number) => number,
    df: (x: number) => number,
    x: number,
    a: number,
    b: number,
    n: number,
    tolerance: number
  ): number {
    return NumericalImp.findRoot(f, df, x, a, b, n, tolerance);
  }

  /**
   * 数値的に安定した方法で二次方程式を解く。
   * ax² + bx + c = 0の形の二次方程式が与えられた場合、xの値を求める。
   * @param a 二次項
   * @param b 一次項
   * @param c 定数項
   * @param roots 根を格納する配列
   * @param range 許容される根の範囲制限（オプション）
   * @returns 見つかった実根の数、または無限の解がある場合は-1
   */
  export function solveQuadratic(
    a: number,
    b: number,
    c: number,
    roots: number[],
    range: RangeConstraint | null = null
  ): number {
    if (range === null) {
      return NumericalImp.solveQuadratic(a, b, c, roots, undefined, undefined);
    }
    return NumericalImp.solveQuadratic(a, b, c, roots, range.min, range.max);
  }

  /**
   * 数値的に安定した方法を使用して三次方程式を解く。
   * ax³ + bx² + cx + d = 0の形の方程式が与えられた場合。
   * @param a 三次項（x³項）
   * @param b 二次項（x²項）
   * @param c 一次項（x項）
   * @param d 定数項
   * @param roots 根を格納する配列
   * @param range 許容される根の範囲制限（オプション）
   * @returns 見つかった実根の数、または無限の解がある場合は-1
   */
  export function solveCubic(
    a: number,
    b: number,
    c: number,
    d: number,
    roots: number[],
    range: RangeConstraint | null = null
  ): number {
    if (range === null) {
      return NumericalImp.solveCubic(a, b, c, d, roots, undefined, undefined);
    }
    return NumericalImp.solveCubic(a, b, c, d, roots, range.min, range.max);
  }
}