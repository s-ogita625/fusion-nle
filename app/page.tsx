"use client";

import dynamic from "next/dynamic";

// エディタ本体はブラウザAPI(WebCodecs/OPFS/canvas)に強く依存するため
// SSR を無効化してクライアントのみで読み込む。
const EditorShell = dynamic(() => import("@/components/editor/EditorShell"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#9aa3b2",
        fontSize: 14,
      }}
    >
      エディタを起動中...
    </div>
  ),
});

export default function Home() {
  return <EditorShell />;
}
