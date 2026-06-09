"use client";

import { useEditor } from "@/lib/store/editorStore";
import { Clip, TextStyle, Track } from "@/lib/timeline/model";

function findClipIn(
  tracks: Track[],
  clipId: string
): { track: Track; clip: Clip } | null {
  for (const track of tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) return { track, clip };
  }
  return null;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 mb-3">
      <label className="text-[11px] text-text-dim">{label}</label>
      {children}
    </div>
  );
}

function Slider({
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        className="range flex-1"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <span className="text-[11px] font-mono text-text-dim w-12 text-right">
        {format ? format(value) : value.toFixed(2)}
      </span>
    </div>
  );
}

export function Inspector() {
  const selectedId = useEditor((s) => s.selectedClipId);
  const tracks = useEditor((s) => s.project.tracks);
  const updateClip = useEditor((s) => s.updateClip);
  const project = useEditor((s) => s.project);
  const renameProject = useEditor((s) => s.renameProject);
  // セレクタ外で計算(新規オブジェクトを返すセレクタは無限ループになるため)
  const found = selectedId ? findClipIn(tracks, selectedId) : null;

  if (!found) {
    return (
      <div className="flex flex-col h-full panel overflow-hidden">
        <div className="panel-header">インスペクタ</div>
        <div className="flex-1 overflow-y-auto p-3">
          <Row label="プロジェクト名">
            <input
              type="text"
              value={project.name}
              onChange={(e) => renameProject(e.target.value)}
            />
          </Row>
          <Row label="解像度">
            <div className="text-sm text-text-dim">
              {project.width} × {project.height} / {project.fps}fps
            </div>
          </Row>
          <p className="text-xs text-text-dim mt-4 leading-relaxed">
            タイムライン上のクリップを選択すると、ここでプロパティを編集できます。
          </p>
        </div>
      </div>
    );
  }

  const clip = found.clip;
  const patch = (p: Partial<Clip>) => updateClip(clip.id, p);
  const patchText = (p: Partial<TextStyle>) =>
    patch({ text: { ...(clip.text as TextStyle), ...p } });

  const isText = found.track.kind === "text";
  const isAudio = found.track.kind === "audio";
  const isVisual = found.track.kind === "video" || isText;

  return (
    <div className="flex flex-col h-full panel overflow-hidden">
      <div className="panel-header flex items-center justify-between">
        <span>インスペクタ</span>
        <span className="normal-case tracking-normal text-text-dim truncate max-w-[120px]">
          {clip.name}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="text-[11px] text-text-dim">開始(秒)</label>
            <div className="text-sm font-mono">{clip.startSec.toFixed(2)}</div>
          </div>
          <div>
            <label className="text-[11px] text-text-dim">尺(秒)</label>
            <div className="text-sm font-mono">{clip.durationSec.toFixed(2)}</div>
          </div>
        </div>

        {isText && clip.text && (
          <>
            <div className="text-[11px] uppercase tracking-wide text-accent mb-2">
              テキスト
            </div>
            <Row label="内容">
              <textarea
                rows={2}
                value={clip.text.text}
                onChange={(e) => patchText({ text: e.target.value })}
              />
            </Row>
            <Row label={`フォントサイズ (${clip.text.fontSize}px)`}>
              <Slider
                value={clip.text.fontSize}
                min={16}
                max={240}
                step={1}
                onChange={(v) => patchText({ fontSize: v })}
                format={(v) => `${v.toFixed(0)}`}
              />
            </Row>
            <div className="grid grid-cols-2 gap-2">
              <Row label="文字色">
                <input
                  type="color"
                  value={clip.text.color}
                  onChange={(e) => patchText({ color: e.target.value })}
                  style={{ height: 32, padding: 2 }}
                />
              </Row>
              <Row label="配置">
                <select
                  value={clip.text.align}
                  onChange={(e) =>
                    patchText({ align: e.target.value as TextStyle["align"] })
                  }
                >
                  <option value="left">左</option>
                  <option value="center">中央</option>
                  <option value="right">右</option>
                </select>
              </Row>
            </div>
            <Row label="太さ">
              <select
                value={clip.text.fontWeight}
                onChange={(e) => patchText({ fontWeight: parseInt(e.target.value) })}
              >
                <option value={400}>標準</option>
                <option value={700}>太字</option>
                <option value={900}>極太</option>
              </select>
            </Row>
            <Row label={`水平位置 (${(clip.text.x * 100).toFixed(0)}%)`}>
              <Slider
                value={clip.text.x}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => patchText({ x: v })}
                format={(v) => `${(v * 100).toFixed(0)}%`}
              />
            </Row>
            <Row label={`垂直位置 (${(clip.text.y * 100).toFixed(0)}%)`}>
              <Slider
                value={clip.text.y}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => patchText({ y: v })}
                format={(v) => `${(v * 100).toFixed(0)}%`}
              />
            </Row>
            <Row label="背景帯">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={clip.text.background !== null}
                  onChange={(e) =>
                    patchText({ background: e.target.checked ? "#000000aa" : null })
                  }
                  style={{ width: "auto" }}
                />
                {clip.text.background !== null && (
                  <input
                    type="color"
                    value={clip.text.background.slice(0, 7)}
                    onChange={(e) => patchText({ background: e.target.value })}
                    style={{ height: 28, padding: 2, flex: 1 }}
                  />
                )}
              </div>
            </Row>
          </>
        )}

        {found.track.kind === "video" && (
          <>
            <div className="text-[11px] uppercase tracking-wide text-accent mb-2">
              トランスフォーム
            </div>
            <Row label="不透明度">
              <Slider
                value={clip.opacity}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => patch({ opacity: v })}
                format={(v) => `${(v * 100).toFixed(0)}%`}
              />
            </Row>
            <Row label="拡大">
              <Slider
                value={clip.transform.scale}
                min={0.1}
                max={3}
                step={0.01}
                onChange={(v) => patch({ transform: { ...clip.transform, scale: v } })}
              />
            </Row>
            <div className="grid grid-cols-2 gap-2">
              <Row label="X位置">
                <Slider
                  value={clip.transform.x}
                  min={-1}
                  max={1}
                  step={0.01}
                  onChange={(v) => patch({ transform: { ...clip.transform, x: v } })}
                />
              </Row>
              <Row label="Y位置">
                <Slider
                  value={clip.transform.y}
                  min={-1}
                  max={1}
                  step={0.01}
                  onChange={(v) => patch({ transform: { ...clip.transform, y: v } })}
                />
              </Row>
            </div>

            <div className="text-[11px] uppercase tracking-wide text-accent mb-2 mt-2">
              カラー補正
            </div>
            <Row label="明るさ">
              <Slider
                value={clip.brightness}
                min={-1}
                max={1}
                step={0.01}
                onChange={(v) => patch({ brightness: v })}
              />
            </Row>
            <Row label="コントラスト">
              <Slider
                value={clip.contrast}
                min={-1}
                max={1}
                step={0.01}
                onChange={(v) => patch({ contrast: v })}
              />
            </Row>
            <Row label="彩度">
              <Slider
                value={clip.saturation}
                min={-1}
                max={1}
                step={0.01}
                onChange={(v) => patch({ saturation: v })}
              />
            </Row>
          </>
        )}

        {(found.track.kind === "video" || isAudio) && (
          <>
            <div className="text-[11px] uppercase tracking-wide text-accent mb-2 mt-2">
              オーディオ
            </div>
            <Row label="音量">
              <Slider
                value={clip.volume}
                min={0}
                max={1.5}
                step={0.01}
                onChange={(v) => patch({ volume: v })}
                format={(v) => `${Math.round(v * 100)}%`}
              />
            </Row>
          </>
        )}

        {isVisual || isAudio ? (
          <>
            <div className="text-[11px] uppercase tracking-wide text-accent mb-2 mt-2">
              フェード
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Row label="フェードイン(秒)">
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={clip.fades.in}
                  onChange={(e) =>
                    patch({
                      fades: { ...clip.fades, in: Math.max(0, parseFloat(e.target.value) || 0) },
                    })
                  }
                />
              </Row>
              <Row label="フェードアウト(秒)">
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={clip.fades.out}
                  onChange={(e) =>
                    patch({
                      fades: { ...clip.fades, out: Math.max(0, parseFloat(e.target.value) || 0) },
                    })
                  }
                />
              </Row>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
