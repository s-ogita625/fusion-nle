import type { MetadataRoute } from "next";

// PWA マニフェスト。Next.js が /manifest.webmanifest として配信し、
// <link rel="manifest"> も自動挿入する。
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fusion NLE — ブラウザ動画編集",
    short_name: "Fusion NLE",
    description:
      "Premiere Pro と Final Cut Pro の良さを合体させた、オフライン対応の動画編集アプリ。",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "landscape",
    background_color: "#0b0d11",
    theme_color: "#0b0d11",
    lang: "ja",
    categories: ["video", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
