"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { PipecatClient } from "@pipecat-ai/client-js";
import {
  PipecatClientProvider,
  PipecatClientAudio,
  useRTVIClientEvent,
  usePipecatClient,
} from "@pipecat-ai/client-react";
import { DailyTransport } from "@pipecat-ai/daily-transport";

function NumberDisplay({
  number,
  flash,
}: {
  number: number;
  flash: "bot" | "user" | null;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background glow on change */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            flash === "bot"
              ? "radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)"
              : flash === "user"
                ? "radial-gradient(circle, rgba(37,99,235,0.15) 0%, transparent 70%)"
                : "none",
          transition: "background 0.3s ease-out",
        }}
      />
      <div
        style={{
          fontSize: "clamp(8rem, 20vw, 20rem)",
          fontWeight: 800,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
          transition: "transform 0.15s ease-out, color 0.3s ease-out",
          transform: flash ? "scale(1.05)" : "scale(1)",
          color:
            flash === "bot"
              ? "#a78bfa"
              : flash === "user"
                ? "#60a5fa"
                : "#fafafa",
          textShadow: flash
            ? `0 0 60px ${flash === "bot" ? "rgba(139,92,246,0.5)" : "rgba(37,99,235,0.5)"}`
            : "none",
          userSelect: "none",
        }}
      >
        {number}
      </div>
      <div
        style={{
          marginTop: "1.5rem",
          fontSize: "0.85rem",
          color: "#666",
          transition: "opacity 0.3s",
          opacity: flash ? 1 : 0.5,
        }}
      >
        {flash === "bot"
          ? "Changed by AI"
          : flash === "user"
            ? "Changed by you"
            : "Say a number or use +/- buttons"}
      </div>
    </div>
  );
}

function NumberControls({
  number,
  onNumberChange,
}: {
  number: number;
  onNumberChange: (n: number) => void;
}) {
  return (
    <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
      <button
        onClick={() => onNumberChange(number - 1)}
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          border: "1px solid #333",
          background: "transparent",
          color: "#fafafa",
          fontSize: "1.5rem",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        -
      </button>
      <button
        onClick={() => onNumberChange(number + 1)}
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          border: "1px solid #333",
          background: "transparent",
          color: "#fafafa",
          fontSize: "1.5rem",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        +
      </button>
    </div>
  );
}

let msgCounter = 0;

function TranscriptDisplay() {
  const [messages, setMessages] = useState<
    { role: string; text: string; id: number }[]
  >([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useRTVIClientEvent(
    "userTranscript" as any,
    useCallback((data: any) => {
      if (data.final) {
        setMessages((prev) => [
          ...prev.slice(-29),
          { role: "user", text: data.text, id: ++msgCounter },
        ]);
      }
    }, [])
  );

  useRTVIClientEvent(
    "botTranscript" as any,
    useCallback((data: any) => {
      setMessages((prev) => [
        ...prev.slice(-29),
        { role: "bot", text: data.text, id: ++msgCounter },
      ]);
    }, [])
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "0.5rem 0",
      }}
    >
      {messages.map((m) => (
        <div
          key={m.id}
          style={{
            textAlign: m.role === "user" ? "right" : "left",
            margin: "0.4rem 0",
          }}
        >
          <span
            style={{
              display: "inline-block",
              padding: "0.4rem 0.8rem",
              borderRadius: "0.75rem",
              background: m.role === "user" ? "#2563eb" : "#222",
              color: "#fff",
              fontSize: "0.9rem",
              maxWidth: "85%",
            }}
          >
            {m.text}
          </span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

function ConnectedUI({
  number,
  flash,
  onNumberChange,
  onEnd,
}: {
  number: number;
  flash: "bot" | "user" | null;
  onNumberChange: (n: number) => void;
  onEnd: () => void;
}) {
  const client = usePipecatClient();

  useRTVIClientEvent(
    "serverMessage" as any,
    useCallback(
      (msg: any) => {
        const data = msg?.data ?? msg;
        if (data?.type === "number_update") {
          onNumberChange(data.value);
        }
      },
      [onNumberChange]
    )
  );

  const handleUserNumberChange = useCallback(
    (n: number) => {
      onNumberChange(n);
      try {
        client?.sendClientMessage("number_update", { value: n });
      } catch (err) {
        console.error("Failed to send number update:", err);
      }
    },
    [client, onNumberChange]
  );

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh" }}>
      {/* Left pane: controls + transcript */}
      <div
        style={{
          width: 360,
          minWidth: 320,
          borderRight: "1px solid #1a1a1a",
          display: "flex",
          flexDirection: "column",
          padding: "1.5rem",
          background: "#0a0a0a",
        }}
      >
        <h2
          style={{
            fontSize: "1.1rem",
            fontWeight: 600,
            marginBottom: "0.25rem",
          }}
        >
          DA Voice Hackathon
        </h2>
        <p style={{ color: "#666", fontSize: "0.8rem", marginBottom: "1rem" }}>
          Talk to the AI or use buttons to change the number
        </p>

        <NumberControls number={number} onNumberChange={handleUserNumberChange} />

        <div
          style={{
            marginTop: "1.5rem",
            fontSize: "0.75rem",
            color: "#555",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Transcript
        </div>
        <TranscriptDisplay />

        <button
          onClick={onEnd}
          style={{
            marginTop: "auto",
            padding: "0.6rem 1rem",
            borderRadius: "0.5rem",
            border: "none",
            background: "#dc2626",
            color: "#fff",
            cursor: "pointer",
            fontSize: "0.9rem",
          }}
        >
          End Session
        </button>
      </div>

      {/* Right pane: giant number */}
      <NumberDisplay number={number} flash={flash} />
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
  const [number, setNumber] = useState(0);
  const [flash, setFlash] = useState<"bot" | "user" | null>(null);
  const flashTimeout = useRef<ReturnType<typeof setTimeout>>();

  const triggerFlash = useCallback((source: "bot" | "user") => {
    setFlash(source);
    if (flashTimeout.current) clearTimeout(flashTimeout.current);
    flashTimeout.current = setTimeout(() => setFlash(null), 800);
  }, []);

  const handleNumberChange = useCallback(
    (n: number) => {
      setNumber(n);
      triggerFlash("bot");
    },
    [triggerFlash]
  );

  const handleUserNumberChange = useCallback(
    (n: number) => {
      setNumber(n);
      triggerFlash("user");
    },
    [triggerFlash]
  );

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
    setNumber(0);
    setFlash(null);
  };

  return (
    <PipecatClientProvider client={client}>
      <PipecatClientAudio />
      {!connected ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100vh",
          }}
        >
          <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>
            DA Voice Hackathon
          </h1>
          <p style={{ color: "#888", marginBottom: "2rem" }}>
            Click to start talking with the AI about numbers
          </p>
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
        </div>
      ) : (
        <ConnectedUI
          number={number}
          flash={flash}
          onNumberChange={handleNumberChange}
          onEnd={endSession}
        />
      )}
    </PipecatClientProvider>
  );
}
