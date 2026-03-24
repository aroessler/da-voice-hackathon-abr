"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { PipecatClient } from "@pipecat-ai/client-js";
import {
  PipecatClientProvider,
  PipecatClientAudio,
  useRTVIClientEvent,
} from "@pipecat-ai/client-react";
import { DailyTransport } from "@pipecat-ai/daily-transport";

type ShapeType = "circle" | "triangle" | "square" | "pentagon" | "hexagon" | "star" | "diamond";
type ShapeState = {
  shape: ShapeType;
  color: string;
  size: "small" | "medium" | "large";
  fill: "solid" | "outline";
  options: string[];
} | null;

function polygonPoints(cx: number, cy: number, r: number, sides: number, offset = 0): string {
  return Array.from({ length: sides }, (_, i) => {
    const angle = (Math.PI * 2 * i) / sides - Math.PI / 2 + offset;
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  }).join(" ");
}

function ShapePath({
  shape,
  fill,
  stroke,
  strokeWidth,
}: {
  shape: ShapeType;
  fill: string;
  stroke: string;
  strokeWidth?: number;
}) {
  const attrs = { fill, stroke, strokeWidth };

  switch (shape) {
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
    case "star": {
      const points = Array.from({ length: 10 }, (_, i) => {
        const angle = (Math.PI * i) / 5 - Math.PI / 2;
        const r = i % 2 === 0 ? 45 : 20;
        return `${50 + r * Math.cos(angle)},${50 + r * Math.sin(angle)}`;
      }).join(" ");
      return <polygon points={points} {...attrs} />;
    }
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
      <style>{`
        @keyframes shape-flash {
          0%   { opacity: 0.2; transform: scale(0.85); }
          50%  { opacity: 1;   transform: scale(1.05); }
          100% { opacity: 1;   transform: scale(1); }
        }
        .shape-flash {
          animation: shape-flash 0.6s ease-out;
        }
      `}</style>
      {shape ? (
        <svg
          width={sizePx}
          height={sizePx}
          viewBox="0 0 100 100"
          className={flash ? "shape-flash" : undefined}
          style={{
            maxWidth: "70vw",
            maxHeight: "50vh",
          }}
        >
          <ShapePath
            shape={shape.shape}
            fill={shape.fill === "solid" ? shape.color : "none"}
            stroke={shape.fill === "solid" ? "none" : shape.color}
            strokeWidth={shape.fill === "outline" ? 4 : undefined}
          />
        </svg>
      ) : (
        <div style={{ textAlign: "center", color: "#1a1a2e", userSelect: "none" }}>
          <div style={{ fontSize: "5rem", marginBottom: "1rem", opacity: 0.3 }}>
            ◇
          </div>
          <p style={{ fontSize: "1.1rem", fontWeight: 500 }}>
            Say hello to start the shape quiz!
          </p>
        </div>
      )}
    </div>
  );
}

const OPTION_COLORS = ["#FFB3BA", "#BAFFC9", "#BAE1FF", "#FFFFBA"];

function OptionsGrid({ options }: { options: string[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "0.75rem",
        padding: "1rem",
        maxWidth: 500,
        width: "100%",
        margin: "0 auto",
      }}
    >
      {options.map((option, i) => (
        <div
          key={option + i}
          style={{
            background: OPTION_COLORS[i % OPTION_COLORS.length],
            borderRadius: "1rem",
            padding: "1rem 1.5rem",
            fontSize: "1.2rem",
            fontWeight: "bold",
            color: "#1a1a2e",
            textAlign: "center",
            userSelect: "none",
          }}
        >
          {option}
        </div>
      ))}
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
              background: m.role === "user" ? "#667eea" : "#f0f0f0",
              color: m.role === "user" ? "#fff" : "#1a1a2e",
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
  currentShape,
  shapeFlash,
  onShapeUpdate,
  onEnd,
}: {
  currentShape: ShapeState;
  shapeFlash: boolean;
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
            options: data.options,
          });
        }
      },
      [onShapeUpdate]
    )
  );

  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100vh",
        background: "linear-gradient(180deg, #f0f4ff 0%, #e8f0fe 100%)",
      }}
    >
      {/* Left pane: transcript */}
      <div
        style={{
          width: 360,
          minWidth: 320,
          borderRight: "1px solid #e0e0e0",
          display: "flex",
          flexDirection: "column",
          padding: "1.5rem",
          background: "#ffffff",
          boxShadow: "2px 0 8px rgba(0,0,0,0.06)",
        }}
      >
        <h2
          style={{
            fontSize: "1.1rem",
            fontWeight: 600,
            marginBottom: "0.25rem",
            color: "#1a1a2e",
          }}
        >
          Shape Explorer!
        </h2>
        <p
          style={{
            color: "#555",
            fontSize: "0.8rem",
            marginBottom: "1rem",
          }}
        >
          Listen and say the shape name!
        </p>

        <div
          style={{
            fontSize: "0.75rem",
            color: "#888",
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

      {/* Right pane: shape display + options */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
        }}
      >
        <ShapeDisplay shape={currentShape} flash={shapeFlash} />
        {currentShape && currentShape.options.length > 0 && (
          <OptionsGrid options={currentShape.options} />
        )}
      </div>
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
  const [shapeFlash, setShapeFlash] = useState(false);
  const flashTimeout = useRef<ReturnType<typeof setTimeout>>();

  const triggerFlash = useCallback(() => {
    setShapeFlash(true);
    if (flashTimeout.current) clearTimeout(flashTimeout.current);
    flashTimeout.current = setTimeout(() => setShapeFlash(false), 800);
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
    setShapeFlash(false);
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
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "#fff",
          }}
        >
          <h1 style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>
            Shape Explorer!
          </h1>
          <p style={{ fontSize: "1.1rem", opacity: 0.9, marginBottom: "2rem" }}>
            Learn shapes with your voice!
          </p>
          <button
            onClick={startSession}
            disabled={connecting}
            style={{
              padding: "1rem 2.5rem",
              fontSize: "1.3rem",
              borderRadius: "0.75rem",
              border: "none",
              background: connecting ? "rgba(255,255,255,0.3)" : "#fff",
              color: connecting ? "#fff" : "#764ba2",
              cursor: connecting ? "wait" : "pointer",
              fontWeight: 700,
            }}
          >
            {connecting ? "Connecting..." : "Let's Go!"}
          </button>
        </div>
      ) : (
        <ConnectedUI
          currentShape={currentShape}
          shapeFlash={shapeFlash}
          onShapeUpdate={handleShapeUpdate}
          onEnd={endSession}
        />
      )}
    </PipecatClientProvider>
  );
}
