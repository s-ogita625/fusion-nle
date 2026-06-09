"use client";

import { useEditor } from "@/lib/store/editorStore";
import {
  BladeIcon,
  ExportIcon,
  LayersIcon,
  MagnetIcon,
  PlusIcon,
  RedoIcon,
  SelectIcon,
  TextIcon,
  TrashIcon,
  UndoIcon,
} from "./icons";

export function Toolbar({ onExport }: { onExport: () => void }) {
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const mode = useEditor((s) => s.project.mode);
  const setMode = useEditor((s) => s.setMode);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const pxPerSec = useEditor((s) => s.pxPerSec);
  const setZoom = useEditor((s) => s.setZoom);
  const addTextClip = useEditor((s) => s.addTextClip);
  const addTrack = useEditor((s) => s.addTrack);
  const removeSelected = useEditor((s) => s.removeSelected);
  const selectedClipId = useEditor((s) => s.selectedClipId);
  const playhead = useEditor((s) => s.playhead);
  const project = useEditor((s) => s.project);
  const snapEnabled = useEditor((s) => s.snapEnabled);
  const toggleSnap = useEditor((s) => s.toggleSnap);

  function handleAddText() {
    const textTrack =
      project.tracks.find((t) => t.kind === "text") ?? project.tracks[0];
    if (textTrack) addTextClip(textTrack.id, playhead);
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-bg-1 border-b border-border flex-wrap">
      <div className="flex items-center gap-1.5 mr-2">
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center text-white font-bold text-xs"
          style={{ background: "linear-gradient(135deg,var(--accent),var(--accent-2))" }}
        >
          F
        </div>
        <span className="font-semibold text-sm tracking-tight">Fusion NLE</span>
      </div>

      {/* ツール */}
      <div className="flex gap-1">
        <button
          className={`btn btn-icon ${tool === "select" ? "btn-active" : ""}`}
          title="選択ツール (V)"
          onClick={() => setTool("select")}
        >
          <SelectIcon />
        </button>
        <button
          className={`btn btn-icon ${tool === "blade" ? "btn-active" : ""}`}
          title="ブレード/分割ツール (B)"
          onClick={() => setTool("blade")}
        >
          <BladeIcon />
        </button>
      </div>

      <div className="w-px h-6 bg-border mx-1" />

      {/* モード切替(ハイブリッドの核) */}
      <div className="flex gap-1">
        <button
          className={`btn ${mode === "magnetic" ? "btn-active" : ""}`}
          title="マグネティック(FCP風): 自動で隙間を詰める"
          onClick={() => setMode("magnetic")}
          style={{ padding: "6px 10px" }}
        >
          <MagnetIcon width={15} height={15} /> マグネ
        </button>
        <button
          className={`btn ${mode === "track" ? "btn-active" : ""}`}
          title="トラック(Premiere風): 自由配置"
          onClick={() => setMode("track")}
          style={{ padding: "6px 10px" }}
        >
          <LayersIcon width={15} height={15} /> トラック
        </button>
      </div>

      <div className="w-px h-6 bg-border mx-1" />

      <button
        className={`btn ${snapEnabled ? "btn-active" : ""}`}
        title="スナップ吸着 ON/OFF (S)"
        onClick={toggleSnap}
        style={{ padding: "6px 10px" }}
      >
        スナップ
      </button>

      <div className="w-px h-6 bg-border mx-1" />

      {/* 追加系 */}
      <button className="btn" onClick={handleAddText} style={{ padding: "6px 10px" }}>
        <TextIcon width={15} height={15} /> テキスト
      </button>
      <button
        className="btn"
        onClick={() => addTrack("video")}
        title="ビデオトラックを追加"
        style={{ padding: "6px 10px" }}
      >
        <PlusIcon width={14} height={14} /> V
      </button>
      <button
        className="btn"
        onClick={() => addTrack("audio")}
        title="オーディオトラックを追加"
        style={{ padding: "6px 10px" }}
      >
        <PlusIcon width={14} height={14} /> A
      </button>

      <div className="w-px h-6 bg-border mx-1" />

      <button
        className="btn btn-icon"
        title="削除 (Delete)"
        onClick={removeSelected}
        disabled={!selectedClipId}
        style={{ color: selectedClipId ? "var(--danger)" : undefined }}
      >
        <TrashIcon />
      </button>
      <button className="btn btn-icon" title="元に戻す (⌘Z)" onClick={undo} disabled={!canUndo}>
        <UndoIcon />
      </button>
      <button className="btn btn-icon" title="やり直し (⌘⇧Z)" onClick={redo} disabled={!canRedo}>
        <RedoIcon />
      </button>

      <div className="flex-1" />

      {/* ズーム */}
      <div className="flex items-center gap-2 mr-2">
        <span className="text-xs text-text-dim">ズーム</span>
        <input
          type="range"
          className="range"
          style={{ width: 90 }}
          min={10}
          max={300}
          value={pxPerSec}
          onChange={(e) => setZoom(parseInt(e.target.value))}
        />
      </div>

      <button className="btn btn-accent" onClick={onExport} style={{ padding: "6px 14px" }}>
        <ExportIcon width={15} height={15} /> 書き出し
      </button>
    </div>
  );
}
