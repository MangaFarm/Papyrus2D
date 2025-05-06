import { describe, it, expect } from "vitest";
import { Path } from "../src/path/Path";
import { Point } from "../src/basic/Point";
import { Segment } from "../src/path/Segment";
import { divideLocations } from "../src/path/PathBooleanIntersections";
import { CurveLocation } from "../src/path/CurveLocation";
import { getMeta } from "../src/path/SegmentMeta";
import { tracePaths } from "../src/path/PathBooleanTracePaths";
import { propagateWinding } from "../src/path/PathBooleanWinding";

describe("tracePaths 下位API最小ケース", () => {
  it("2矩形の交点分割後のセグメント集合をtracePathsに渡したときの返り値", () => {
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
    divideLocations(locs);

    // 2パスの全セグメントを集める
    const segments = [
      ...path1.getSegments(),
      ...path2.getSegments()
    ];

    // operator: unite
    const operator = { "1": true, "2": true, unite: true };

    // propagateWindingをすべてのセグメントに呼ぶ
    for (const seg of segments) {
      propagateWinding(seg, path1, path2, {}, operator);
    }

    const paths = tracePaths(segments, operator);

    // デバッグ出力
    console.log("🔥 tracePaths: paths.length =", paths.length);
    for (let i = 0; i < paths.length; i++) {
      const segs = paths[i].getSegments();
      const coords = segs.map(s => {
        const pt = s._point.toPoint();
        return `${pt.x},${pt.y}`;
      }).join(" -> ");
      const metaIds = segs.map(s => {
        const meta = getMeta(s);
        return meta && meta.path ? meta.path._id : "none";
      }).join(",");
      console.log(`🔥 tracePaths: paths[${i}].coords = ${coords}`);
      console.log(`🔥 tracePaths: paths[${i}].meta.path.id = ${metaIds}`);
    }

    // パス数は2つ以上であること（分断現象の観察用）
    expect(paths.length).toBeGreaterThanOrEqual(1);
  });
});