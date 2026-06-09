// ===========================================================================
// 書き出し (WebCodecs)
// 1. タイムラインの音声を OfflineAudioContext でミックスダウン
// 2. フレームを1枚ずつ正確にシーク描画 -> VideoEncoder で H.264 エンコード
// 3. AudioEncoder で AAC エンコード
// 4. mp4-muxer で MP4 に多重化してダウンロード
// ※ WebCodecs 非対応ブラウザでは事前に検出してエラーを返す。
// ===========================================================================

import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import { MediaAsset, Project, clipEnd } from "@/lib/timeline/model";
import { activeClip, renderFrame } from "@/lib/engine/compositor";
import { mediaPool } from "@/lib/engine/mediaPool";

export interface ExportOptions {
  fps?: number;
  bitrate?: number;
  onProgress?: (ratio: number, label: string) => void;
}

export function isWebCodecsSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "VideoEncoder" in window &&
    "VideoFrame" in window
  );
}

function projectDuration(project: Project): number {
  let max = 0;
  for (const t of project.tracks)
    for (const c of t.clips) max = Math.max(max, clipEnd(c));
  return max;
}

/** メディア要素をフレーム精度でシークし、完了を待つ */
function seekElement(el: HTMLMediaElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    if (Math.abs(el.currentTime - t) < 0.001) {
      resolve();
      return;
    }
    const onSeeked = () => {
      el.removeEventListener("seeked", onSeeked);
      resolve();
    };
    el.addEventListener("seeked", onSeeked);
    try {
      el.currentTime = Math.max(0, t);
    } catch {
      resolve();
    }
  });
}

function waitReady(el: HTMLMediaElement): Promise<void> {
  return new Promise((resolve) => {
    if (el.readyState >= 2) resolve();
    else {
      const h = () => {
        el.removeEventListener("loadeddata", h);
        resolve();
      };
      el.addEventListener("loadeddata", h);
    }
  });
}

// --- 音声ミックスダウン ---
async function renderAudioMix(
  project: Project,
  totalDuration: number
): Promise<AudioBuffer | null> {
  const sampleRate = 48000;
  const channels = 2;
  const length = Math.ceil(totalDuration * sampleRate);
  if (length <= 0) return null;

  const OfflineCtx =
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  if (!OfflineCtx) return null;
  const offline = new OfflineCtx(channels, length, sampleRate);

  // 各メディアの decodeAudioData を1度だけ
  const decoded = new Map<string, AudioBuffer | null>();
  const decodeFor = async (asset: MediaAsset): Promise<AudioBuffer | null> => {
    if (decoded.has(asset.id)) return decoded.get(asset.id) ?? null;
    try {
      const res = await fetch(asset.url);
      const buf = await res.arrayBuffer();
      const ab = await offline.decodeAudioData(buf);
      decoded.set(asset.id, ab);
      return ab;
    } catch {
      decoded.set(asset.id, null);
      return null;
    }
  };

  let anyAudio = false;
  for (const track of project.tracks) {
    if (track.kind === "text" || track.muted) continue;
    for (const clip of track.clips) {
      if (!clip.mediaId) continue;
      const asset = mediaPool.getAsset(clip.mediaId);
      if (!asset || !asset.hasAudio) continue;
      const ab = await decodeFor(asset);
      if (!ab) continue;
      anyAudio = true;

      const src = offline.createBufferSource();
      src.buffer = ab;
      const gain = offline.createGain();
      // フェード適用
      const startT = clip.startSec;
      const dur = clip.durationSec;
      gain.gain.setValueAtTime(clip.volume, startT);
      if (clip.fades.in > 0) {
        gain.gain.setValueAtTime(0, startT);
        gain.gain.linearRampToValueAtTime(clip.volume, startT + clip.fades.in);
      }
      if (clip.fades.out > 0) {
        gain.gain.setValueAtTime(clip.volume, Math.max(startT, startT + dur - clip.fades.out));
        gain.gain.linearRampToValueAtTime(0, startT + dur);
      }
      src.connect(gain).connect(offline.destination);
      src.start(startT, clip.sourceInSec, dur);
    }
  }

  if (!anyAudio) return null;
  return offline.startRendering();
}

/** AudioBuffer を planar f32 で AudioEncoder に流す */
async function encodeAudio(
  audioBuffer: AudioBuffer,
  muxer: Muxer<ArrayBufferTarget>
): Promise<void> {
  if (!("AudioEncoder" in window)) return;
  const sampleRate = audioBuffer.sampleRate;
  const numberOfChannels = audioBuffer.numberOfChannels;

  const encoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (e) => console.error("AudioEncoder:", e),
  });
  encoder.configure({
    codec: "mp4a.40.2",
    sampleRate,
    numberOfChannels,
    bitrate: 128000,
  });

  // interleaved f32 へ変換
  const frameCount = audioBuffer.length;
  const interleaved = new Float32Array(frameCount * numberOfChannels);
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const data = audioBuffer.getChannelData(ch);
    for (let i = 0; i < frameCount; i++) {
      interleaved[i * numberOfChannels + ch] = data[i];
    }
  }

  const audioData = new AudioData({
    format: "f32",
    sampleRate,
    numberOfFrames: frameCount,
    numberOfChannels,
    timestamp: 0,
    data: interleaved,
  });
  encoder.encode(audioData);
  audioData.close();
  await encoder.flush();
  encoder.close();
}

/** メイン: タイムラインを MP4 にエクスポート */
export async function exportTimeline(
  project: Project,
  options: ExportOptions = {}
): Promise<Blob> {
  if (!isWebCodecsSupported()) {
    throw new Error(
      "このブラウザは WebCodecs に未対応です。Chrome / Edge をお使いください。"
    );
  }
  const fps = options.fps ?? project.fps ?? 30;
  const { width, height } = project;
  const total = projectDuration(project);
  if (total <= 0) throw new Error("書き出すクリップがありません。");
  const totalFrames = Math.ceil(total * fps);
  const onProgress = options.onProgress ?? (() => {});

  // 音声を先にミックスダウン
  onProgress(0, "音声をミックス中...");
  let audioBuffer: AudioBuffer | null = null;
  try {
    audioBuffer = await renderAudioMix(project, total);
  } catch (e) {
    console.warn("音声ミックス失敗、映像のみ書き出します", e);
  }

  // muxer 設定
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width, height },
    ...(audioBuffer
      ? {
          audio: {
            codec: "aac",
            sampleRate: audioBuffer.sampleRate,
            numberOfChannels: audioBuffer.numberOfChannels,
          },
        }
      : {}),
    fastStart: "in-memory",
  });

  // VideoEncoder
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => console.error("VideoEncoder:", e),
  });
  const codec = width * height > 1280 * 720 ? "avc1.640028" : "avc1.42001f";
  encoder.configure({
    codec,
    width,
    height,
    bitrate: options.bitrate ?? 8_000_000,
    framerate: fps,
  });

  // 描画用 canvas
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("canvas context 取得失敗");

  // compositor が参照する mediaPool の video 要素を一時停止し、事前ロード
  mediaPool.pauseAll();
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      if (!clip.mediaId) continue;
      const asset = mediaPool.getAsset(clip.mediaId);
      if (asset && asset.type === "video") {
        const v = mediaPool.getVideo(asset);
        v.pause();
        v.muted = true;
        await waitReady(v);
      }
    }
  }

  // フレームループ
  for (let f = 0; f < totalFrames; f++) {
    const t = f / fps;
    // この時刻に必要な映像クリップをシーク(mediaPool の要素を直接)
    await seekActiveVideos(project, t);
    // 描画(compositor を流用 — mediaPool の要素を描く)
    renderFrame(ctx, project, t);

    const frame = new VideoFrame(canvas, {
      timestamp: Math.round((f / fps) * 1_000_000),
      duration: Math.round((1 / fps) * 1_000_000),
    });
    const keyFrame = f % (fps * 2) === 0; // 2秒ごとにキーフレーム
    encoder.encode(frame, { keyFrame });
    frame.close();

    if (f % 5 === 0) {
      onProgress((f / totalFrames) * 0.9, `映像エンコード中... ${f}/${totalFrames}`);
      // エンコーダのバックプレッシャ回避
      if (encoder.encodeQueueSize > 30) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }
  }

  onProgress(0.92, "映像を確定中...");
  await encoder.flush();
  encoder.close();

  if (audioBuffer) {
    onProgress(0.95, "音声エンコード中...");
    try {
      await encodeAudio(audioBuffer, muxer);
    } catch (e) {
      console.warn("音声エンコード失敗", e);
    }
  }

  onProgress(0.99, "MP4 を生成中...");
  muxer.finalize();
  const { buffer } = muxer.target;

  onProgress(1, "完了");
  return new Blob([buffer], { type: "video/mp4" });
}

async function seekActiveVideos(project: Project, t: number) {
  const tasks: Promise<void>[] = [];
  for (const track of project.tracks) {
    if (track.kind !== "video") continue;
    const clip = activeClip(track, t);
    if (!clip || !clip.mediaId) continue;
    const asset = mediaPool.getAsset(clip.mediaId);
    if (!asset || asset.type !== "video") continue;
    const el = mediaPool.getVideo(asset);
    const target = clip.sourceInSec + (t - clip.startSec);
    tasks.push(seekElement(el, target));
  }
  await Promise.all(tasks);
}

/** 生成済み Blob をダウンロード */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

