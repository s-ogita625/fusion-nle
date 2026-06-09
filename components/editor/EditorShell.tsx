"use client";

import { useEffect, useState } from "react";
import { useEditor } from "@/lib/store/editorStore";
import {
  LAST_PROJECT_KEY,
  loadProject,
  restoreMediaAssets,
} from "@/lib/storage/projectStore";
import { mediaPool } from "@/lib/engine/mediaPool";
import { isWebCodecsSupported } from "@/lib/export/exporter";
import { Toolbar } from "./Toolbar";
import { MediaBin } from "./MediaBin";
import { PreviewMonitor } from "./PreviewMonitor";
import { Inspector } from "./Inspector";
import { Timeline } from "./Timeline";
import { ExportDialog } from "./ExportDialog";

export default function EditorShell() {
  const [showExport, setShowExport] = useState(false);
  const [restored, setRestored] = useState(false);
  const [warnBrowser, setWarnBrowser] = useState(false);
  const [dismissWarn, setDismissWarn] = useState(false);

  const loadProjectState = useEditor((s) => s.loadProjectState);

  // 起動時にローカル保存を復元
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const assets = await restoreMediaAssets();
        if (cancelled) return;
        mediaPool.registerAssets(assets);
        const lastId =
          typeof localStorage !== "undefined"
            ? localStorage.getItem(LAST_PROJECT_KEY)
            : null;
        if (lastId) {
          const proj = await loadProject(lastId);
          if (proj && !cancelled) {
            loadProjectState(proj, assets);
          } else if (!cancelled) {
            useEditor.getState().setMedia(assets);
          }
        } else if (!cancelled) {
          useEditor.getState().setMedia(assets);
        }
      } catch {
        /* 復元失敗は無視 */
      } finally {
        if (!cancelled) setRestored(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadProjectState]);

  useEffect(() => {
    if (!isWebCodecsSupported()) setWarnBrowser(true);
  }, []);

  // 開発時のみ: ブラウザ自動検証用のテストフックを公開
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (async () => {
      const { importFiles } = await import("@/lib/media/import");
      const exporter = await import("@/lib/export/exporter");
      (window as unknown as { __fusion: unknown }).__fusion = {
        store: useEditor,
        importFiles,
        exportTimeline: exporter.exportTimeline,
      };
    })();
  }, []);

  // キーボードショートカット
  useEffect(() => {
    function isTyping() {
      const el = document.activeElement;
      return (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          (el as HTMLElement).isContentEditable)
      );
    }
    function onKey(e: KeyboardEvent) {
      if (isTyping()) return;
      const s = useEditor.getState();
      const meta = e.metaKey || e.ctrlKey;

      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      switch (e.key) {
        case " ":
          e.preventDefault();
          s.setPlaying(!s.playing);
          break;
        case "v":
        case "V":
          s.setTool("select");
          break;
        case "b":
        case "B":
          s.setTool("blade");
          break;
        case "s":
        case "S":
          s.toggleSnap();
          break;
        case "Delete":
        case "Backspace":
          e.preventDefault();
          s.removeSelected();
          break;
        case "ArrowLeft":
          e.preventDefault();
          s.setPlayhead(Math.max(0, s.playhead - 1 / s.project.fps));
          break;
        case "ArrowRight":
          e.preventDefault();
          s.setPlayhead(s.playhead + 1 / s.project.fps);
          break;
        case "Home":
          e.preventDefault();
          s.setPlayhead(0);
          break;
        case "End":
          e.preventDefault();
          s.setPlayhead(s.duration());
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-bg-0 text-text overflow-hidden">
      <Toolbar onExport={() => setShowExport(true)} />

      {warnBrowser && !dismissWarn && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 bg-amber-500/15 border-b border-amber-500/30 text-amber-200 text-xs">
          <span>
            ⚠ このブラウザは WebCodecs に未対応のため、書き出しが利用できません。編集とプレビューは可能です。Chrome / Edge を推奨します。
          </span>
          <button className="btn" style={{ padding: "2px 8px" }} onClick={() => setDismissWarn(true)}>
            閉じる
          </button>
        </div>
      )}

      {/* 上段: メディア / プレビュー / インスペクタ */}
      <div className="flex-1 flex gap-2 p-2 min-h-0">
        <div style={{ width: 250 }} className="flex-shrink-0 min-h-0">
          <MediaBin />
        </div>
        <div className="flex-1 min-w-0 min-h-0">
          <PreviewMonitor />
        </div>
        <div style={{ width: 290 }} className="flex-shrink-0 min-h-0">
          <Inspector />
        </div>
      </div>

      {/* 下段: タイムライン */}
      <div style={{ height: "38vh" }} className="flex-shrink-0 px-2 pb-2 min-h-0">
        <Timeline />
      </div>

      {showExport && <ExportDialog onClose={() => setShowExport(false)} />}

      {!restored && (
        <div className="fixed bottom-3 left-3 text-xs text-text-dim bg-bg-2 border border-border rounded-md px-3 py-1.5">
          保存データを復元中...
        </div>
      )}
    </div>
  );
}
