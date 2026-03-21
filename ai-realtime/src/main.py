import asyncio
import os
import time

import aiohttp
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .bot import run_bot

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DAILY_API_KEY = os.getenv("DAILY_API_KEY")
DAILY_API_URL = "https://api.daily.co/v1"


async def create_daily_room() -> dict:
    headers = {"Authorization": f"Bearer {DAILY_API_KEY}"}
    payload = {
        "properties": {
            "exp": int(time.time()) + 3600,
            "enable_chat": False,
        }
    }
    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"{DAILY_API_URL}/rooms", headers=headers, json=payload
        ) as resp:
            if resp.status != 200:
                text = await resp.text()
                raise HTTPException(status_code=resp.status, detail=f"Daily API error: {text}")
            return await resp.json()


async def create_daily_token(room_name: str) -> str:
    headers = {"Authorization": f"Bearer {DAILY_API_KEY}"}
    payload = {
        "properties": {
            "room_name": room_name,
            "is_owner": True,
            "exp": int(time.time()) + 3600,
        }
    }
    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"{DAILY_API_URL}/meeting-tokens", headers=headers, json=payload
        ) as resp:
            if resp.status != 200:
                text = await resp.text()
                raise HTTPException(status_code=resp.status, detail=f"Daily token error: {text}")
            data = await resp.json()
            return data["token"]


@app.post("/api/connect")
async def connect():
    room = await create_daily_room()
    room_url = room["url"]
    room_name = room["name"]

    bot_token = await create_daily_token(room_name)
    client_token = await create_daily_token(room_name)

    # Spawn the bot in a background task
    asyncio.create_task(run_bot(room_url, bot_token))

    return {
        "room_url": room_url,
        "token": client_token,
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
