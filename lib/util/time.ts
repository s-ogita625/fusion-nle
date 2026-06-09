/** 秒を HH:MM:SS:FF (タイムコード) に整形 */
export function formatTimecode(sec: number, fps = 30): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const totalFrames = Math.round(sec * fps);
  const f = totalFrames % fps;
  const totalSeconds = Math.floor(totalFrames / fps);
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`;
}

/** 秒を M:SS に整形(短縮表示) */
export function formatClock(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
