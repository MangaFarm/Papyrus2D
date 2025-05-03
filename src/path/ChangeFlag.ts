/**
 * 変更フラグ定数
 * paper.jsのChangeFlagに相当
 */
export enum ChangeFlag {
  NONE = 0,
  GEOMETRY = 1,
  STROKE = 2,
  FILL = 4,
  SEGMENTS = 8,
  SELECTION = 16,
  ATTRIBUTE = 32,
  CONTENT = 64,
  PIXELS = 128,
  CHILDREN = 256,
  MATRIX = 512,
  VIEW = 1024,
  STYLE = 2048,
  ALL = 4095
}