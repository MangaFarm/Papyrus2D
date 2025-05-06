/**
 * PathBooleanTracePaths: Boolean演算のパストレース機能
 * paper.jsのPathItem.Boolean.jsのtracePathsアルゴリズムを忠実に移植
 */

import { Path } from './Path';
import { Segment } from './Segment';
import { Point } from '../basic/Point';
import { getMeta, IntersectionInfo } from './SegmentMeta';

/**
 * 交点情報
 * SegmentMeta.ts の IntersectionInfo を再エクスポート
 */
export type Intersection = IntersectionInfo;

/**
 * マーチングアルゴリズムによるパス構築
 * paper.jsのtracePathsアルゴリズムを忠実に移植
 */
export function tracePaths(
  segments: Segment[],
  operator: Record<string, boolean>
): Path[] {
  // 🔥 tracePaths: input segments
  console.log("🔥 tracePaths: input segments.length =", segments.length);
  // paper.jsのtracePathsアルゴリズムに完全一致させる
  const paths: Path[] = [];
  let starts: Segment[] = [];



  // セグメントをpaper.jsと同じ順序でソート
  segments.sort((seg1, seg2) => {
    const meta1 = getMeta(seg1)!;
    const meta2 = getMeta(seg2)!;
    const inter1 = meta1.intersection;
    const inter2 = meta2.intersection;
    const over1 = !!(inter1 && inter1._overlap);
    const over2 = !!(inter2 && inter2._overlap);
    const path1 = meta1.path;
    const path2 = meta2.path;
    if (over1 !== over2) {
      return over1 ? 1 : -1;
    }
    if (!inter1 !== !inter2) {
      return inter1 ? 1 : -1;
    }
    if (path1 !== path2) {
      const id1 = path1 && path1._id !== undefined ? path1._id : 0;
      const id2 = path2 && path2._id !== undefined ? path2._id : 0;
      return id1 - id2;
    }
    return seg1._index - seg2._index;
  });

  // セグメントが有効かどうかを判定する関数
  // paper.jsのisValid関数と同等の機能
  function isValid(seg: Segment | null | undefined): boolean {
    const meta = getMeta(seg);
    if (!seg || !meta || meta.visited) return false;

    if (!operator) return true;

    const winding = meta.winding;
    if (!winding) {
      let x:number | undefined ,y:number | undefined;
      if (seg && seg._point && typeof seg._point.toPoint === 'function') {
        const pt = seg._point.toPoint();
        x = pt.x; y = pt.y;
      }
      console.log('🔥 isValid: winding is undefined for seg', seg && seg._index, x, y);
      return false;
    }

    const op = operator[winding.winding];
    console.log('🔥 isValid: winding', winding, 'op', op, 'operator', operator, 'seg', seg && seg._index);
    return !!(
      op &&
      !(
        operator.unite &&
        winding.winding === 2 &&
        winding.windingL &&
        winding.windingR
      )
    );
  }

  // セグメントが開始点かどうかを判定する関数
  function isStart(seg: Segment | null | undefined): boolean {
    if (!seg) return false;
    for (let i = 0, l = starts.length; i < l; i++) {
      if (seg === starts[i]) return true;
    }
    return false;
  }

  // パスを訪問済みにする関数
  // paper.jsのvisitPath関数と同等の機能
  function visitPath(path: Path): void {
    const pathSegments = path._segments;
    for (let i = 0, l = pathSegments.length; i < l; i++) {
      const meta = getMeta(pathSegments[i])!;
      meta.visited = true;
    }
  }

  // 交差するセグメントを取得する関数
  // paper.jsのgetCrossingSegments関数と同等の機能
  function getCrossingSegments(segment: Segment, collectStarts: boolean): Segment[] {
    const meta = getMeta(segment)!;
    const inter = meta.intersection;
    const start = inter;
    const crossings: Segment[] = [];
    
    if (collectStarts) {
      starts = [segment];
    }

    function collect(inter: Intersection | null | undefined, end?: Intersection): void {
      while (inter && (end === undefined || inter !== end)) {
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

          if (collectStarts) {
            starts.push(other);
          }
        }

        inter = inter._next!;
      }
    }

    if (inter) {
      collect(inter);
      // リンクリストの先頭に移動
      let interStart = inter;
      while (interStart && interStart._previous) {
        interStart = interStart._previous;
      }
      // TypeScriptの制約: startがnullの可能性があるため、型アサーションを使用
      collect(interStart, start as Intersection);
    }
    
    return crossings;
  }

  // セグメントをソート
  // paper.jsのソートロジックと同等の機能
  segments.sort((seg1, seg2) => {
    const meta1 = getMeta(seg1)!;
    const meta2 = getMeta(seg2)!;
    const inter1 = meta1.intersection;
    const inter2 = meta2.intersection;
    const over1 = !!(inter1 && inter1._overlap);
    const over2 = !!(inter2 && inter2._overlap);
    const path1 = meta1.path;
    const path2 = meta2.path;
    
    // 重なりとインターセクションの優先順位でソート
    if (over1 !== over2) {
      return over1 ? 1 : -1;
    }
    
    if (!inter1 !== !inter2) {
      return inter1 ? 1 : -1;
    }
    
    // パスIDとセグメントインデックスでソート
    if (path1 !== path2) {
      // paper.jsとの互換性のため、_idプロパティを使用
      const id1 = path1 && path1._id !== undefined ? path1._id : 0;
      const id2 = path2 && path2._id !== undefined ? path2._id : 0;
      return id1 - id2;
    }
    
    return seg1._index - seg2._index;
  });

  // 各セグメントからパスをトレース
  for (let i = 0, l = segments.length; i < l; i++) {
    const segStart = segments[i];
    const meta = getMeta(segStart);
    let validStart = isValid(segStart);
    // 🔥 tracePaths: segment info
    const winding = meta && meta.winding ? meta.winding.winding : undefined;
    console.log(`🔥 tracePaths: i=${i} segStart=(${segStart._point.toPoint().x},${segStart._point.toPoint().y}) winding=${winding} visited=${meta ? meta.visited : "?"} validStart=${validStart}`);
    let path: Path | null = null;
    let finished = false;
    let closed = true;
    const branches: any[] = [];
    let branch: any;
    let visited: Segment[] = [];
    let handleIn: Point | null = null;

    // 完全重なりパスの処理（paper.jsに合わせる）
    const startMeta = getMeta(segStart)!;
    const path1 = startMeta.path;
    if (validStart && path1 && path1._overlapsOnly) {
      const path2 = startMeta.intersection &&
        startMeta.intersection._segment &&
        getMeta(startMeta.intersection._segment)!.path;
      if (path2 && (path1 as any).compare && (path1 as any).compare(path2)) {
        if (path1.getArea()) {
          paths.push(path1.clone(false));
        }
        visitPath(path1);
        visitPath(path2);
        validStart = false;
      }
    }

    // パスをトレース
    let currentSeg = segStart;
    while (validStart && currentSeg) {
      const first = !path;
      const crossings = getCrossingSegments(currentSeg, first);
      const other = crossings.shift();
      const isFinished = !first && (isStart(currentSeg) || isStart(other));
      const cross = !isFinished && other;

      if (first) {
        path = new Path();
        branch = null;
      }

      if (isFinished) {
        if (currentSeg.isFirst() || currentSeg.isLast()) {
          const currentMeta = getMeta(currentSeg)!;
          // paper.js同様、meta.pathがなければcurrentSeg._pathを使う
          const pathObj = currentMeta.path || currentSeg._path;
          closed = pathObj && pathObj._closed || false;
        }
        getMeta(currentSeg)!.visited = true;
        finished = true;
        break;
      }

      if (cross && branch) {
        branches.push(branch);
        branch = null;
      }

      if (!branch) {
        if (cross) {
          crossings.push(currentSeg);
        }
        branch = {
          start: path!._segments.length,
          crossings: crossings,
          visited: visited = [],
          handleIn: handleIn
        };
      }

      let nextSeg: Segment | null = currentSeg;
      if (cross) {
        nextSeg = other!;
      }

      if (!isValid(nextSeg)) {
        // バックトラック処理（paper.jsに合わせる）
        path!.removeSegments(branch.start);
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
        if (!nextSeg)
          break;
      }

      // セグメントをパスに追加（paper.jsの順序・ハンドル処理に合わせる）
      const next = nextSeg.getNext();
      const newSeg = new Segment(
        nextSeg._point.toPoint(),
        handleIn,
        next ? nextSeg._handleOut.toPoint() : null
      );
      path!.add(newSeg);
      // 新規セグメントのmeta.pathを必ずセット
      const meta = getMeta(newSeg);
      if (meta) meta.path = path! as any;
      getMeta(nextSeg)!.visited = true;
      visited.push(nextSeg);

      // 次のセグメントに移動
      const nextPath = getMeta(nextSeg || currentSeg)!.path!;
      if (!next && !nextPath) break;
      currentSeg = (next || nextPath.getFirstSegment()) as Segment;
      handleIn = next ? next._handleIn.toPoint() : null;
    }

    if (finished) {
      if (closed) {
        // 端点ハンドル処理（paper.jsに合わせる）
        path!.getFirstSegment()!.setHandleIn(handleIn!);
        path!.setClosed(closed);
      }
      // paper.jsでは面積0のパスは含めない
      if (path!.getArea() !== 0) {
        paths.push(path!);
      }
    }
  }
  // 🔥 tracePaths: output paths
  console.log("🔥 tracePaths: output paths.length =", paths.length);
  for (let i = 0; i < paths.length; i++) {
    const segs = paths[i].getSegments();
    console.log("🔥 tracePaths: paths[" + i + "].segments.length =", segs.length);
    console.log("🔥 tracePaths: paths[" + i + "].coords =", segs.map(s => {
      const pt = s._point.toPoint();
      return `${pt.x},${pt.y}`;
    }).join(" -> "));
  }
  return paths;
}