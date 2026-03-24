"use client";

import dynamic from "next/dynamic";

const VoiceShell = dynamic(
  () => import("./components/voice-shell").then((m) => m.VoiceShell),
  { ssr: false }
);

export default function Home() {
  return (
    <main
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f0f4ff 0%, #e8f0fe 100%)",
        color: "#1a1a2e",
      }}
    >
      <VoiceShell />
    </main>
  );
}
