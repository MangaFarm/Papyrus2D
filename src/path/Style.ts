/**
 * Style クラス
 * Paper.js の Style (src/style/Style.js) を参考にしたスタイル情報管理クラス。
 * 主にストローク情報取得用。
 */

export type StrokeJoin = 'miter' | 'bevel' | 'round';
export type StrokeCap = 'butt' | 'square' | 'round';
export type FillRule = 'nonzero' | 'evenodd';

export class Style {
  strokeColor: { alpha: number } | null;
  strokeWidth: number;
  strokeJoin: StrokeJoin;
  strokeCap: StrokeCap;
  strokeScaling: boolean;
  miterLimit: number;
  fillRule: FillRule;

  constructor(params?: Partial<Style>) {
    this.strokeColor = params?.strokeColor ?? null;
    this.strokeWidth = params?.strokeWidth ?? 1;
    this.strokeJoin = params?.strokeJoin ?? 'miter';
    this.strokeCap = params?.strokeCap ?? 'butt';
    this.strokeScaling = params?.strokeScaling ?? true;
    this.miterLimit = params?.miterLimit ?? 10;
    this.fillRule = params?.fillRule ?? 'nonzero';
  }

  hasStroke(): boolean {
    // Paper.js: return !!color && color.alpha > 0 && this.getStrokeWidth() > 0;
    return !!this.strokeColor && this.strokeColor.alpha > 0 && this.strokeWidth > 0;
  }

  getStrokeWidth(): number {
    return this.strokeWidth;
  }
  getStrokeJoin(): StrokeJoin {
    return this.strokeJoin;
  }
  getStrokeCap(): StrokeCap {
    return this.strokeCap;
  }
  getMiterLimit(): number {
    return this.miterLimit;
  }
  getStrokeScaling(): boolean {
    return this.strokeScaling;
  }
  getFillRule(): FillRule {
    return this.fillRule;
  }

  setStrokeWidth(width: number): void {
    this.strokeWidth = width;
  }
  setStrokeJoin(join: StrokeJoin): void {
    this.strokeJoin = join;
  }
  setStrokeCap(cap: StrokeCap): void {
    this.strokeCap = cap;
  }
  setMiterLimit(limit: number): void {
    this.miterLimit = limit;
  }
  setStrokeScaling(scaling: boolean): void {
    this.strokeScaling = scaling;
  }
  setFillRule(rule: FillRule): void {
    this.fillRule = rule;
  }

  StrokeColor(color: { alpha: number } | null): void {
    this.strokeColor = color;
  }

  clone(): Style {
    return new Style({
      strokeColor: this.strokeColor,
      strokeWidth: this.strokeWidth,
      strokeJoin: this.strokeJoin,
      strokeCap: this.strokeCap,
      strokeScaling: this.strokeScaling,
      miterLimit: this.miterLimit,
      fillRule: this.fillRule,
    });
  }
}