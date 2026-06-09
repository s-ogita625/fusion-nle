// ===========================================================================
// 再生コントローラ
// playhead を実時間で進め、各トラックのアクティブクリップに対応する
// メディア要素を同期再生し、毎フレーム compositor で描画する。
// 音声はメディア要素のネイティブ出力をそのまま使う(プレビュー簡潔化)。
// ===========================================================================

import { Project, clipEnd } from "@/lib/timeline/model";
import { mediaPool } from "./mediaPool";
import { activeClip, effectiveOpacity, renderFrame } from "./compositor";

const SYNC_THRESHOLD = 0.25; // この差(秒)を超えたらシーク補正

export class PlaybackController {
  private ctx: CanvasRenderingContext2D;
  private getProject: () => Project;
  private onTick: (t: number) => void;
  private raf = 0;
  private lastWall = 0;
  private playing = false;
  private playhead = 0;

  constructor(
    canvas: HTMLCanvasElement,
    getProject: () => Project,
    onTick: (t: number) => void
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context を取得できません");
    this.ctx = ctx;
    this.getProject = getProject;
    this.onTick = onTick;
  }

  setPlayhead(t: number) {
    this.playhead = Math.max(0, t);
  }

  /** 現在の playhead でフレームを描く(同期はしない) */
  draw() {
    renderFrame(this.ctx, this.getProject(), this.playhead);
  }

  /** スクラブ: 全映像要素を seek してから描画 */
  seek(t: number) {
    this.playhead = Math.max(0, t);
    const project = this.getProject();
    let pending = 0;
    let drawn = false;
    const tryDraw = () => {
      if (!drawn) {
        this.draw();
      }
    };

    for (const track of project.tracks) {
      if (track.kind === "text") continue;
      const clip = activeClip(track, t);
      if (!clip || !clip.mediaId) continue;
      const asset = mediaPool.getAsset(clip.mediaId);
      if (!asset || asset.type === "image") continue;
      const el =
        asset.type === "audio" ? mediaPool.getAudio(asset) : mediaPool.getVideo(asset);
      const target = clip.sourceInSec + (t - clip.startSec);
      if (Math.abs(el.currentTime - target) > 0.04) {
        pending++;
        const onSeeked = () => {
          el.removeEventListener("seeked", onSeeked);
          pending--;
          this.draw();
          drawn = true;
        };
        el.addEventListener("seeked", onSeeked);
        try {
          el.currentTime = Math.max(0, target);
        } catch {
          pending--;
        }
      }
    }
    // 即時に一度描画(seek完了後にも再描画される)
    if (pending === 0) tryDraw();
    else this.draw();
  }

  play() {
    if (this.playing) return;
    this.playing = true;
    this.lastWall = performance.now();
    const project = this.getProject();
    const total = duration(project);
    if (this.playhead >= total - 0.001) this.playhead = 0;
    this.loop();
  }

  pause() {
    this.playing = false;
    cancelAnimationFrame(this.raf);
    mediaPool.pauseAll();
  }

  private loop = () => {
    if (!this.playing) return;
    const now = performance.now();
    const delta = (now - this.lastWall) / 1000;
    this.lastWall = now;
    this.playhead += delta;

    const project = this.getProject();
    const total = duration(project);

    this.syncMedia(project);
    this.draw();
    this.onTick(this.playhead);

    if (this.playhead >= total) {
      this.playhead = total;
      this.pause();
      this.onTick(this.playhead);
      return;
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  /** 再生中: アクティブクリップの要素を再生・同期、それ以外を停止 */
  private syncMedia(project: Project) {
    const t = this.playhead;
    const activeEls = new Set<HTMLMediaElement>();

    for (const track of project.tracks) {
      if (track.kind === "text") continue;
      const clip = activeClip(track, t);
      if (!clip || !clip.mediaId) continue;
      const asset = mediaPool.getAsset(clip.mediaId);
      if (!asset || asset.type === "image") continue;
      const el =
        asset.type === "audio" ? mediaPool.getAudio(asset) : mediaPool.getVideo(asset);
      activeEls.add(el);

      const target = clip.sourceInSec + (t - clip.startSec);
      if (Math.abs(el.currentTime - target) > SYNC_THRESHOLD) {
        try {
          el.currentTime = Math.max(0, target);
        } catch {
          /* ignore */
        }
      }
      // 音量(トラックミュート + クリップ音量 + フェード)
      const fadeVol = effectiveOpacity({ ...clip, opacity: 1 }, t);
      const vol = track.muted ? 0 : clip.volume * fadeVol;
      el.volume = Math.max(0, Math.min(1, vol));
      if (el.paused) {
        el.play().catch(() => {});
      }
    }

    // 非アクティブ要素を停止
    mediaPool.forEachPlayable((el) => {
      if (!activeEls.has(el) && !el.paused) el.pause();
    });
  }

  dispose() {
    this.pause();
  }
}

function duration(project: Project): number {
  let max = 0;
  for (const t of project.tracks)
    for (const c of t.clips) max = Math.max(max, clipEnd(c));
  return max;
}
