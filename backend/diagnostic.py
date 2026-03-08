import httpx
import json

async def check():
    url = "http://127.0.0.1:8000/api/quests/?limit=100"
    headers = {"Origin": "http://localhost:3000"}
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, headers=headers)
            print(f"Status: {response.status_code}")
            print(f"Content: {response.text}")
        except Exception as e:
            print(f"Error: {e}")

import asyncio
asyncio.run(check())
