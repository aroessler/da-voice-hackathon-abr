# Shape Renderer — Feature Spec

## Overview

Replace the number display demo with a voice-controlled geometric shape renderer. The user speaks a shape request; the LLM calls a `render_shape` tool; the backend sends an RTVI message; the frontend animates an SVG shape in the right pane.

**User experience:**
> "Give me a large red hexagon" → bot says "Here's a large red hexagon!" → hexagon appears with flash animation

---

## Shape Properties

| Property | Values | Notes |
|----------|--------|-------|
| `shape`  | `circle`, `triangle`, `square`, `pentagon`, `hexagon`, `star`, `diamond` | LLM picks from enum |
| `color`  | Any CSS color name or hex string | e.g. `"coral"`, `"cornflower blue"`, `"#ff6b6b"` |
| `size`   | `small`, `medium`, `large` | Maps to 200px / 400px / 600px viewport-relative |
| `fill`   | `solid`, `outline` | Solid fill vs stroke-only |

---

## RTVI Message Contract

### Backend → Frontend (`shape_update`)

Sent when the LLM tool call completes:

```json
{
  "type": "shape_update",
  "shape": "hexagon",
  "color": "coral",
  "size": "large",
  "fill": "solid",
  "source": "bot"
}
```

Frontend listens via:
```typescript
useRTVIClientEvent("serverMessage", (msg) => {
  if (msg?.data?.type === "shape_update") { ... }
})
```

### Frontend → Backend (`shape_click`) — optional

If the user clicks the displayed shape, the frontend can send a client message to trigger an LLM response:

```json
{ "type": "shape_click", "shape": "hexagon" }
```

Backend handles via:
```python
@rtvi.event_handler("on_client_message")
async def on_client_message(processor, message):
    if message.type == "shape_click":
        shape = message.data.get("shape")
        # inject into context and trigger LLM
```

---

## Backend Changes (`ai-realtime/src/bot.py`)

### Remove
- `current_number` global variable
- `set_number` tool (FunctionSchema + handler)
- `on_client_message` handler for `number_update` type

### Add: `render_shape` Tool

```python
tools = ToolsSchema(standard_tools=[
    FunctionSchema(
        name="render_shape",
        description="Render a geometric shape on the user's screen.",
        properties={
            "shape": {
                "type": "string",
                "enum": ["circle", "triangle", "square", "pentagon", "hexagon", "star", "diamond"],
                "description": "The geometric shape to display.",
            },
            "color": {
                "type": "string",
                "description": "CSS color name or hex string (e.g. 'coral', '#ff6b6b').",
            },
            "size": {
                "type": "string",
                "enum": ["small", "medium", "large"],
                "description": "Display size of the shape.",
            },
            "fill": {
                "type": "string",
                "enum": ["solid", "outline"],
                "description": "Whether the shape is filled or outline only.",
            },
        },
        required=["shape", "color", "size", "fill"],
    )
])
```

### Tool Handler

```python
async def render_shape_handler(params: FunctionCallParams):
    args = params.arguments
    await rtvi.send_server_message({
        "type": "shape_update",
        "shape": args["shape"],
        "color": args["color"],
        "size": args["size"],
        "fill": args["fill"],
        "source": "bot",
    })
    await params.result_callback(
        f"Rendered a {args['size']} {args['fill']} {args['color']} {args['shape']}."
    )

llm.register_function("render_shape", render_shape_handler)
```

### Updated System Prompt

```
You are a friendly voice assistant that renders geometric shapes on the user's screen.
When the user asks for a shape, call render_shape with their requested shape, color, size, and fill style.
If they don't specify a property, choose something visually interesting.
Keep spoken responses short — just confirm what you rendered.
```

---

## Frontend Changes (`ux-web/src/app/components/voice-shell.tsx`)

### State

```typescript
type ShapeState = {
  shape: "circle" | "triangle" | "square" | "pentagon" | "hexagon" | "star" | "diamond";
  color: string;
  size: "small" | "medium" | "large";
  fill: "solid" | "outline";
} | null;

const [currentShape, setCurrentShape] = useState<ShapeState>(null);
const [shapeFlash, setShapeFlash] = useState(false);
```

### Server Message Handler

```typescript
useRTVIClientEvent("serverMessage", (msg: RTVIMessage) => {
  const d = msg?.data as any;
  if (d?.type === "shape_update") {
    setCurrentShape({ shape: d.shape, color: d.color, size: d.size, fill: d.fill });
    setShapeFlash(true);
    setTimeout(() => setShapeFlash(false), 800);
  }
});
```

### Replace `NumberDisplay` with `ShapeDisplay`

```tsx
function ShapeDisplay({ shape, flash }: { shape: ShapeState; flash: boolean }) {
  if (!shape) {
    return (
      <div style={{ /* centered placeholder */ }}>
        <p>Ask for a shape</p>
      </div>
    );
  }

  const sizePx = { small: 200, medium: 400, large: 600 }[shape.size];
  const svgProps = shape.fill === "solid"
    ? { fill: shape.color, stroke: "none" }
    : { fill: "none", stroke: shape.color, strokeWidth: 8 };

  return (
    <div className={flash ? "shape-flash" : ""}>
      <svg width={sizePx} height={sizePx} viewBox="0 0 100 100">
        <ShapePath type={shape.shape} {...svgProps} />
      </svg>
    </div>
  );
}
```

### Remove `NumberControls` (+/- buttons)

Replace with an optional shape-type palette (clickable chips) that sends `shape_click` client messages, or remove entirely to keep it voice-only.

---

## SVG Path Reference

| Shape | SVG Element | Key Values |
|-------|-------------|------------|
| circle | `<circle cx="50" cy="50" r="45">` | — |
| square | `<rect x="5" y="5" width="90" height="90">` | — |
| triangle | `<polygon points="50,5 95,95 5,95">` | equilateral |
| diamond | `<polygon points="50,5 95,50 50,95 5,50">` | — |
| pentagon | `<polygon points="...">` | 5 points, computed at 72° intervals |
| hexagon | `<polygon points="...">` | 6 points, computed at 60° intervals |
| star | `<polygon points="...">` | 10 alternating outer/inner points |

Pentagon/hexagon/star points are computed with:
```typescript
function polygonPoints(cx: number, cy: number, r: number, sides: number, offset = 0) {
  return Array.from({ length: sides }, (_, i) => {
    const angle = (Math.PI * 2 * i) / sides - Math.PI / 2 + offset;
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  }).join(" ");
}
```

Star uses two radii (outer=45, inner=20) alternated across 10 points.

---

## CSS Animation

Reuse (or adapt) the existing flash animation from the number display:

```css
@keyframes shape-flash {
  0%   { opacity: 0.2; transform: scale(0.85); }
  50%  { opacity: 1;   transform: scale(1.05); }
  100% { opacity: 1;   transform: scale(1); }
}

.shape-flash {
  animation: shape-flash 0.4s ease-out;
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `ai-realtime/src/bot.py` | Swap `set_number` → `render_shape` tool; update system prompt |
| `ux-web/src/app/components/voice-shell.tsx` | Swap `NumberDisplay`/`NumberControls` → `ShapeDisplay`; update state + event handler |

No new files required. No changes to `main.py`, `route.ts`, `next.config.js`, or Docker config.

---

## Testing Checklist

- [ ] Say "show me a large blue circle" → circle appears with flash animation
- [ ] Say "give me a small outline star in gold" → star renders stroke-only in gold
- [ ] Say "make it a medium triangle" (no color) → bot picks a color, triangle renders
- [ ] Say an unsupported shape (e.g. "octagon") → bot gracefully picks the closest supported shape
- [ ] Session end → shape persists in UI (no reset required)
- [ ] Click shape (if palette implemented) → bot speaks about the shape
