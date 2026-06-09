"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor } from "@/lib/store/editorStore";
import { Clip, Track, clipEnd } from "@/lib/timeline/model";
import { collectSnapPoints, snap } from "@/lib/timeline/magnetic";
import { mediaPool } from "@/lib/engine/mediaPool";
import { formatTimecode } from "@/lib/util/time";
import { MuteIcon, VolumeIcon } from "./icons";

const HEADER_W = 132;
const TRACK_H = 64;
const RULER_H = 30;

type DragState =
  | { kind: "move"; clipId: string; origStart: number; grabDx: number; trackId: string }
  | { kind: "trim-start"; clipId: string; origStart: number; origDur: number; origSourceIn: number }
  | { kind: "trim-end"; clipId: string; origDur: number }
  | { kind: "scrub" }
  | null;

function trackColor(kind: Track["kind"]): string {
  if (kind === "video") return "var(--video)";
  if (kind === "audio") return "var(--audio)";
  return "var(--text-clip)";
}

export function Timeline() {
  const project = useEditor((s) => s.project);
  const pxPerSec = useEditor((s) => s.pxPerSec);
  const playhead = useEditor((s) => s.playhead);
  const setPlayhead = useEditor((s) => s.setPlayhead);
  const tool = useEditor((s) => s.tool);
  const selectedId = useEditor((s) => s.selectedClipId);
  const select = useEditor((s) => s.select);
  const moveClip = useEditor((s) => s.moveClip);
  const trimClip = useEditor((s) => s.trimClip);
  const splitClipAt = useEditor((s) => s.splitClipAt);
  const addClipFromMedia = useEditor((s) => s.addClipFromMedia);
  const toggleTrackMute = useEditor((s) => s.toggleTrackMute);
  const snapEnabled = useEditor((s) => s.snapEnabled);
  const duration = useEditor((s) => s.duration());

  const laneRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState>(null);
  // ドラッグ中のライブプレビュー(履歴を汚さない)
  const [preview, setPreview] = useState<{
    clipId: string;
    start?: number;
    dur?: number;
    sourceIn?: number;
  } | null>(null);
  const [dropHint, setDropHint] = useState<{ trackId: string; start: number } | null>(null);

  const totalSec = Math.max(duration + 5, 20);
  const contentW = totalSec * pxPerSec;

  function xToSec(clientX: number): number {
    const lane = laneRef.current;
    if (!lane) return 0;
    const rect = lane.getBoundingClientRect();
    const x = clientX - rect.left + lane.scrollLeft;
    return Math.max(0, x / pxPerSec);
  }

  // --- ポインタ移動/終了(window) ---
  useEffect(() => {
    if (!drag) return;
    function onMove(e: PointerEvent) {
      const sec = xToSec(e.clientX);
      if (drag!.kind === "scrub") {
        setPlayhead(sec);
        return;
      }
      const snapPts = snapEnabled
        ? collectSnapPoints(project.tracks, drag!.clipId)
        : [];
      const thr = 8 / pxPerSec;

      if (drag!.kind === "move") {
        let start = sec - drag!.grabDx;
        if (snapEnabled) {
          start = snap(start, [...snapPts, playhead], thr);
        }
        start = Math.max(0, start);
        setPreview({ clipId: drag!.clipId, start });
      } else if (drag!.kind === "trim-start") {
        let newStart = sec;
        if (snapEnabled) newStart = snap(newStart, [...snapPts, playhead], thr);
        const delta = newStart - drag!.origStart;
        const dur = drag!.origDur - delta;
        if (dur > 0.05) {
          setPreview({
            clipId: drag!.clipId,
            start: Math.max(0, newStart),
            dur,
            sourceIn: Math.max(0, drag!.origSourceIn + delta),
          });
        }
      } else if (drag!.kind === "trim-end") {
        let end = sec;
        if (snapEnabled) end = snap(end, [...snapPts, playhead], thr);
        const found = findClip(project, drag!.clipId);
        if (found) {
          const dur = end - found.clip.startSec;
          if (dur > 0.05) setPreview({ clipId: drag!.clipId, dur });
        }
      }
    }
    function onUp() {
      const d = drag!;
      const pv = preview;
      if (pv && d.kind === "move" && pv.start !== undefined) {
        // ドロップ先トラックを判定
        const targetTrackId = trackUnderPointer();
        moveClip(d.clipId, pv.start, targetTrackId ?? undefined);
      } else if (pv && d.kind === "trim-start" && pv.start !== undefined) {
        const delta = pv.start - d.origStart;
        trimClip(d.clipId, "start", delta);
      } else if (pv && d.kind === "trim-end" && pv.dur !== undefined) {
        const found = findClip(project, d.clipId);
        if (found) trimClip(d.clipId, "end", pv.dur - found.clip.durationSec);
      }
      setDrag(null);
      setPreview(null);
      lastPointerTrack.current = null;
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, preview, project, pxPerSec, snapEnabled, playhead]);

  const lastPointerTrack = useRef<string | null>(null);
  function trackUnderPointer(): string | null {
    return lastPointerTrack.current;
  }

  function startClipDrag(
    e: React.PointerEvent,
    clip: Clip,
    track: Track,
    mode: "move" | "trim-start" | "trim-end"
  ) {
    e.stopPropagation();
    select(clip.id);
    if (tool === "blade") {
      const sec = xToSec(e.clientX);
      splitClipAt(clip.id, sec);
      return;
    }
    if (mode === "move") {
      const sec = xToSec(e.clientX);
      setDrag({
        kind: "move",
        clipId: clip.id,
        origStart: clip.startSec,
        grabDx: sec - clip.startSec,
        trackId: track.id,
      });
    } else if (mode === "trim-start") {
      setDrag({
        kind: "trim-start",
        clipId: clip.id,
        origStart: clip.startSec,
        origDur: clip.durationSec,
        origSourceIn: clip.sourceInSec,
      });
    } else {
      setDrag({ kind: "trim-end", clipId: clip.id, origDur: clip.durationSec });
    }
  }

  // ルーラー目盛り
  const tickStep = pxPerSec >= 120 ? 1 : pxPerSec >= 50 ? 2 : pxPerSec >= 25 ? 5 : 10;
  const ticks: number[] = [];
  for (let s = 0; s <= totalSec; s += tickStep) ticks.push(s);

  return (
    <div className="flex flex-col h-full panel overflow-hidden">
      <div className="panel-header flex items-center justify-between">
        <span>タイムライン</span>
        <span className="normal-case tracking-normal text-text-dim">
          {project.mode === "magnetic" ? "マグネティック" : "トラック"}モード
        </span>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* トラックヘッダ列 */}
        <div
          className="flex-shrink-0 border-r border-border bg-bg-2/50"
          style={{ width: HEADER_W }}
        >
          <div style={{ height: RULER_H }} className="border-b border-border" />
          {project.tracks.map((track) => (
            <div
              key={track.id}
              className="flex items-center justify-between px-2 border-b border-border"
              style={{ height: TRACK_H }}
            >
              <span className="text-xs truncate" style={{ color: trackColor(track.kind) }}>
                {track.name}
              </span>
              {track.kind !== "text" && (
                <button
                  className="p-1 rounded hover:bg-bg-3"
                  title={track.muted ? "ミュート解除" : "ミュート"}
                  onClick={() => toggleTrackMute(track.id)}
                  style={{ color: track.muted ? "var(--danger)" : "var(--text-dim)" }}
                >
                  {track.muted ? <MuteIcon width={15} height={15} /> : <VolumeIcon width={15} height={15} />}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* スクロール可能なレーン */}
        <div ref={laneRef} className="flex-1 overflow-auto relative">
          <div style={{ width: contentW, position: "relative" }}>
            {/* ルーラー */}
            <div
              className="sticky top-0 z-20 bg-bg-2 border-b border-border cursor-pointer no-select"
              style={{ height: RULER_H }}
              onPointerDown={(e) => {
                setPlayhead(xToSec(e.clientX));
                setDrag({ kind: "scrub" });
              }}
            >
              {ticks.map((s) => (
                <div
                  key={s}
                  className="absolute top-0 h-full flex items-end pb-0.5"
                  style={{ left: s * pxPerSec }}
                >
                  <div className="w-px h-2 bg-border absolute top-0" />
                  <span className="text-[10px] text-text-dim font-mono pl-1">
                    {formatTimecode(s, project.fps).slice(3)}
                  </span>
                </div>
              ))}
            </div>

            {/* トラックレーン */}
            {project.tracks.map((track) => (
              <div
                key={track.id}
                data-track-id={track.id}
                className="relative border-b border-border"
                style={{ height: TRACK_H, background: "rgba(255,255,255,0.012)" }}
                onPointerEnter={() => {
                  lastPointerTrack.current = track.id;
                }}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes("application/x-media-id")) {
                    e.preventDefault();
                    setDropHint({ trackId: track.id, start: xToSec(e.clientX) });
                  }
                }}
                onDragLeave={() => setDropHint(null)}
                onDrop={(e) => {
                  const mediaId = e.dataTransfer.getData("application/x-media-id");
                  if (mediaId) {
                    e.preventDefault();
                    addClipFromMedia(mediaId, track.id, xToSec(e.clientX));
                    setDropHint(null);
                  }
                }}
              >
                {dropHint && dropHint.trackId === track.id && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-accent z-10"
                    style={{ left: dropHint.start * pxPerSec }}
                  />
                )}
                {track.clips.map((clip) => {
                  const pv = preview && preview.clipId === clip.id ? preview : null;
                  const start = pv?.start ?? clip.startSec;
                  const dur = pv?.dur ?? clip.durationSec;
                  const selected = selectedId === clip.id;
                  return (
                    <ClipView
                      key={clip.id}
                      clip={clip}
                      track={track}
                      left={start * pxPerSec}
                      width={Math.max(2, dur * pxPerSec)}
                      selected={selected}
                      tool={tool}
                      onStart={startClipDrag}
                    />
                  );
                })}
              </div>
            ))}

            {/* 再生ヘッド */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-accent-2 z-30 pointer-events-none"
              style={{ left: playhead * pxPerSec }}
            >
              <div className="w-3 h-3 -ml-[5px] -mt-0 rotate-45 bg-accent-2" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ClipView({
  clip,
  track,
  left,
  width,
  selected,
  tool,
  onStart,
}: {
  clip: Clip;
  track: Track;
  left: number;
  width: number;
  selected: boolean;
  tool: string;
  onStart: (
    e: React.PointerEvent,
    clip: Clip,
    track: Track,
    mode: "move" | "trim-start" | "trim-end"
  ) => void;
}) {
  const color = trackColor(track.kind);
  const asset = clip.mediaId ? mediaPool.getAsset(clip.mediaId) : undefined;
  const thumb = asset?.thumbnail ?? null;
  const cursor = tool === "blade" ? "crosshair" : "grab";

  return (
    <div
      className="absolute top-1 bottom-1 rounded-md overflow-hidden no-select"
      style={{
        left,
        width,
        background: color,
        outline: selected ? "2px solid #fff" : "1px solid rgba(0,0,0,0.3)",
        boxShadow: selected ? "0 0 0 1px var(--accent)" : "none",
        cursor,
      }}
      onPointerDown={(e) => onStart(e, clip, track, "move")}
    >
      {/* サムネ帯(映像) */}
      {track.kind === "video" && thumb && (
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: `url(${thumb})`,
            backgroundSize: "auto 100%",
            backgroundRepeat: "repeat-x",
          }}
        />
      )}
      {/* テキスト内容プレビュー */}
      <div className="relative px-2 py-1 text-[11px] font-medium text-white/95 truncate">
        {track.kind === "text" ? clip.text?.text || "テキスト" : clip.name}
      </div>
      {/* オーディオ波形ダミー(下部ライン) */}
      {track.kind === "audio" && (
        <div className="absolute bottom-1 left-1 right-1 h-4 flex items-end gap-px opacity-60">
          {Array.from({ length: Math.max(4, Math.floor(width / 4)) }).map((_, i) => (
            <div
              key={i}
              className="flex-1 bg-white/70 rounded-sm"
              style={{ height: `${20 + ((i * 37) % 80)}%` }}
            />
          ))}
        </div>
      )}
      {/* トリムハンドル */}
      {tool !== "blade" && (
        <>
          <div
            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30"
            onPointerDown={(e) => onStart(e, clip, track, "trim-start")}
          />
          <div
            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30"
            onPointerDown={(e) => onStart(e, clip, track, "trim-end")}
          />
        </>
      )}
    </div>
  );
}

// ローカル findClip(store の重複を避けるための軽量版)
function findClip(
  project: { tracks: Track[] },
  clipId: string
): { track: Track; clip: Clip } | null {
  for (const track of project.tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) return { track, clip };
  }
  return null;
}

void clipEnd;
