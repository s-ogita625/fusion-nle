// ===========================================================================
// コンポジター
// 指定時刻 t におけるタイムラインの1フレームを canvas へ描画する。
// 下のトラックから順に重ねる(配列末尾が手前)。映像/テキストを合成。
// ===========================================================================

import { Clip, Project, Track, clipEnd } from "@/lib/timeline/model";
import { mediaPool } from "./mediaPool";

/** 時刻 t にアクティブなクリップを返す */
function activeClip(track: Track, t: number): Clip | null {
  for (const c of track.clips) {
    if (t >= c.startSec && t < clipEnd(c)) return c;
  }
  return null;
}

/** フェード込みの不透明度を計算 */
function effectiveOpacity(clip: Clip, t: number): number {
  const local = t - clip.startSec;
  const end = clip.durationSec;
  let o = clip.opacity;
  if (clip.fades.in > 0 && local < clip.fades.in) {
    o *= local / clip.fades.in;
  }
  if (clip.fades.out > 0 && local > end - clip.fades.out) {
    o *= Math.max(0, (end - local) / clip.fades.out);
  }
  return Math.max(0, Math.min(1, o));
}

function buildFilter(clip: Clip): string {
  const parts: string[] = [];
  if (clip.brightness !== 0) parts.push(`brightness(${1 + clip.brightness})`);
  if (clip.contrast !== 0) parts.push(`contrast(${1 + clip.contrast})`);
  if (clip.saturation !== 0) parts.push(`saturate(${1 + clip.saturation})`);
  return parts.length ? parts.join(" ") : "none";
}

/** 映像/画像を object-fit: contain で配置して描く */
function drawVisual(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  clip: Clip,
  canvasW: number,
  canvasH: number
) {
  if (!srcW || !srcH) return;
  const scale = Math.min(canvasW / srcW, canvasH / srcH) * clip.transform.scale;
  const dw = srcW * scale;
  const dh = srcH * scale;
  const dx = (canvasW - dw) / 2 + (clip.transform.x * canvasW) / 2;
  const dy = (canvasH - dh) / 2 + (clip.transform.y * canvasH) / 2;
  ctx.drawImage(source, dx, dy, dw, dh);
}

function drawText(
  ctx: CanvasRenderingContext2D,
  clip: Clip,
  canvasW: number,
  canvasH: number
) {
  const style = clip.text;
  if (!style) return;
  const fontSize = (style.fontSize / 1080) * canvasH;
  ctx.font = `${style.fontWeight} ${fontSize}px system-ui, -apple-system, "Hiragino Sans", sans-serif`;
  ctx.textAlign = style.align;
  ctx.textBaseline = "middle";
  const x = style.x * canvasW;
  const y = style.y * canvasH;
  const lines = style.text.split("\n");
  const lineHeight = fontSize * 1.2;
  const totalH = lineHeight * lines.length;

  if (style.background) {
    const metrics = lines.map((l) => ctx.measureText(l).width);
    const maxW = Math.max(...metrics, 0);
    const pad = fontSize * 0.3;
    ctx.fillStyle = style.background;
    let bgX = x - pad;
    if (style.align === "center") bgX = x - maxW / 2 - pad;
    if (style.align === "right") bgX = x - maxW - pad;
    ctx.fillRect(bgX, y - totalH / 2 - pad, maxW + pad * 2, totalH + pad * 2);
  }

  ctx.fillStyle = style.color;
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = fontSize * 0.08;
  lines.forEach((line, i) => {
    const ly = y - totalH / 2 + lineHeight * (i + 0.5);
    ctx.fillText(line, x, ly);
  });
  ctx.shadowBlur = 0;
}

/**
 * 1フレームを描画。
 * 戻り値: 表示中の映像クリップ群(再生制御で使う情報)
 */
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  project: Project,
  t: number
): void {
  const { width, height } = project;
  ctx.save();
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);

  // 配列の先頭が最背面。video→text の順で重ねたいので
  // tracks 配列の末尾(=上のレイヤー)を手前に描く。
  // model.ts のデフォルトは [text, video, audio] の順なので逆順で描画する。
  const drawOrder = [...project.tracks].reverse();

  for (const track of drawOrder) {
    if (track.kind === "audio") continue;
    const clip = activeClip(track, t);
    if (!clip) continue;

    const op = effectiveOpacity(clip, t);
    if (op <= 0) continue;
    ctx.globalAlpha = op;

    if (track.kind === "text") {
      drawText(ctx, clip, width, height);
    } else if (clip.mediaId) {
      const asset = mediaPool.getAsset(clip.mediaId);
      if (!asset) continue;
      ctx.filter = buildFilter(clip);
      if (asset.type === "image") {
        const img = mediaPool.getImage(asset);
        if (img.complete) drawVisual(ctx, img, asset.width, asset.height, clip, width, height);
      } else {
        const video = mediaPool.getVideo(asset);
        if (video.readyState >= 2) {
          drawVisual(
            ctx,
            video,
            video.videoWidth || asset.width,
            video.videoHeight || asset.height,
            clip,
            width,
            height
          );
        }
      }
      ctx.filter = "none";
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

export { activeClip, effectiveOpacity };
