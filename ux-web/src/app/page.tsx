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
        background: "#0a0a0a",
        color: "#fafafa",
      }}
    >
      <VoiceShell />
    </main>
  );
}
