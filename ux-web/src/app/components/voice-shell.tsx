"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { PipecatClient } from "@pipecat-ai/client-js";
import {
  PipecatClientProvider,
  PipecatClientAudio,
  useRTVIClientEvent,
} from "@pipecat-ai/client-react";
import { DailyTransport } from "@pipecat-ai/daily-transport";

type ShapeState = {
  shape: "circle" | "triangle" | "square" | "pentagon" | "hexagon" | "star" | "diamond";
  color: string;
  size: "small" | "medium" | "large";
  fill: "solid" | "outline";
} | null;

function polygonPoints(cx: number, cy: number, r: number, sides: number): string {
  return Array.from({ length: sides }, (_, i) => {
    const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  }).join(" ");
}

function starPoints(cx: number, cy: number, outerR: number, innerR: number): string {
  return Array.from({ length: 10 }, (_, i) => {
    const angle = (Math.PI * i) / 5 - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  }).join(" ");
}

function renderShapeSvg(shape: NonNullable<ShapeState>) {
  const fill = shape.fill === "solid" ? shape.color : "none";
  const stroke = shape.fill === "solid" ? "none" : shape.color;
  const strokeWidth = shape.fill === "outline" ? 6 : undefined;
  const attrs = { fill, stroke, strokeWidth };

  switch (shape.shape) {
    case "circle":
      return <circle cx="50" cy="50" r="45" {...attrs} />;
    case "square":
      return <rect x="5" y="5" width="90" height="90" {...attrs} />;
    case "triangle":
      return <polygon points="50,5 95,95 5,95" {...attrs} />;
    case "diamond":
      return <polygon points="50,5 95,50 50,95 5,50" {...attrs} />;
    case "pentagon":
      return <polygon points={polygonPoints(50, 50, 45, 5)} {...attrs} />;
    case "hexagon":
      return <polygon points={polygonPoints(50, 50, 45, 6)} {...attrs} />;
    case "star":
      return <polygon points={starPoints(50, 50, 45, 20)} {...attrs} />;
  }
}

function ShapeDisplay({ shape, flash }: { shape: ShapeState; flash: boolean }) {
  const sizePx = shape ? { small: 200, medium: 400, large: 600 }[shape.size] : 300;

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
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: flash
            ? "radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)"
            : "none",
          transition: "background 0.3s ease-out",
        }}
      />
      {shape ? (
        <svg
          width={sizePx}
          height={sizePx}
          viewBox="0 0 100 100"
          style={{
            maxWidth: "70vw",
            maxHeight: "70vh",
            transition: "transform 0.15s ease-out",
            transform: flash ? "scale(1.05)" : "scale(1)",
            filter: flash ? `drop-shadow(0 0 20px ${shape.color})` : "none",
          }}
        >
          {renderShapeSvg(shape)}
        </svg>
      ) : (
        <div style={{ textAlign: "center", color: "#555", userSelect: "none" }}>
          <div style={{ fontSize: "5rem", marginBottom: "1rem", opacity: 0.3 }}>◇</div>
          <p style={{ fontSize: "1rem" }}>Ask for a shape</p>
        </div>
      )}
      <div
        style={{
          marginTop: "1.5rem",
          fontSize: "0.85rem",
          color: "#666",
          transition: "opacity 0.3s",
          opacity: shape ? 1 : 0.4,
        }}
      >
        {shape
          ? `${shape.size} · ${shape.fill} · ${shape.color} · ${shape.shape}`
          : `Try: "large solid coral hexagon"`}
      </div>
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
    <div style={{ flex: 1, overflowY: "auto", padding: "0.5rem 0" }}>
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
  shape,
  flash,
  onShapeUpdate,
  onEnd,
}: {
  shape: ShapeState;
  flash: boolean;
  onShapeUpdate: (s: ShapeState) => void;
  onEnd: () => void;
}) {
  useRTVIClientEvent(
    "serverMessage" as any,
    useCallback(
      (msg: any) => {
        const data = msg?.data ?? msg;
        if (data?.type === "shape_update") {
          onShapeUpdate({
            shape: data.shape,
            color: data.color,
            size: data.size,
            fill: data.fill,
          });
        }
      },
      [onShapeUpdate]
    )
  );

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh" }}>
      {/* Left pane: transcript */}
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
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.25rem" }}>
          DA Voice Hackathon
        </h2>
        <p style={{ color: "#666", fontSize: "0.8rem", marginBottom: "1rem" }}>
          Talk to the AI to render geometric shapes
        </p>

        <div
          style={{
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

      {/* Right pane: shape display */}
      <ShapeDisplay shape={shape} flash={flash} />
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
  const [currentShape, setCurrentShape] = useState<ShapeState>(null);
  const [flash, setFlash] = useState(false);
  const flashTimeout = useRef<ReturnType<typeof setTimeout>>();

  const triggerFlash = useCallback(() => {
    setFlash(true);
    if (flashTimeout.current) clearTimeout(flashTimeout.current);
    flashTimeout.current = setTimeout(() => setFlash(false), 800);
  }, []);

  const handleShapeUpdate = useCallback(
    (s: ShapeState) => {
      setCurrentShape(s);
      triggerFlash();
    },
    [triggerFlash]
  );

  const startSession = async () => {
    setConnecting(true);
    try {
      await client.startBotAndConnect({ endpoint: "/api/connect" });
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
    setFlash(false);
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
            Click to start talking with the AI about shapes
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
          shape={currentShape}
          flash={flash}
          onShapeUpdate={handleShapeUpdate}
          onEnd={endSession}
        />
      )}
    </PipecatClientProvider>
  );
}
