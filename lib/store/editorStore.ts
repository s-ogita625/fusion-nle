// ===========================================================================
// エディタ状態管理 (Zustand)
// プロジェクト・メディア・選択・再生ヘッド・ツール・Undo/Redo を集約。
// ===========================================================================

import { create } from "zustand";
import {
  Clip,
  MediaAsset,
  Project,
  TimelineMode,
  Track,
  TrackKind,
  clipEnd,
  defaultTextStyle,
  defaultTransform,
  makeEmptyProject,
  projectDuration,
  uid,
} from "@/lib/timeline/model";
import * as ops from "@/lib/timeline/operations";
import { saveProject, LAST_PROJECT_KEY } from "@/lib/storage/projectStore";

export type Tool = "select" | "blade" | "trim";

interface HistoryEntry {
  project: Project;
}

interface EditorState {
  project: Project;
  media: MediaAsset[];
  selectedClipId: string | null;
  playhead: number; // 秒
  playing: boolean;
  tool: Tool;
  pxPerSec: number; // タイムラインのズーム
  snapEnabled: boolean;
  // 履歴
  past: HistoryEntry[];
  future: HistoryEntry[];

  // --- メディア ---
  addMedia: (assets: MediaAsset[]) => void;
  setMedia: (assets: MediaAsset[]) => void;
  removeMedia: (id: string) => void;

  // --- プロジェクト操作(履歴対象) ---
  commit: (next: Project) => void;
  addClipFromMedia: (mediaId: string, trackId: string, startSec: number) => void;
  addTextClip: (trackId: string, startSec: number) => void;
  removeSelected: () => void;
  splitAtPlayhead: () => void;
  splitClipAt: (clipId: string, sec: number) => void;
  moveClip: (clipId: string, startSec: number, trackId?: string) => void;
  trimClip: (clipId: string, edge: "start" | "end", deltaSec: number) => void;
  updateClip: (clipId: string, patch: Partial<Clip>) => void;
  setMode: (mode: TimelineMode) => void;
  addTrack: (kind: TrackKind) => void;
  toggleTrackMute: (trackId: string) => void;
  renameProject: (name: string) => void;

  // --- UI 状態(履歴対象外) ---
  select: (id: string | null) => void;
  setPlayhead: (sec: number) => void;
  setPlaying: (playing: boolean) => void;
  setTool: (tool: Tool) => void;
  setZoom: (pxPerSec: number) => void;
  toggleSnap: () => void;
  loadProjectState: (project: Project, media: MediaAsset[]) => void;

  undo: () => void;
  redo: () => void;
  duration: () => number;
  findClip: (clipId: string) => { track: Track; clip: Clip } | null;
}

const MAX_HISTORY = 50;

function persist(project: Project) {
  // 非同期で保存(失敗は無視)
  saveProject(project).catch(() => {});
  try {
    localStorage.setItem(LAST_PROJECT_KEY, project.id);
  } catch {
    /* ignore */
  }
}

export const useEditor = create<EditorState>((set, get) => ({
  project: makeEmptyProject(),
  media: [],
  selectedClipId: null,
  playhead: 0,
  playing: false,
  tool: "select",
  pxPerSec: 80,
  snapEnabled: true,
  past: [],
  future: [],

  addMedia: (assets) => set((s) => ({ media: [...s.media, ...assets] })),
  setMedia: (assets) => set({ media: assets }),
  removeMedia: (id) => set((s) => ({ media: s.media.filter((m) => m.id !== id) })),

  commit: (next) =>
    set((s) => {
      persist(next);
      return {
        project: next,
        past: [...s.past, { project: s.project }].slice(-MAX_HISTORY),
        future: [],
      };
    }),

  addClipFromMedia: (mediaId, trackId, startSec) => {
    const s = get();
    const asset = s.media.find((m) => m.id === mediaId);
    const track = s.project.tracks.find((t) => t.id === trackId);
    if (!asset || !track) return;
    const kind: TrackKind = track.kind;
    const clip: Clip = {
      id: uid("clip"),
      mediaId: asset.id,
      kind,
      startSec: Math.max(0, startSec),
      durationSec: asset.durationSec || 5,
      sourceInSec: 0,
      name: asset.name,
      opacity: 1,
      transform: defaultTransform(),
      volume: 1,
      fades: { in: 0, out: 0 },
      brightness: 0,
      contrast: 0,
      saturation: 0,
    };
    s.commit(ops.addClip(s.project, trackId, clip));
  },

  addTextClip: (trackId, startSec) => {
    const s = get();
    const clip: Clip = {
      id: uid("clip"),
      mediaId: null,
      kind: "text",
      startSec: Math.max(0, startSec),
      durationSec: 3,
      sourceInSec: 0,
      name: "テキスト",
      opacity: 1,
      transform: defaultTransform(),
      volume: 1,
      fades: { in: 0, out: 0 },
      text: defaultTextStyle(),
      brightness: 0,
      contrast: 0,
      saturation: 0,
    };
    s.commit(ops.addClip(s.project, trackId, clip));
    set({ selectedClipId: clip.id });
  },

  removeSelected: () => {
    const s = get();
    if (!s.selectedClipId) return;
    s.commit(ops.removeClip(s.project, s.selectedClipId));
    set({ selectedClipId: null });
  },

  splitAtPlayhead: () => {
    const s = get();
    if (!s.selectedClipId) return;
    s.commit(ops.splitClip(s.project, s.selectedClipId, s.playhead));
  },

  splitClipAt: (clipId, sec) => {
    const s = get();
    s.commit(ops.splitClip(s.project, clipId, sec));
  },

  moveClip: (clipId, startSec, trackId) => {
    const s = get();
    s.commit(ops.moveClip(s.project, clipId, startSec, trackId));
  },

  trimClip: (clipId, edge, deltaSec) => {
    const s = get();
    s.commit(ops.trimClip(s.project, clipId, edge, deltaSec));
  },

  updateClip: (clipId, patch) => {
    const s = get();
    s.commit(ops.updateClip(s.project, clipId, patch));
  },

  setMode: (mode) => {
    const s = get();
    s.commit(ops.setMode(s.project, mode));
  },

  addTrack: (kind) => {
    const s = get();
    const count = s.project.tracks.filter((t) => t.kind === kind).length + 1;
    const prefix = kind === "video" ? "V" : kind === "audio" ? "A" : "T";
    const label = kind === "video" ? "ビデオ" : kind === "audio" ? "オーディオ" : "テキスト";
    const track: Track = {
      id: uid("trk"),
      kind,
      name: `${prefix}${count} ${label}`,
      clips: [],
      muted: false,
      locked: false,
    };
    s.commit({ ...s.project, tracks: [...s.project.tracks, track] });
  },

  toggleTrackMute: (trackId) => {
    const s = get();
    s.commit({
      ...s.project,
      tracks: s.project.tracks.map((t) =>
        t.id === trackId ? { ...t, muted: !t.muted } : t
      ),
    });
  },

  renameProject: (name) => {
    const s = get();
    s.commit({ ...s.project, name });
  },

  select: (id) => set({ selectedClipId: id }),
  setPlayhead: (sec) => set({ playhead: Math.max(0, sec) }),
  setPlaying: (playing) => set({ playing }),
  setTool: (tool) => set({ tool }),
  setZoom: (pxPerSec) => set({ pxPerSec: Math.max(10, Math.min(400, pxPerSec)) }),
  toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),

  loadProjectState: (project, media) =>
    set({
      project,
      media,
      selectedClipId: null,
      playhead: 0,
      playing: false,
      past: [],
      future: [],
    }),

  undo: () =>
    set((s) => {
      const prev = s.past[s.past.length - 1];
      if (!prev) return s;
      persist(prev.project);
      return {
        project: prev.project,
        past: s.past.slice(0, -1),
        future: [{ project: s.project }, ...s.future].slice(0, MAX_HISTORY),
      };
    }),

  redo: () =>
    set((s) => {
      const next = s.future[0];
      if (!next) return s;
      persist(next.project);
      return {
        project: next.project,
        past: [...s.past, { project: s.project }].slice(-MAX_HISTORY),
        future: s.future.slice(1),
      };
    }),

  duration: () => projectDuration(get().project),

  findClip: (clipId) => {
    for (const track of get().project.tracks) {
      const clip = track.clips.find((c) => c.id === clipId);
      if (clip) return { track, clip };
    }
    return null;
  },
}));

export { clipEnd };
