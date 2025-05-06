import { describe, it, expect } from "vitest";
import { Path } from "../src/path/Path";
import { Point } from "../src/basic/Point";
import { Segment } from "../src/path/Segment";
import { divideLocations } from "../src/path/PathBooleanIntersections";
import { CurveLocation } from "../src/path/CurveLocation";
import { getMeta } from "../src/path/SegmentMeta";

describe("divideLocations 下位API最小ケース", () => {
  it("2矩形の交点分割で生成されるセグメント・meta.pathの状態", () => {
    // 矩形1
    const path1 = new Path();
    path1.add(new Segment(new Point(0, 0)));
    path1.add(new Segment(new Point(100, 0)));
    path1.add(new Segment(new Point(100, 100)));
    path1.add(new Segment(new Point(0, 100)));
    path1.setClosed(true);

    // 矩形2（右上に重なる）
    const path2 = new Path();
    path2.add(new Segment(new Point(100, 50)));
    path2.add(new Segment(new Point(150, 50)));
    path2.add(new Segment(new Point(150, 150)));
    path2.add(new Segment(new Point(50, 150)));
    path2.add(new Segment(new Point(50, 100)));
    path2.add(new Segment(new Point(100, 100)));
    path2.setClosed(true);

    // 交点を求めて分割
    const intersections = path1.getIntersections(path2);
    const locs = CurveLocation.expand(intersections);
    const divided = divideLocations(locs);

    // デバッグ出力
    for (let i = 0; i < divided.length; i++) {
      const seg = divided[i]._segment;
      if (!seg) continue;
      const meta = getMeta(seg);
      const pt = seg._point.toPoint();
      const pathId = meta && meta._path ? meta._path._id : "none";
    }

    // すべての分割セグメントにmeta.pathがセットされていること
    for (let i = 0; i < divided.length; i++) {
      const seg = divided[i]._segment;
      if (!seg) continue;
      const meta = getMeta(seg);
      expect(meta && meta._path).toBeTruthy();
    }
  });
});