"use client";

import { useState, useCallback } from "react";
import { PipecatClient } from "@pipecat-ai/client-js";
import {
  PipecatClientProvider,
  PipecatClientAudio,
  useRTVIClientEvent,
} from "@pipecat-ai/client-react";
import { DailyTransport } from "@pipecat-ai/daily-transport";

function TranscriptDisplay() {
  const [messages, setMessages] = useState<
    { role: string; text: string; id: number }[]
  >([]);

  useRTVIClientEvent(
    "userTranscript" as any,
    useCallback((data: any) => {
      if (data.final) {
        setMessages((prev) => [
          ...prev.slice(-19),
          { role: "user", text: data.text, id: Date.now() },
        ]);
      }
    }, [])
  );

  useRTVIClientEvent(
    "botTranscript" as any,
    useCallback((data: any) => {
      setMessages((prev) => [
        ...prev.slice(-19),
        { role: "bot", text: data.text, id: Date.now() },
      ]);
    }, [])
  );

  return (
    <div
      style={{
        marginTop: "2rem",
        width: "100%",
        maxWidth: 500,
        maxHeight: 300,
        overflowY: "auto",
        padding: "1rem",
      }}
    >
      {messages.map((m) => (
        <div
          key={m.id}
          style={{
            textAlign: m.role === "user" ? "right" : "left",
            margin: "0.5rem 0",
          }}
        >
          <span
            style={{
              display: "inline-block",
              padding: "0.5rem 1rem",
              borderRadius: "1rem",
              background: m.role === "user" ? "#2563eb" : "#333",
              color: "#fff",
              maxWidth: "80%",
            }}
          >
            {m.text}
          </span>
        </div>
      ))}
    </div>
  );
}

export function VoiceShell() {
  const [client] = useState(
    () =>
      new PipecatClient({
        transport: new DailyTransport(),
        enableMic: true,
      })
  );
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const startSession = async () => {
    setConnecting(true);
    try {
      await client.startBotAndConnect({
        endpoint: "/api/connect",
      });
      setConnected(true);
    } catch (err) {
      console.error("Connection failed:", err);
    } finally {
      setConnecting(false);
    }
  };

  const endSession = async () => {
    await client.disconnect();
    setConnected(false);
  };

  return (
    <PipecatClientProvider client={client}>
      {!connected ? (
        <button
          onClick={startSession}
          disabled={connecting}
          style={{
            padding: "1rem 2rem",
            fontSize: "1.2rem",
            borderRadius: "0.75rem",
            border: "none",
            background: connecting ? "#555" : "#2563eb",
            color: "#fff",
            cursor: connecting ? "wait" : "pointer",
          }}
        >
          {connecting ? "Connecting..." : "Start Voice"}
        </button>
      ) : (
        <button
          onClick={endSession}
          style={{
            padding: "1rem 2rem",
            fontSize: "1.2rem",
            borderRadius: "0.75rem",
            border: "none",
            background: "#dc2626",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          End Session
        </button>
      )}
      <PipecatClientAudio />
      <TranscriptDisplay />
    </PipecatClientProvider>
  );
}
