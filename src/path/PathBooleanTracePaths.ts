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
  const paths: Path[] = [];
  let starts: Segment[] = [];

  // セグメントが有効かどうかを判定する関数
  // paper.jsのisValid関数と同等の機能
  function isValid(seg: Segment | null | undefined): boolean {
    const meta = getMeta(seg);
    if (!seg || !meta || meta.visited) return false;

    if (!operator) return true;

    const winding = meta.winding;
    if (!winding) return false;

    return !!(
      operator[winding.winding] &&
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
      while (inter && inter !== end) {
        const other = inter.segment!;
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
                  (isValid(next) || (nextInter && isValid(nextInter.segment))))))
          ) {
            crossings.push(other);
          }
          
          if (collectStarts) {
            starts.push(other);
          }
        }
        
        inter = inter.next!;
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
    let validStart = isValid(segStart);
    let path: Path | null = null;
    let finished = false;
    let closed = true;
    const branches: any[] = [];
    let branch: any;
    let visited: Segment[] = [];
    let handleIn: Point | null = null;

    // すべてのセグメントが重なりの場合の特別処理
    // paper.jsの重なり処理と同等の機能
    const startMeta = getMeta(segStart)!;
    const path1 = startMeta.path;
    
    if (validStart && path1 && path1._overlapsOnly) {
      // paper.jsと同様に、交差するパスを取得
      const path2 = startMeta.intersection &&
                    startMeta.intersection.segment &&
                    getMeta(startMeta.intersection.segment)!.path;
      
      if (path2 && (path1 as any).compare && (path1 as any).compare(path2)) {
        // 面積がある場合のみパスを結果に追加
        if (path1.getArea()) {
          paths.push(path1.clone(false));
        }
        // 関連するすべてのセグメントを訪問済みにマーク
        visitPath(path1);
        if (path2) visitPath(path2);
        validStart = false;
      }
    }

    // 有効なセグメントからパスをトレース
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
          closed = currentMeta.path!._closed || false;
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
        // 無効なセグメントに遭遇した場合、分岐点に戻る
        // paper.jsのバックトラック処理と同じ実装
        path!.removeSegments(branch.start);
        for (let j = 0, k = visited.length; j < k; j++) {
          getMeta(visited[j])!.visited = false;
        }
        visited.length = 0;
        
        // 他の交差を試す
        do {
          nextSeg = branch && branch.crossings.shift();
          if (!nextSeg || !getMeta(nextSeg)!.path) {
            // paper.jsと同様にnullを直接代入
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

      // セグメントをパスに追加
      const next = nextSeg.getNext();
      path!.add(new Segment(nextSeg._point, handleIn, next && nextSeg._handleOut));
      getMeta(nextSeg)!.visited = true;
      visited.push(nextSeg);
      
      // 次のセグメントに移動
      const nextPath = getMeta(nextSeg)!.path!;
      // TypeScriptの制約: undefinedをSegmentに割り当てられないため、型アサーションを使用
      currentSeg = (next || nextPath.getFirstSegment()) as Segment;
      // TypeScriptの制約: SegmentPointをPointに変換するため、型アサーションを使用
      handleIn = next && (next._handleIn as unknown as Point);
    }

    if (finished) {
      if (closed) {
        // open/closedパス混在時の端点ハンドル処理
        path!.getFirstSegment()!.setHandleIn(handleIn!);
        path!.setClosed(closed);
      }

      // 面積が0でないパスのみ追加
      if (path!.getArea() !== 0) {
        paths.push(path!);
      }
    }
  }

  return paths;
}