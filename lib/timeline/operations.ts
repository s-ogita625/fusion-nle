// ===========================================================================
// 編集操作 (split / trim / move / delete / insert)
// すべて純粋関数。Project を受け取り新しい Project を返す(イミュータブル)。
// ===========================================================================

import { Clip, Project, Track, clipEnd, uid } from "./model";
import { normalizeTrack } from "./magnetic";

function mapTrack(project: Project, trackId: string, fn: (t: Track) => Track): Project {
  return {
    ...project,
    tracks: project.tracks.map((t) => (t.id === trackId ? fn(t) : t)),
  };
}

function findClip(
  project: Project,
  clipId: string
): { track: Track; clip: Clip } | null {
  for (const track of project.tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) return { track, clip };
  }
  return null;
}

/** トラックにクリップを追加し、モードに応じて正規化 */
export function addClip(project: Project, trackId: string, clip: Clip): Project {
  const next = mapTrack(project, trackId, (t) => ({
    ...t,
    clips: [...t.clips, clip],
  }));
  return normalizeProjectTrack(next, trackId);
}

function normalizeProjectTrack(project: Project, trackId: string): Project {
  return mapTrack(project, trackId, (t) => normalizeTrack(t, project.mode));
}

/** クリップ削除。マグネティックなら詰める。 */
export function removeClip(project: Project, clipId: string): Project {
  const found = findClip(project, clipId);
  if (!found) return project;
  const next = mapTrack(project, found.track.id, (t) => ({
    ...t,
    clips: t.clips.filter((c) => c.id !== clipId),
  }));
  return normalizeProjectTrack(next, found.track.id);
}

/**
 * 再生ヘッド位置(playhead秒)でクリップを分割。
 * playhead がクリップ内部にある場合のみ2つに割る。
 */
export function splitClip(project: Project, clipId: string, playhead: number): Project {
  const found = findClip(project, clipId);
  if (!found) return project;
  const { track, clip } = found;
  if (playhead <= clip.startSec || playhead >= clipEnd(clip)) return project;

  const offset = playhead - clip.startSec;
  const left: Clip = { ...clip, durationSec: offset };
  const right: Clip = {
    ...clip,
    id: uid("clip"),
    startSec: playhead,
    sourceInSec: clip.sourceInSec + offset,
    durationSec: clip.durationSec - offset,
    // フェードインは左、フェードアウトは右へ
    fades: { in: 0, out: clip.fades.out },
  };
  left.fades = { in: clip.fades.in, out: 0 };

  return mapTrack(project, track.id, (t) => ({
    ...t,
    clips: t.clips.flatMap((c) => (c.id === clipId ? [left, right] : [c])),
  }));
}

/** クリップを別位置(秒)へ移動。マグネティックなら再配置される。 */
export function moveClip(
  project: Project,
  clipId: string,
  newStartSec: number,
  newTrackId?: string
): Project {
  const found = findClip(project, clipId);
  if (!found) return project;
  const start = Math.max(0, newStartSec);

  if (newTrackId && newTrackId !== found.track.id) {
    // トラック間移動
    const moving = { ...found.clip, startSec: start };
    let next = mapTrack(project, found.track.id, (t) => ({
      ...t,
      clips: t.clips.filter((c) => c.id !== clipId),
    }));
    next = mapTrack(next, newTrackId, (t) => ({ ...t, clips: [...t.clips, moving] }));
    next = normalizeProjectTrack(next, found.track.id);
    return normalizeProjectTrack(next, newTrackId);
  }

  const next = mapTrack(project, found.track.id, (t) => ({
    ...t,
    clips: t.clips.map((c) => (c.id === clipId ? { ...c, startSec: start } : c)),
  }));
  return normalizeProjectTrack(next, found.track.id);
}

/**
 * クリップの端をトリム。
 * edge="start": 開始端を動かす(sourceInSec も連動)。edge="end": 終了端。
 */
export function trimClip(
  project: Project,
  clipId: string,
  edge: "start" | "end",
  deltaSec: number
): Project {
  const found = findClip(project, clipId);
  if (!found) return project;
  const { track, clip } = found;
  const minDur = 0.05;

  let updated: Clip;
  if (edge === "start") {
    const newStart = clip.startSec + deltaSec;
    const newDur = clip.durationSec - deltaSec;
    if (newDur < minDur) return project;
    updated = {
      ...clip,
      startSec: Math.max(0, newStart),
      sourceInSec: Math.max(0, clip.sourceInSec + deltaSec),
      durationSec: newDur,
    };
  } else {
    const newDur = clip.durationSec + deltaSec;
    if (newDur < minDur) return project;
    updated = { ...clip, durationSec: newDur };
  }

  const next = mapTrack(project, track.id, (t) => ({
    ...t,
    clips: t.clips.map((c) => (c.id === clipId ? updated : c)),
  }));
  return normalizeProjectTrack(next, track.id);
}

/** クリップの任意プロパティを部分更新 */
export function updateClip(
  project: Project,
  clipId: string,
  patch: Partial<Clip>
): Project {
  const found = findClip(project, clipId);
  if (!found) return project;
  return mapTrack(project, found.track.id, (t) => ({
    ...t,
    clips: t.clips.map((c) => (c.id === clipId ? { ...c, ...patch } : c)),
  }));
}

/** モード切替時に全トラックを正規化 */
export function setMode(project: Project, mode: Project["mode"]): Project {
  const next = { ...project, mode };
  return {
    ...next,
    tracks: next.tracks.map((t) => normalizeTrack(t, mode)),
  };
}

export { findClip };
