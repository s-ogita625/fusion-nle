"use client";

import { useEditor } from "@/lib/store/editorStore";
import { formatTimecode } from "@/lib/util/time";
import {
  PauseIcon,
  PlayIcon,
  SkipEndIcon,
  SkipStartIcon,
} from "./icons";

export function Transport() {
  const playing = useEditor((s) => s.playing);
  const playhead = useEditor((s) => s.playhead);
  const setPlaying = useEditor((s) => s.setPlaying);
  const setPlayhead = useEditor((s) => s.setPlayhead);
  const project = useEditor((s) => s.project);
  const duration = useEditor((s) => s.duration());

  return (
    <div className="flex items-center justify-center gap-3 px-3 py-2 border-t border-border bg-bg-2/40">
      <div className="font-mono text-sm text-accent-2 tabular-nums w-[110px]">
        {formatTimecode(playhead, project.fps)}
      </div>
      <div className="flex items-center gap-1">
        <button
          className="btn btn-icon"
          title="先頭へ (Home)"
          onClick={() => setPlayhead(0)}
        >
          <SkipStartIcon />
        </button>
        <button
          className="btn btn-icon btn-accent"
          title="再生 / 一時停止 (Space)"
          onClick={() => setPlaying(!playing)}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button
          className="btn btn-icon"
          title="末尾へ (End)"
          onClick={() => setPlayhead(duration)}
        >
          <SkipEndIcon />
        </button>
      </div>
      <div className="font-mono text-sm text-text-dim tabular-nums w-[110px] text-right">
        {formatTimecode(duration, project.fps)}
      </div>
    </div>
  );
}
