// ===========================================================================
// メディア取り込み
// File -> object URL, メタ情報抽出(尺/解像度), サムネ生成。
// バイナリは OPFS へ保存して永続化。
// ===========================================================================

import { MediaAsset, uid } from "@/lib/timeline/model";
import { saveMediaBlob, saveMediaMeta } from "@/lib/storage/projectStore";

function detectType(mime: string): MediaAsset["type"] {
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("image/")) return "image";
  return "video";
}

/** 動画から最初のフレームのサムネを作る */
function makeVideoThumbnail(video: HTMLVideoElement): string | null {
  try {
    const canvas = document.createElement("canvas");
    const w = 320;
    const ratio = video.videoHeight / video.videoWidth || 0.5625;
    canvas.width = w;
    canvas.height = Math.round(w * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.7);
  } catch {
    return null;
  }
}

function loadVideoMeta(url: string): Promise<{
  duration: number;
  width: number;
  height: number;
  thumbnail: string | null;
  hasAudio: boolean;
}> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.src = url;
    video.crossOrigin = "anonymous";
    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
    };
    video.onloadeddata = () => {
      // サムネのため少しシーク
      const seekTo = Math.min(0.1, (video.duration || 1) / 2);
      const grab = () => {
        const thumbnail = makeVideoThumbnail(video);
        // hasAudio 推定 (標準APIでは厳密に取れないため属性で推定)
        const v = video as HTMLVideoElement & {
          mozHasAudio?: boolean;
          webkitAudioDecodedByteCount?: number;
          audioTracks?: { length: number };
        };
        const hasAudio =
          v.mozHasAudio ||
          Boolean(v.webkitAudioDecodedByteCount) ||
          (v.audioTracks ? v.audioTracks.length > 0 : true);
        resolve({
          duration: video.duration || 0,
          width: video.videoWidth,
          height: video.videoHeight,
          thumbnail,
          hasAudio,
        });
        cleanup();
      };
      if (video.currentTime < seekTo) {
        video.onseeked = grab;
        video.currentTime = seekTo;
      } else {
        grab();
      }
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("動画の読み込みに失敗しました"));
    };
  });
}

function loadAudioMeta(url: string): Promise<{ duration: number }> {
  return new Promise((resolve, reject) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.src = url;
    audio.onloadedmetadata = () => resolve({ duration: audio.duration || 0 });
    audio.onerror = () => reject(new Error("音声の読み込みに失敗しました"));
  });
}

function loadImageMeta(
  url: string
): Promise<{ width: number; height: number; thumbnail: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = url;
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight, thumbnail: url });
    img.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
  });
}

/** 1ファイルを取り込んで MediaAsset を生成(永続化込み) */
export async function importFile(file: File): Promise<MediaAsset> {
  const id = uid("media");
  const url = URL.createObjectURL(file);
  const type = detectType(file.type || "");

  const base: MediaAsset = {
    id,
    name: file.name,
    type,
    durationSec: 0,
    width: 1920,
    height: 1080,
    url,
    thumbnail: null,
    mimeType: file.type || "video/mp4",
    hasAudio: type !== "image",
  };

  if (type === "video") {
    const meta = await loadVideoMeta(url);
    base.durationSec = meta.duration;
    base.width = meta.width;
    base.height = meta.height;
    base.thumbnail = meta.thumbnail;
    base.hasAudio = meta.hasAudio;
  } else if (type === "audio") {
    const meta = await loadAudioMeta(url);
    base.durationSec = meta.duration;
    base.hasAudio = true;
  } else {
    const meta = await loadImageMeta(url);
    base.width = meta.width;
    base.height = meta.height;
    base.thumbnail = meta.thumbnail;
    base.durationSec = 5; // 画像はデフォルト5秒
    base.hasAudio = false;
  }

  // 永続化(OPFS未対応環境では skip)
  try {
    const key = await saveMediaBlob(id, file);
    if (key) {
      base.storageKey = key;
      await saveMediaMeta(base);
    }
  } catch {
    /* 永続化失敗は致命的でない */
  }

  return base;
}

/** URL(public配下のサンプル等)から取り込む */
export async function importFromUrl(url: string, name: string): Promise<MediaAsset> {
  const res = await fetch(url);
  const blob = await res.blob();
  const file = new File([blob], name, { type: blob.type || "video/mp4" });
  return importFile(file);
}

export async function importFiles(files: FileList | File[]): Promise<MediaAsset[]> {
  const arr = Array.from(files);
  const results: MediaAsset[] = [];
  for (const f of arr) {
    try {
      results.push(await importFile(f));
    } catch (e) {
      console.error("取り込み失敗:", f.name, e);
    }
  }
  return results;
}
