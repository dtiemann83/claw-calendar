import io
import os

import httpx


class OpenAIWhisperSTTProvider:
    """STT via OpenAI Whisper API. ~$0.006/min, no local compute."""

    def __init__(self) -> None:
        self._api_key = os.environ["OPENAI_API_KEY"]
        self._url = "https://api.openai.com/v1/audio/transcriptions"

    async def transcribe(self, audio: bytes, sample_rate: int) -> str:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                self._url,
                headers={"Authorization": f"Bearer {self._api_key}"},
                files={"file": ("audio.wav", io.BytesIO(audio), "audio/wav")},
                data={"model": "whisper-1"},
            )
            resp.raise_for_status()
            return resp.json()["text"]
