// 軽量インラインSVGアイコン群(依存追加なし)
import { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = (props: P) => ({
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...props,
});

export const PlayIcon = (p: P) => (
  <svg {...base(p)}>
    <polygon points="6 4 20 12 6 20 6 4" fill="currentColor" stroke="none" />
  </svg>
);
export const PauseIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="6" y="5" width="4" height="14" fill="currentColor" stroke="none" />
    <rect x="14" y="5" width="4" height="14" fill="currentColor" stroke="none" />
  </svg>
);
export const SkipStartIcon = (p: P) => (
  <svg {...base(p)}>
    <polygon points="19 5 9 12 19 19 19 5" fill="currentColor" stroke="none" />
    <line x1="6" y1="5" x2="6" y2="19" />
  </svg>
);
export const SkipEndIcon = (p: P) => (
  <svg {...base(p)}>
    <polygon points="5 5 15 12 5 19 5 5" fill="currentColor" stroke="none" />
    <line x1="18" y1="5" x2="18" y2="19" />
  </svg>
);
export const SelectIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 3l7 18 2-7 7-2L4 3z" fill="currentColor" stroke="none" />
  </svg>
);
export const BladeIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 3v12a3 3 0 1 0 2 2" />
    <line x1="7" y1="3" x2="7" y2="13" />
    <path d="M14 3l5 18" />
  </svg>
);
export const MagnetIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 4v7a6 6 0 0 0 12 0V4" />
    <line x1="3" y1="4" x2="9" y2="4" />
    <line x1="15" y1="4" x2="21" y2="4" />
    <line x1="6" y1="15" x2="9" y2="15" />
    <line x1="15" y1="15" x2="18" y2="15" />
  </svg>
);
export const LayersIcon = (p: P) => (
  <svg {...base(p)}>
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);
export const TextIcon = (p: P) => (
  <svg {...base(p)}>
    <polyline points="4 7 4 4 20 4 20 7" />
    <line x1="12" y1="4" x2="12" y2="20" />
    <line x1="9" y1="20" x2="15" y2="20" />
  </svg>
);
export const ImportIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);
export const ExportIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);
export const UndoIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 7v6h6" />
    <path d="M3 13a9 9 0 1 0 3-7L3 9" />
  </svg>
);
export const RedoIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M21 7v6h-6" />
    <path d="M21 13a9 9 0 1 1-3-7l3 3" />
  </svg>
);
export const TrashIcon = (p: P) => (
  <svg {...base(p)}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);
export const ScissorsIcon = BladeIcon;
export const PlusIcon = (p: P) => (
  <svg {...base(p)}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
export const VolumeIcon = (p: P) => (
  <svg {...base(p)}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
  </svg>
);
export const MuteIcon = (p: P) => (
  <svg {...base(p)}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
    <line x1="22" y1="9" x2="16" y2="15" />
    <line x1="16" y1="9" x2="22" y2="15" />
  </svg>
);
export const FilmIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="2" y="3" width="20" height="18" rx="2" />
    <line x1="7" y1="3" x2="7" y2="21" />
    <line x1="17" y1="3" x2="17" y2="21" />
    <line x1="2" y1="9" x2="22" y2="9" />
    <line x1="2" y1="15" x2="22" y2="15" />
  </svg>
);
