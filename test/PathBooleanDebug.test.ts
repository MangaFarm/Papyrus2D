import { describe, it, expect } from 'vitest';
import { Path } from '../src/path/Path';
import { Segment } from '../src/path/Segment';
import { Point } from '../src/basic/Point';
import { getIntersections, divideLocations } from '../src/path/PathBooleanIntersections';
import { propagateWinding } from '../src/path/PathBooleanWinding';
import { tracePaths } from '../src/path/PathBooleanTracePaths';
import { getMeta } from '../src/path/SegmentMeta';

describe('PathBoolean 下位flow debug', () => {
  it('矩形A-Bのsubtract: divideLocations→propagateWinding→tracePaths', () => {
    // 矩形A (0,0)-(200,0)-(200,200)-(0,200)
    const rectA = new Path([
      new Segment(new Point(0, 0)),
      new Segment(new Point(200, 0)),
      new Segment(new Point(200, 200)),
      new Segment(new Point(0, 200))
    ], true);

    // 矩形B (150,50)-(250,50)-(250,150)-(150,150)
    const rectB = new Path([
      new Segment(new Point(150, 50)),
      new Segment(new Point(250, 50)),
      new Segment(new Point(250, 150)),
      new Segment(new Point(150, 150))
    ], true);

    // 交点計算
    const intersections = getIntersections(rectA, rectB);

    // divideLocations
    const dividedLocsA = divideLocations(intersections);
    const dividedLocsB = divideLocations(intersections);

    // operator: subtract
    const operator = { '1': true, subtract: true };

    // 衝突マップは空でよい
    const curveCollisionsMap = {};

    // propagateWinding
    for (const loc of dividedLocsA) {
      propagateWinding(loc._segment, rectA, rectB, curveCollisionsMap, operator);
    }
    for (const loc of dividedLocsB) {
      propagateWinding(loc._segment, rectA, rectB, curveCollisionsMap, operator);
    }

    // segments収集: divideLocationsで得られた全セグメントも含める
    const segments: Segment[] = [];
    for (const loc of dividedLocsA) segments.push(loc._segment);
    for (const loc of dividedLocsB) segments.push(loc._segment);
// segments重複チェック
const segSet = new Set();
for (const seg of segments) {
  const pt = seg._point.toPoint();
  const key = `${pt.x},${pt.y},${seg._index}`;
  if (segSet.has(key)) {
    console.log(`🔥 duplicate segment: (${pt.x},${pt.y}) index=${seg._index}`);
  }
  segSet.add(key);
}

    // propagateWinding直後のwinding値を全出力
    for (let i = 0; i < dividedLocsA.length; i++) {
      const seg = dividedLocsA[i]._segment;
      const pt = seg._point.toPoint();
      const meta = getMeta(seg);
      const winding = meta && meta.winding ? meta.winding.winding : undefined;
      console.log(`🔥 after propagate: dividedLocsA[${i}] seg=(${pt.x},${pt.y}) winding=${winding}`);
    }
    for (let i = 0; i < dividedLocsB.length; i++) {
      const seg = dividedLocsB[i]._segment;
      const pt = seg._point.toPoint();
      const meta = getMeta(seg);
      const winding = meta && meta.winding ? meta.winding.winding : undefined;
      console.log(`🔥 after propagate: dividedLocsB[${i}] seg=(${pt.x},${pt.y}) winding=${winding}`);
// intersectionリンク構造を出力
for (let i = 0; i < dividedLocsA.length; i++) {
  const seg = dividedLocsA[i]._segment;
  const meta = getMeta(seg);
  const inter = seg._intersection;
  let next = inter?._next;
  let prev = inter?._previous;
  const pt = seg._point.toPoint();
  console.log(`🔥 intersection link: seg=(${pt.x},${pt.y}) next=${!!next} prev=${!!prev}`);
}
for (let i = 0; i < dividedLocsB.length; i++) {
  const seg = dividedLocsB[i]._segment;
  const meta = getMeta(seg);
  const inter = seg._intersection;
  let next = inter?._next;
  let prev = inter?._previous;
  const pt = seg._point.toPoint();
  console.log(`🔥 intersection link: seg=(${pt.x},${pt.y}) next=${!!next} prev=${!!prev}`);
}
    }

    // tracePaths
    const paths = tracePaths(segments, operator);

    // tracePathsのパス構築ループ詳細デバッグ
    // 直接tracePathsのロジックをここに再現し、各ステップで出力
    const tracePathsDebug = (segments, operator) => {
      const paths = [];
      let starts = [];
      // ソートは省略（既にテスト用segmentsなので）
      function isValid(seg) {
        const meta = getMeta(seg);
        if (!seg || !meta || meta.visited) return false;
        if (!operator) return true;
        const winding = meta.winding;
        if (!winding) return false;
        const op = operator[winding.winding];
        return !!(op && !(operator.unite && winding.winding === 2 && winding.windingL && winding.windingR));
      }
      function isStart(seg) {
        if (!seg) return false;
        for (let i = 0, l = starts.length; i < l; i++) {
          if (seg === starts[i]) return true;
        }
        return false;
      }
      function getCrossingSegments(segment, collectStarts) {
        const meta = getMeta(segment)!;
        const inter = meta.intersection;
        const start = inter;
        const crossings = [];
        if (collectStarts) starts = [segment];
        function collect(inter, end) {
          while (inter && inter !== end) {
            const other = inter._segment!;
            const otherMeta = getMeta(other)!;
            const path = otherMeta.path;
            if (path) {
              const next = other.getNext() || path.getFirstSegment();
              const nextMeta = getMeta(next)!;
              const nextInter = nextMeta.intersection;
              if (
                other !== segment &&
                (isStart(other) ||
                  isStart(next) ||
                  (next &&
                    (isValid(other) &&
                      (isValid(next) || (nextInter && isValid(nextInter._segment))))))
              ) {
                crossings.push(other);
              }
              if (collectStarts) starts.push(other);
            }
            inter = inter._next!;
          }
        }
        if (inter) {
          collect(inter);
          let interStart = inter;
          while (interStart && interStart._previous) {
            interStart = interStart._previous;
          }
          collect(interStart, start);
        }
        return crossings;
      }
      for (let i = 0, l = segments.length; i < l; i++) {
        const segStart = segments[i];
        const meta = getMeta(segStart);
        let validStart = isValid(segStart);
        const winding = meta && meta.winding ? meta.winding.winding : undefined;
        console.log(`🔥 tracePaths: i=${i} segStart=(${segStart._point.toPoint().x},${segStart._point.toPoint().y}) winding=${winding} visited=${meta ? meta.visited : "?"} validStart=${validStart}`);
        let path = null;
        let finished = false;
        let closed = true;
        const branches = [];
        let branch;
        let visited = [];
        let handleIn = null;
        if (validStart) {
          const pt = segStart._point.toPoint();
          console.log(`🔥 tracePaths validStart: seg=(${pt.x},${pt.y}) winding=${winding}`);
        }
        let currentSeg = segStart;
        while (validStart && currentSeg) {
          const first = !path;
          const crossings = getCrossingSegments(currentSeg, first);
          const other = crossings.shift();
          const isFinished = !first && (isStart(currentSeg) || isStart(other));
          const cross = !isFinished && other;
          if (first) {
            path = [];
            branch = null;
          }
          if (isFinished) {
            console.log(`🔥 tracePaths: finished at seg=(${currentSeg._point.toPoint().x},${currentSeg._point.toPoint().y})`);
            getMeta(currentSeg)!.visited = true;
            finished = true;
            break;
          }
          if (cross && branch) {
            branches.push(branch);
            branch = null;
          }
          if (!branch) {
            if (cross) crossings.push(currentSeg);
            branch = {
              start: path.length,
              crossings: crossings,
              visited: visited = [],
              handleIn: handleIn
            };
          }
          let nextSeg = currentSeg;
          if (cross) nextSeg = other!;
          if (!isValid(nextSeg)) {
            console.log(`🔥 tracePaths: backtrack at seg=(${nextSeg?._point?.toPoint().x},${nextSeg?._point?.toPoint().y})`);
            path.length = branch.start;
            for (let j = 0, k = visited.length; j < k; j++) {
              getMeta(visited[j])!.visited = false;
            }
            visited.length = 0;
            do {
              nextSeg = branch && branch.crossings.shift();
              if (!nextSeg || !getMeta(nextSeg)!.path) {
                nextSeg = null;
                branch = branches.pop();
                if (branch) {
                  visited = branch.visited;
                  handleIn = branch.handleIn;
                }
              }
            } while (branch && !isValid(nextSeg));
            if (!nextSeg) break;
          }
          // パスに追加
          path.push(nextSeg);
          getMeta(nextSeg)!.visited = true;
          visited.push(nextSeg);
          // 次へ
          const nextPath = getMeta(nextSeg || currentSeg)!.path!;
          const next = nextSeg.getNext();
          if (!next && !nextPath) break;
          currentSeg = (next || nextPath.getFirstSegment());
          handleIn = next ? next._handleIn.toPoint() : null;
        }
        if (finished && path && path.length > 0) {
          console.log('🔥 tracePaths: finished path:', path.map(s => {
            const pt = s._point.toPoint();
            return `(${pt.x},${pt.y})`;
          }).join(' -> '));
          paths.push(path);
        }
      }
      console.log("🔥 PathBooleanDebug: output paths.length =", paths.length);
      return paths;
    };

    // デバッグ出力
    tracePathsDebug(segments, operator);

    // 期待されるのは、AからBを引いたパス（Aの左側部分）が出力されること
    // （paths.length>0であればOK）
    // expect(paths.length).toBeGreaterThan(0);
  });
});