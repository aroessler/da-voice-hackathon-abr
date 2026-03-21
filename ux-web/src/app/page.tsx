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
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#fafafa",
      }}
    >
      <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>
        DA Voice Hackathon
      </h1>
      <p style={{ color: "#888", marginBottom: "2rem" }}>
        Click the button to start talking with the AI assistant
      </p>
      <VoiceShell />
    </main>
  );
}
