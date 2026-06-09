"use client";

import { useEffect, useRef } from "react";
import { useEditor } from "@/lib/store/editorStore";
import { mediaPool } from "@/lib/engine/mediaPool";
import { PlaybackController } from "@/lib/engine/playback";
import { Transport } from "./Transport";

export function PreviewMonitor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<PlaybackController | null>(null);

  const project = useEditor((s) => s.project);
  const media = useEditor((s) => s.media);
  const playing = useEditor((s) => s.playing);
  const playhead = useEditor((s) => s.playhead);
  const setPlayhead = useEditor((s) => s.setPlayhead);
  const setPlaying = useEditor((s) => s.setPlaying);

  // メディアをプールへ登録
  useEffect(() => {
    mediaPool.registerAssets(media);
  }, [media]);

  // canvas 解像度をプロジェクトに合わせる
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = project.width;
    canvas.height = project.height;
  }, [project.width, project.height]);

  // コントローラ初期化
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const controller = new PlaybackController(
      canvas,
      () => useEditor.getState().project,
      (t) => setPlayhead(t)
    );
    controllerRef.current = controller;
    controller.setPlayhead(useEditor.getState().playhead);
    controller.draw();

    // 再生終了でストアの playing を false に戻す同期
    const unsub = useEditor.subscribe((state, prev) => {
      if (prev.playing && !state.playing) {
        // controller 内部で停止済み
      }
    });
    return () => {
      unsub();
      controller.dispose();
    };
  }, [setPlayhead]);

  // 再生/停止
  useEffect(() => {
    const c = controllerRef.current;
    if (!c) return;
    if (playing) c.play();
    else c.pause();
  }, [playing]);

  // 外部スクラブ(停止中の playhead 変化)に追従
  useEffect(() => {
    const c = controllerRef.current;
    if (!c) return;
    if (!useEditor.getState().playing) {
      c.seek(playhead);
    }
  }, [playhead]);

  // 編集でプロジェクトが変わったら再描画
  useEffect(() => {
    const c = controllerRef.current;
    if (!c) return;
    if (!useEditor.getState().playing) c.draw();
  }, [project]);

  // controller が playhead=total で停止したら playing を false に
  useEffect(() => {
    const id = setInterval(() => {
      const st = useEditor.getState();
      if (st.playing) {
        const total = st.duration();
        if (st.playhead >= total - 0.0001 && total > 0) {
          setPlaying(false);
        }
      }
    }, 200);
    return () => clearInterval(id);
  }, [setPlaying]);

  return (
    <div className="flex flex-col h-full panel overflow-hidden">
      <div className="panel-header flex items-center justify-between">
        <span>プログラムモニタ</span>
        <span className="text-text-dim normal-case tracking-normal">
          {project.width}×{project.height} · {project.fps}fps
        </span>
      </div>
      <div className="flex-1 flex items-center justify-center bg-black/60 min-h-0 p-3">
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full object-contain shadow-lg"
          style={{ aspectRatio: `${project.width} / ${project.height}`, background: "#000" }}
        />
      </div>
      <Transport />
    </div>
  );
}
