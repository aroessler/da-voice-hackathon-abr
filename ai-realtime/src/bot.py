import asyncio
import json
import os

from pipecat.frames.frames import EndFrame, LLMMessagesAppendFrame
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

# Shared number state
current_number = 0


async def run_bot(room_url: str, token: str):
    global current_number
    current_number = 0

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
                name="set_number",
                description="Set the displayed number to a new value. Use this whenever the user asks to change, set, update, or pick a number.",
                properties={
                    "value": {
                        "type": "integer",
                        "description": "The number to display",
                    }
                },
                required=["value"],
            )
        ]
    )

    messages = [
        {
            "role": "system",
            "content": (
                "You are a friendly voice assistant with a shared number display. "
                "There is a large number shown on the screen that both you and the user can see and change. "
                "The current number starts at 0. When the user asks to change the number, "
                "use the set_number tool. You can also proactively suggest changing it. "
                "Keep responses concise — one or two sentences."
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

    async def handle_set_number(params: FunctionCallParams):
        global current_number
        value = params.arguments.get("value", 0)
        current_number = value
        logger.info(f"Bot set number to {value}")
        await rtvi.send_server_message({"type": "number_update", "value": value, "source": "bot"})
        await params.result_callback(f"The number has been set to {value}.")

    llm.register_function("set_number", handle_set_number)

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

    # Register AFTER task is created so closure captures it
    @rtvi.event_handler("on_client_message")
    async def on_client_message(processor, message):
        global current_number
        try:
            logger.info(f"Client message received: type={message.type}, data={message.data}")
            if message.type == "number_update":
                value = message.data.get("value", 0) if isinstance(message.data, dict) else 0
                current_number = value
                logger.info(f"Client set number to {current_number}")
                # Append message to context AND trigger LLM completion
                await task.queue_frames(
                    [
                        LLMMessagesAppendFrame(
                            messages=[
                                {
                                    "role": "user",
                                    "content": f"[I just changed the number to {value} using the buttons on screen.]",
                                }
                            ],
                            run_llm=True,
                        )
                    ]
                )
                logger.info("Queued LLMMessagesAppendFrame with run_llm=True")
        except Exception as e:
            logger.error(f"Error handling client message: {e}")

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
