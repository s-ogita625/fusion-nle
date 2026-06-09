"use client";

import { useState } from "react";
import { useEditor } from "@/lib/store/editorStore";
import {
  downloadBlob,
  exportTimeline,
  isWebCodecsSupported,
} from "@/lib/export/exporter";
import { ExportIcon } from "./icons";

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const project = useEditor((s) => s.project);
  const setPlaying = useEditor((s) => s.setPlaying);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [bitrate, setBitrate] = useState(8);
  const [fps, setFps] = useState(project.fps);

  const supported = isWebCodecsSupported();

  async function run() {
    setBusy(true);
    setError(null);
    setDone(false);
    setPlaying(false);
    try {
      const blob = await exportTimeline(project, {
        fps,
        bitrate: bitrate * 1_000_000,
        onProgress: (r, l) => {
          setProgress(r);
          setLabel(l);
        },
      });
      const safeName = (project.name || "export").replace(/[^\w\-一-龠ぁ-ゖァ-ヺ]/g, "_");
      downloadBlob(blob, `${safeName}.mp4`);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "書き出しに失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={() => !busy && onClose()}
    >
      <div
        className="panel w-[440px] max-w-[92vw] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-4">
          <ExportIcon />
          <h2 className="text-base font-semibold">MP4 で書き出し</h2>
        </div>

        {!supported && (
          <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-md p-3 mb-4">
            このブラウザは WebCodecs に未対応です。Chrome / Edge
            の最新版でご利用ください。
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-[11px] text-text-dim">解像度</label>
            <div className="text-sm mt-1">
              {project.width} × {project.height}
            </div>
          </div>
          <div>
            <label className="text-[11px] text-text-dim">フレームレート</label>
            <select
              className="mt-1"
              value={fps}
              onChange={(e) => setFps(parseInt(e.target.value))}
              disabled={busy}
            >
              <option value={24}>24 fps</option>
              <option value={30}>30 fps</option>
              <option value={60}>60 fps</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-[11px] text-text-dim">
              ビットレート: {bitrate} Mbps
            </label>
            <input
              type="range"
              className="range mt-1"
              min={2}
              max={30}
              value={bitrate}
              onChange={(e) => setBitrate(parseInt(e.target.value))}
              disabled={busy}
            />
          </div>
        </div>

        {busy && (
          <div className="mb-4">
            <div className="h-2 rounded-full bg-bg-3 overflow-hidden">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <div className="text-xs text-text-dim mt-1.5">{label}</div>
          </div>
        )}

        {error && (
          <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-md p-3 mb-4">
            {error}
          </div>
        )}
        {done && (
          <div className="text-sm text-accent-2 bg-accent-2/10 border border-accent-2/30 rounded-md p-3 mb-4">
            ✓ 書き出しが完了しました。ダウンロードを確認してください。
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button className="btn" onClick={onClose} disabled={busy}>
            {done ? "閉じる" : "キャンセル"}
          </button>
          <button
            className="btn btn-accent"
            onClick={run}
            disabled={busy || !supported}
          >
            {busy ? "書き出し中..." : "書き出す"}
          </button>
        </div>
      </div>
    </div>
  );
}
