"use client";

import { useRef, useState } from "react";
import { useEditor } from "@/lib/store/editorStore";
import { importFiles, importFromUrl } from "@/lib/media/import";
import { deleteMediaBlob, deleteMediaMeta } from "@/lib/storage/projectStore";
import { formatClock } from "@/lib/util/time";
import { FilmIcon, ImportIcon, TrashIcon } from "./icons";
import { MediaAsset } from "@/lib/timeline/model";

export function MediaBin() {
  const media = useEditor((s) => s.media);
  const addMedia = useEditor((s) => s.addMedia);
  const removeMedia = useEditor((s) => s.removeMedia);
  const project = useEditor((s) => s.project);
  const playhead = useEditor((s) => s.playhead);
  const addClipFromMedia = useEditor((s) => s.addClipFromMedia);
  const inputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function handleFiles(files: FileList | File[]) {
    setImporting(true);
    try {
      const assets = await importFiles(files);
      if (assets.length) addMedia(assets);
    } finally {
      setImporting(false);
    }
  }

  async function loadSamples() {
    setImporting(true);
    try {
      const a = await importFromUrl("/samples/clipA.mp4", "サンプルA.mp4");
      const b = await importFromUrl("/samples/clipB.mp4", "サンプルB.mp4");
      addMedia([a, b]);
    } catch {
      /* ignore */
    } finally {
      setImporting(false);
    }
  }

  function addToTimeline(asset: MediaAsset) {
    // 種別に合うトラックを探す(なければ video/audio いずれか)
    const kind = asset.type === "audio" ? "audio" : "video";
    const track =
      project.tracks.find((t) => t.kind === kind) ??
      project.tracks.find((t) => t.kind === "video");
    if (track) addClipFromMedia(asset.id, track.id, playhead);
  }

  async function handleDelete(asset: MediaAsset) {
    removeMedia(asset.id);
    if (asset.storageKey) await deleteMediaBlob(asset.storageKey);
    await deleteMediaMeta(asset.id);
    URL.revokeObjectURL(asset.url);
  }

  return (
    <div
      className="flex flex-col h-full panel overflow-hidden"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        if (e.dataTransfer.files.length) {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }
      }}
    >
      <div className="panel-header flex items-center justify-between">
        <span>メディア</span>
        <button
          className="btn"
          style={{ padding: "3px 8px", fontSize: 12 }}
          onClick={() => inputRef.current?.click()}
          disabled={importing}
        >
          <ImportIcon width={14} height={14} />
          {importing ? "取込中..." : "読み込み"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="video/*,audio/*,image/*"
          multiple
          hidden
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      <div
        className="flex-1 overflow-y-auto p-2"
        style={dragOver ? { outline: "2px dashed var(--accent)", outlineOffset: -6 } : undefined}
      >
        {media.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-text-dim text-xs gap-3 px-4">
            <FilmIcon width={32} height={32} />
            <p>動画・音声・画像をドラッグ&ドロップ、または「読み込み」から追加</p>
            <button className="btn" onClick={loadSamples} disabled={importing}>
              サンプルを読み込む
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {media.map((asset) => (
              <div
                key={asset.id}
                className="group relative rounded-md overflow-hidden border border-border bg-bg-2 cursor-pointer hover:border-accent transition"
                title={`${asset.name}\nクリックでタイムラインに追加`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/x-media-id", asset.id);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => addToTimeline(asset)}
              >
                <div className="aspect-video bg-black flex items-center justify-center overflow-hidden">
                  {asset.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={asset.thumbnail}
                      alt={asset.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FilmIcon width={24} height={24} />
                  )}
                </div>
                <div className="px-1.5 py-1 flex items-center justify-between gap-1">
                  <span className="text-[11px] truncate flex-1">{asset.name}</span>
                  <span className="text-[10px] text-text-dim font-mono">
                    {formatClock(asset.durationSec)}
                  </span>
                </div>
                <button
                  className="absolute top-1 right-1 p-1 rounded bg-black/60 text-danger opacity-0 group-hover:opacity-100 transition"
                  title="削除"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(asset);
                  }}
                >
                  <TrashIcon width={13} height={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
