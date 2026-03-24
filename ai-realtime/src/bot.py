import asyncio
import os

from pipecat.frames.frames import EndFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.processors.frameworks.rtvi.processor import RTVIProcessor, RTVIObserver
from pipecat.services.llm_service import FunctionCallParams
from pipecat.services.openai.llm import OpenAILLMService
from pipecat.services.openai.tts import OpenAITTSService
from pipecat.transports.daily.transport import DailyParams, DailyTransport
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.adapters.schemas.tools_schema import ToolsSchema

from loguru import logger


async def run_bot(room_url: str, token: str):
    transport = DailyTransport(
        room_url,
        token,
        "Voice Bot",
        DailyParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            transcription_enabled=True,
        ),
    )

    rtvi = RTVIProcessor()

    llm = OpenAILLMService(
        api_key=os.getenv("OPENAI_API_KEY"),
        settings=OpenAILLMService.Settings(model="gpt-4o-mini"),
    )

    tts = OpenAITTSService(
        api_key=os.getenv("OPENAI_API_KEY"),
        settings=OpenAITTSService.Settings(voice="shimmer", speed=1.5),
    )

    tools = ToolsSchema(
        standard_tools=[
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
                    "options": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Exactly 4 shape name options for the quiz (1 correct + 3 distractors).",
                    },
                },
                required=["shape", "color", "size", "fill", "options"],
            )
        ]
    )

    messages = [
        {
            "role": "system",
            "content": (
                "You are a fun, encouraging geometry teacher for young children learning shapes!\n"
                "Your job is to quiz kids on geometric shapes. Here's how it works:\n\n"
                "1. Call render_shape to display a shape on screen with 4 multiple-choice options "
                "(1 correct answer + 3 distractors). Use bright, fun colors.\n"
                "2. After rendering, ask the child 'What shape is this?' in an excited, encouraging voice. "
                "Do NOT read the options out loud — the child can see them on screen.\n"
                "3. Wait for the child to say their answer by voice.\n"
                "4. If correct: celebrate enthusiastically! ('Amazing job!', 'You're a shape superstar!')\n"
                "5. If wrong: gently encourage them ('Great try! Look at the sides — that one is a hexagon!')\n"
                "6. Then render a new shape and continue the quiz.\n\n"
                "Keep your spoken responses short and enthusiastic. Use simple words.\n"
                "Vary the shapes, colors, and sizes to keep it interesting.\n"
                "Start by introducing yourself and rendering the first shape right away."
            ),
        }
    ]

    context = LLMContext(messages, tools)
    context_aggregator = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(
            vad_analyzer=SileroVADAnalyzer(),
        ),
    )

    async def render_shape_handler(params: FunctionCallParams):
        args = params.arguments
        shape = args.get("shape", "circle")
        color = args.get("color", "white")
        size = args.get("size", "medium")
        fill = args.get("fill", "solid")
        options = args.get("options", [])
        logger.info(f"Bot rendering shape: {size} {fill} {color} {shape} options={options}")
        await rtvi.send_server_message({
            "type": "shape_update",
            "shape": shape,
            "color": color,
            "size": size,
            "fill": fill,
            "options": options,
            "source": "bot",
        })
        await params.result_callback(f"Rendered a {size} {fill} {color} {shape} with options {options}.")

    llm.register_function("render_shape", render_shape_handler)

    pipeline = Pipeline(
        [
            transport.input(),
            rtvi,
            context_aggregator.user(),
            llm,
            tts,
            transport.output(),
            context_aggregator.assistant(),
        ]
    )

    rtvi_observer = RTVIObserver(rtvi)

    task = PipelineTask(
        pipeline,
        params=PipelineParams(allow_interruptions=True),
        observers=[rtvi_observer],
    )

    @transport.event_handler("on_first_participant_joined")
    async def on_first_participant_joined(transport, participant):
        await transport.capture_participant_transcription(participant["id"])
        logger.info(f"First participant joined: {participant['id']}")

    @transport.event_handler("on_participant_left")
    async def on_participant_left(transport, participant, reason):
        logger.info(f"Participant left: {participant['id']}")
        await task.queue_frame(EndFrame())

    runner = PipelineRunner()
    await runner.run(task)
