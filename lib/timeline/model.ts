// ===========================================================================
// タイムラインのデータモデル
// Premiere(明示トラック) と Final Cut Pro(マグネティック) の両UXを
// 同一データモデルで表現する。トラック種別と clip の絶対座標(startSec)を
// 基本とし、マグネティックモードでは magnetic.ts が clip 列を詰め直す。
// ===========================================================================

export type TrackKind = "video" | "audio" | "text";

export type TimelineMode = "magnetic" | "track";

/** プロジェクト全体 */
export interface Project {
  id: string;
  name: string;
  fps: number;
  width: number;
  height: number;
  /** マグネティック or 明示トラック */
  mode: TimelineMode;
  tracks: Track[];
}

/** タイムライン上の1トラック(レイヤー) */
export interface Track {
  id: string;
  kind: TrackKind;
  name: string;
  clips: Clip[];
  muted: boolean;
  locked: boolean;
}

/** フェード設定(秒) */
export interface Fades {
  in: number;
  out: number;
}

/** テキストクリップ固有のスタイル */
export interface TextStyle {
  text: string;
  fontSize: number;
  color: string;
  fontWeight: number;
  align: "left" | "center" | "right";
  /** 画面に対する相対位置 0..1 */
  x: number;
  y: number;
  background: string | null;
}

/** トランスフォーム(映像クリップの拡大/位置) */
export interface Transform {
  scale: number;
  x: number; // -1..1 中心基準の相対
  y: number;
}

/** タイムライン上のクリップ */
export interface Clip {
  id: string;
  /** 参照メディアID。テキストクリップは null */
  mediaId: string | null;
  kind: TrackKind;
  /** タイムライン上の開始位置(秒) */
  startSec: number;
  /** タイムライン上での尺(秒) */
  durationSec: number;
  /** 元メディアの開始オフセット(秒)。トリムで変化 */
  sourceInSec: number;
  /** 表示名 */
  name: string;
  // --- 映像/テキスト共通の見た目 ---
  opacity: number;
  transform: Transform;
  // --- 音量 ---
  volume: number;
  fades: Fades;
  // --- テキスト ---
  text?: TextStyle;
  // --- 基本カラー補正(映像) ---
  brightness: number; // -1..1
  contrast: number; // -1..1
  saturation: number; // -1..1
}

/** インポート済みメディアのメタ情報 */
export interface MediaAsset {
  id: string;
  name: string;
  /** "video" | "audio" | "image" */
  type: "video" | "audio" | "image";
  durationSec: number;
  width: number;
  height: number;
  /** 再生用 object URL (セッション内のみ有効) */
  url: string;
  /** サムネイル dataURL */
  thumbnail: string | null;
  /** 永続化キー(OPFS) */
  storageKey?: string;
  mimeType: string;
  hasAudio: boolean;
}

// --- ID生成(Math.random非依存: crypto.randomUUID) ---
export function uid(prefix = "id"): string {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}_${rnd}`;
}

export function makeEmptyProject(): Project {
  return {
    id: uid("proj"),
    name: "無題のプロジェクト",
    fps: 30,
    width: 1920,
    height: 1080,
    mode: "magnetic",
    tracks: [
      { id: uid("trk"), kind: "text", name: "T1 テキスト", clips: [], muted: false, locked: false },
      { id: uid("trk"), kind: "video", name: "V1 ビデオ", clips: [], muted: false, locked: false },
      { id: uid("trk"), kind: "audio", name: "A1 オーディオ", clips: [], muted: false, locked: false },
    ],
  };
}

export function defaultTransform(): Transform {
  return { scale: 1, x: 0, y: 0 };
}

export function defaultTextStyle(text = "テキストを入力"): TextStyle {
  return {
    text,
    fontSize: 72,
    color: "#ffffff",
    fontWeight: 700,
    align: "center",
    x: 0.5,
    y: 0.5,
    background: null,
  };
}

/** クリップのタイムライン上の終了位置 */
export function clipEnd(clip: Clip): number {
  return clip.startSec + clip.durationSec;
}

/** プロジェクト全体の尺 */
export function projectDuration(project: Project): number {
  let max = 0;
  for (const t of project.tracks) {
    for (const c of t.clips) {
      max = Math.max(max, clipEnd(c));
    }
  }
  return max;
}
