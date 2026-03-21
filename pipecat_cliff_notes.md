# Pipecat & Daily RTC: Implementation Blueprint

This guide details how to build a real-time, voice-first application with a synchronized UI using Pipecat and Daily.co.

## 1. High-Level Architecture

The "Backlit Pattern" uses a double-sided connection to a Daily.co WebRTC room:

1.  **The Bot Side**: A Python process (`ai-realtime`) creates a Daily room, joins as a participant, and runs an AI pipeline (STT -> LLM -> TTS).
2.  **The Client Side**: A React app (`ux-web`) joins the same room.
3.  **The Data Link**: Both sides use **RTVI** (Real-Time Voice Interface) to send JSON messages over the WebRTC data channel, keeping the UI in sync with the voice.

```text
[ React App ] <--- WebRTC (Audio/Data) ---> [ Daily.co Room ] <--- WebRTC (Audio/Data) ---> [ Pipecat Bot ]
      |                                                                                  |
      +------------ [ POST /api/connect ] ----> [ FastAPI ] -----------------------------+
```

---

## 2. Environment & Compatibility Matrix

To avoid integration issues, use these verified versions:

### Backend (ai-realtime)
- **Runtime**: Python `3.11` (e.g., `python:3.11-slim`)
- **System Deps**: `ffmpeg`, `curl` (for audio processing/health checks)
- **Pipecat (Python)**: `0.0.98` (with `daily,openai,silero,elevenlabs,cerebras` extras)
- **Web Framework**: FastAPI `0.115.0`

### Frontend (ux-web)
- **Framework**: Next.js `15.5.9` (App Router)
- **Library**: React `19.0.0`
- **Pipecat SDKs**:
  - `@pipecat-ai/client-js`: `1.5.0`
  - `@pipecat-ai/client-react`: `1.1.0`
  - `@pipecat-ai/daily-transport`: `1.5.0`

---

## 3. The Handshake Lifecycle

To start a session, follow this specific sequence:

1.  **Client Request**: User clicks "Start Voice".
2.  **Server Proxy**: Next.js API calls Python Backend.
3.  **Room Provisioning**: Python Backend calls Daily API to create a `room_url` and a `meeting_token`.
4.  **Bot Spawn**: Python Backend starts the Pipecat pipeline in a background thread/task.
5.  **Return Credentials**: Both the Bot and the Client now have the `room_url` and `token`.
6.  **The Meeting**: Both join the room. The Bot is configured to wait for the first participant before speaking.

---

## 4. Frontend Implementation (React)

### Essential SDKs
```bash
npm install @pipecat-ai/client-js@1.5.0 @pipecat-ai/client-react@1.1.0 @pipecat-ai/daily-transport@1.5.0
```

### The Client Provider
You must wrap your voice-enabled components in the `PipecatClientProvider` and include the `PipecatClientAudio` component, or you won't hear anything.

```tsx
// ux-web/components/voice-shell.tsx
import { PipecatClient } from "@pipecat-ai/client-js";
import { PipecatClientProvider, PipecatClientAudio } from "@pipecat-ai/client-react";
import { DailyTransport } from "@pipecat-ai/daily-transport";

export function VoiceShell({ children }) {
  const [client] = useState(() => new PipecatClient({
    transport: new DailyTransport(),
    enableMic: true,
    callbacks: {
      onUserTranscript: (data) => console.log("User said:", data.text),
    }
  }));

  const startSession = async () => {
    await client.startBotAndConnect({ endpoint: "/api/connect" });
  };

  return (
    <PipecatClientProvider client={client}>
      {children}
      <button onClick={startSession}>Connect</button>
      {/* CRITICAL: This handles the actual <audio> element injection */}
      <PipecatClientAudio />
    </PipecatClientProvider>
  );
}
```

---

## 5. Backend Implementation (Python)

### The Pipecat Pipeline
The pipeline is a directed graph of "frames". Audio frames flow in, text frames are generated, and audio frames flow out.

```python
# ai-realtime/src/bot.py
transport = DailyTransport(room_url, token, "Bot Name", DailyParams(vad_enabled=True))
rtvi = RTVIProcessor(config=RTVIConfig(config=[])) # Enables JSON messaging

pipeline = Pipeline([
    transport.input(),    # 1. Listen to WebRTC
    rtvi,                 # 2. Handle/Intercept JSON messages
    stt,                  # 3. Audio -> Text (OpenAI/Deepgram)
    context_aggregator.user(),
    llm,                  # 4. Text -> Text (Cerebras/OpenAI/Anthropic)
    tts,                  # 5. Text -> Audio (ElevenLabs/Cartesia)
    transport.output(),   # 6. Send to WebRTC
    context_aggregator.assistant()
])
```

---

## 6. Bidirectional UI Sync (RTVI)

RTVI allows the LLM to "see" the UI and "push" changes to it.

### Pattern A: Bot triggers UI (e.g., Show a card)
1. **LLM** calls a tool: `show_product_card(id="123")`.
2. **Python Handler** sends an RTVI message:
   ```python
   await rtvi.send_server_message({"type": "show_card", "id": "123"})
   ```
3. **React Hook** receives it:
   ```tsx
   useRTVIClientEvent(RTVIEvent.ServerMessage, (msg) => {
     if (msg.type === "show_card") setVisibleCard(msg.id);
   });
   ```

### Pattern B: UI triggers Bot (e.g., Context Injection)
1. **React Client** sends state:
   ```tsx
   client.sendClientMessage(JSON.stringify({ type: "user_preferences", theme: "dark" }));
   ```
2. **Python Bot** intercepts:
   ```python
   @rtvi.event_handler("on_client_message")
   async def handle_msg(processor, message):
       data = json.loads(message.type)
       # Update LLM context or internal state
   ```

---

## 7. Critical Configuration & Pitfalls

### VAD (Voice Activity Detection)
If the bot keeps interrupting itself or doesn't stop talking when you speak:
- Use `SileroVADAnalyzer()`.
- Ensure `allow_interruptions=True` in `PipelineParams`.

### Audio Context
Browsers block audio until a user interaction. `client.startBotAndConnect` **must** be called from a click handler.

### Daily.co API Limits
Rooms are NOT automatically deleted. Always set an `exp` (expiry) claim when creating the room in `main.py` to avoid "ghost rooms" consuming your minutes.

```python
# 1 hour expiry
"properties": {"exp": int(time.time()) + 3600}
```

### Environment Variables
| Variable | Purpose |
| :--- | :--- |
| `DAILY_API_KEY` | To create rooms/tokens. |
| `CEREBRAS_API_KEY` | Recommended for sub-200ms LLM response times. |
| `ELEVENLABS_VOICE_ID` | The specific "personality" of the bot. |
| `AI_REALTIME_URL` | Used by the Next.js proxy to find the Python bot. |
