// ===========================================================================
// マグネティック / 吸着ロジック (Final Cut Pro 由来)
// ===========================================================================

import { Clip, Track, clipEnd } from "./model";

/** クリップを startSec 昇順に並べ替え */
export function sortClips(clips: Clip[]): Clip[] {
  return [...clips].sort((a, b) => a.startSec - b.startSec);
}

/**
 * マグネティックモード: クリップを隙間なく左詰めに再配置する。
 * 開始位置の順序は維持したまま、前のクリップの末尾に次を吸着させる。
 */
export function compactMagnetic(clips: Clip[]): Clip[] {
  const sorted = sortClips(clips);
  let cursor = 0;
  return sorted.map((c) => {
    const placed = { ...c, startSec: cursor };
    cursor = clipEnd(placed);
    return placed;
  });
}

/**
 * トラックモード: 重なりを許さず、衝突時は後続を押し出す(リップル無しの単純解決)。
 * 既存クリップと重なる場合に挿入位置を調整する。
 */
export function resolveOverlaps(clips: Clip[]): Clip[] {
  const sorted = sortClips(clips);
  const result: Clip[] = [];
  let prevEnd = -Infinity;
  for (const c of sorted) {
    let start = c.startSec;
    if (start < prevEnd) {
      start = prevEnd;
    }
    const placed = { ...c, startSec: start };
    result.push(placed);
    prevEnd = clipEnd(placed);
  }
  return result;
}

/** 指定モードに応じてトラックのクリップ配置を正規化 */
export function normalizeTrack(track: Track, mode: "magnetic" | "track"): Track {
  if (track.clips.length === 0) return track;
  const clips =
    mode === "magnetic" ? compactMagnetic(track.clips) : resolveOverlaps(track.clips);
  return { ...track, clips };
}

/**
 * スナップ候補を集める。再生ヘッドや他クリップの端に吸着させるための位置リスト。
 */
export function collectSnapPoints(tracks: Track[], excludeClipId?: string): number[] {
  const pts = new Set<number>([0]);
  for (const t of tracks) {
    for (const c of t.clips) {
      if (c.id === excludeClipId) continue;
      pts.add(c.startSec);
      pts.add(clipEnd(c));
    }
  }
  return [...pts].sort((a, b) => a - b);
}

/** value を最も近いスナップ点に吸着(閾値内のみ) */
export function snap(value: number, points: number[], threshold: number): number {
  let best = value;
  let bestDist = threshold;
  for (const p of points) {
    const d = Math.abs(p - value);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}
