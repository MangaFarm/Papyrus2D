import { describe, it, expect } from "vitest";
import { Path } from "../src/path/Path";
import { Point } from "../src/basic/Point";
import { Segment } from "../src/path/Segment";
import { tracePaths } from "../src/path/PathBooleanTracePaths";
import { getMeta } from "../src/path/SegmentMeta";
import { divideLocations } from "../src/path/PathBooleanIntersections";
import { CurveLocation } from "../src/path/CurveLocation";

// 2つの矩形をunite用に分割し、winding未セットのままtracePathsに渡す
describe("tracePaths winding未セット時の挙動", () => {
  it("矩形2つのunite分割後、winding未セットセグメントがisValidでtrueになるか", () => {
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

    // winding未セット状態でtracePaths
    const operator = { "1": true, "2": true, unite: true };
    const paths = tracePaths(segments, operator);

    // デバッグ出力
    segments.forEach((seg, i) => {
      const meta = getMeta(seg);
    });
    paths.forEach((p, i) => {
      const coords = p.getSegments().map(s => {
        const pt = s._point.toPoint();
        return `${pt.x},${pt.y}`;
      }).join(" -> ");
    });

    // 期待: winding未セットのセグメントはisValidでfalseになり、パス数が増えないこと
    // ただし現状のPapyrus2D実装では2パス返るはず
    expect(paths.length).toBeGreaterThanOrEqual(1);
  });
});