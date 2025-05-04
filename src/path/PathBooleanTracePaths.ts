/**
 * PathBooleanTracePaths: Boolean演算のパストレース機能
 * paper.jsのPathItem.Boolean.jsのtracePathsアルゴリズムを忠実に移植
 */

import { Path } from './Path';
import { Segment } from './Segment';
import { Point } from '../basic/Point';

/**
 * 交点情報
 */
export interface Intersection {
  // 交点の座標
  point: Point;
  // 交点のパス1上のカーブインデックス
  curve1Index: number;
  // 交点のパス2上のカーブインデックス
  curve2Index: number;
  // 交点のパス1上のカーブパラメータ
  t1?: number | null;
  // 交点のパス2上のカーブパラメータ
  t2?: number | null;
  // 交点の種類（entry/exit）
  type?: 'entry' | 'exit';
  // 交点のwinding number
  winding?: number;
  // 交点の処理済みフラグ
  visited?: boolean;
  // 次の交点への参照（リンクリスト構造）
  next?: Intersection;
  // 前の交点への参照（リンクリスト構造）
  prev?: Intersection;
  // 交点のセグメント
  segment?: Segment;
  // 交点が重なりかどうか
  _overlap?: boolean;
}

/**
 * セグメント拡張情報
 * paper.jsのSegmentクラスに追加されるプロパティを定義
 */
interface SegmentInfo {
  // セグメントが訪問済みかどうか
  _visited?: boolean;
  // セグメントの交点情報
  _intersection?: Intersection | null;
  // セグメントのwinding情報
  _winding?: {
    winding: number;
    windingL?: number;
    windingR?: number;
  };
  // セグメントのパス
  _path?: Path & {
    _overlapsOnly?: boolean;
    _closed?: boolean;
    _id?: number;
    compare?: (path: Path) => boolean;
  };
}

// 型安全性のためのヘルパー関数
// 注意: paper.jsとの互換性のため、型キャストを使用
function asSegmentInfo(segment: Segment | null | undefined): Segment & SegmentInfo | null | undefined {
  return segment as (Segment & SegmentInfo) | null | undefined;
}

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
    const segInfo = asSegmentInfo(seg);
    if (!segInfo || segInfo._visited) return false;

    if (!operator) return true;

    const winding = segInfo._winding;
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
      asSegmentInfo(pathSegments[i])!._visited = true;
    }
  }

  // 交差するセグメントを取得する関数
  // paper.jsのgetCrossingSegments関数と同等の機能
  function getCrossingSegments(segment: Segment, collectStarts: boolean): Segment[] {
    const segInfo = asSegmentInfo(segment)!;
    const inter = segInfo._intersection;
    const start = inter as Intersection;
    const crossings: Segment[] = [];
    
    if (collectStarts) {
      starts = [segment];
    }

    function collect(inter: Intersection | null, end?: Intersection): void {
      while (inter && inter !== end) {
        const other = inter.segment!;
        const otherInfo = asSegmentInfo(other)!;
        const path = otherInfo._path;
        
        if (path) {
          const next = other.getNext() || path.getFirstSegment();
          const nextInfo = asSegmentInfo(next)!;
          const nextInter = nextInfo._intersection;
          
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
      while (interStart && interStart.prev) {
        interStart = interStart.prev;
      }
      collect(interStart, start as Intersection);
    }
    
    return crossings;
  }

  // セグメントをソート
  // paper.jsのソートロジックと同等の機能
  segments.sort((seg1, seg2) => {
    const seg1Info = asSegmentInfo(seg1);
    const seg2Info = asSegmentInfo(seg2);
    const inter1 = seg1Info?._intersection;
    const inter2 = seg2Info?._intersection;
    const over1 = !!(inter1 && inter1._overlap);
    const over2 = !!(inter2 && inter2._overlap);
    const path1 = seg1Info?._path;
    const path2 = seg2Info?._path;
    
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
      // 型安全性のため、デフォルト値を使用
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
    const segStartInfo = asSegmentInfo(segStart);
    const path1 = segStartInfo?._path;
    
    if (validStart && path1 && path1._overlapsOnly) {
      // paper.jsと同様に、交差するパスを取得
      const path2 = segStartInfo._intersection &&
                    segStartInfo._intersection.segment &&
                    asSegmentInfo(segStartInfo._intersection.segment)!._path;
      
      if (path1.compare && path2 && path1.compare(path2)) {
        // 面積がある場合のみパスを結果に追加
        if (path1.getArea()) {
          paths.push(path1.clone(false));
        }
        // 関連するすべてのセグメントを訪問済みにマーク
        visitPath(path1);
        visitPath(path2);
        validStart = false;
      }
    }

    // 有効なセグメントからパスをトレース
    let currentSeg = segStart as Segment | null;
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
          const currentSegInfo = asSegmentInfo(currentSeg);
          closed = currentSegInfo?._path._closed || false;
        }
        asSegmentInfo(currentSeg)!._visited = true;
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

      let nextSeg = currentSeg;
      if (cross && other) {
        nextSeg = other;
      }

      if (!isValid(nextSeg)) {
        // 無効なセグメントに遭遇した場合、分岐点に戻る
        // paper.jsのバックトラック処理と同じ実装
        path!.removeSegments(branch.start);
        for (let j = 0, k = visited.length; j < k; j++) {
          asSegmentInfo(visited[j])!._visited = false;
        }
        visited.length = 0;
        
        // 他の交差を試す
        do {
          nextSeg = branch && branch.crossings.shift() || null;
          if (!nextSeg || !asSegmentInfo(nextSeg)!._path) {
            nextSeg = null as unknown as Segment;
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
      asSegmentInfo(nextSeg)!._visited = true;
      visited.push(nextSeg);
      
      // 次のセグメントに移動
      const nextPath = asSegmentInfo(nextSeg)!._path;
      currentSeg = (next || nextPath.getFirstSegment()) as Segment;
      handleIn = next && next._handleIn as unknown as Point;
    }

    if (finished) {
      if (closed) {
        // open/closedパス混在時の端点ハンドル処理
        path!.getFirstSegment()!.setHandleIn(handleIn as Point);
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