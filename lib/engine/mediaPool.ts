// ===========================================================================
// メディア要素プール
// mediaId ごとに HTMLVideoElement / HTMLAudioElement / HTMLImageElement を
// 1つ確保し再利用する。プレビュー再生・スクラブ・サムネ描画に使う。
// ===========================================================================

import { MediaAsset } from "@/lib/timeline/model";

type Element = HTMLVideoElement | HTMLAudioElement | HTMLImageElement;

class MediaPool {
  private videos = new Map<string, HTMLVideoElement>();
  private audios = new Map<string, HTMLAudioElement>();
  private images = new Map<string, HTMLImageElement>();
  private assets = new Map<string, MediaAsset>();

  registerAssets(assets: MediaAsset[]) {
    for (const a of assets) this.assets.set(a.id, a);
  }

  getAsset(id: string): MediaAsset | undefined {
    return this.assets.get(id);
  }

  getVideo(asset: MediaAsset): HTMLVideoElement {
    let v = this.videos.get(asset.id);
    if (!v) {
      v = document.createElement("video");
      v.src = asset.url;
      v.preload = "auto";
      v.playsInline = true;
      v.crossOrigin = "anonymous";
      v.muted = false;
      this.videos.set(asset.id, v);
    }
    return v;
  }

  getAudio(asset: MediaAsset): HTMLAudioElement {
    let a = this.audios.get(asset.id);
    if (!a) {
      a = document.createElement("audio");
      a.src = asset.url;
      a.preload = "auto";
      this.audios.set(asset.id, a);
    }
    return a;
  }

  getImage(asset: MediaAsset): HTMLImageElement {
    let img = this.images.get(asset.id);
    if (!img) {
      img = new Image();
      img.src = asset.url;
      this.images.set(asset.id, img);
    }
    return img;
  }

  /** すべての再生要素を一時停止 */
  pauseAll() {
    this.videos.forEach((v) => v.pause());
    this.audios.forEach((a) => a.pause());
  }

  forEachPlayable(fn: (el: HTMLVideoElement | HTMLAudioElement) => void) {
    this.videos.forEach(fn);
    this.audios.forEach(fn);
  }

  has(id: string): boolean {
    return this.assets.has(id);
  }
}

export const mediaPool = new MediaPool();
export type { Element };
