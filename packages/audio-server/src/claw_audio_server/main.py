from fastapi import FastAPI, UploadFile, HTTPException, WebSocket
from fastapi.responses import Response
from pydantic import BaseModel
from .providers import get_provider_names, get_stt_provider, get_tts_provider, get_wake_word_provider, get_speaker_id_provider
import asyncio
import json
import os
import time
import numpy as np
from pathlib import Path
from scipy.signal import resample_poly
from math import gcd

app = FastAPI(title="claw-audio-server")


def _resample_to_16k(audio_bytes: bytes, from_rate: int) -> bytes:
    """Resample audio from from_rate Hz to 16kHz. Input/output: int16 PCM bytes."""
    if from_rate == 16000:
        return audio_bytes
    samples = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32)
    g = gcd(16000, from_rate)
    up, down = 16000 // g, from_rate // g
    resampled = resample_poly(samples, up, down)
    return resampled.astype(np.int16).tobytes()


class ConnectionManager:
    def __init__(self):
        self._clients: list[WebSocket] = []
        self._client_sample_rates: dict[int, int] = {}  # id(ws) -> sample_rate

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self._clients.append(ws)

    def disconnect(self, ws: WebSocket):
        self._clients = [c for c in self._clients if c is not ws]
        self._client_sample_rates.pop(id(ws), None)

    def set_sample_rate(self, ws: WebSocket, sample_rate: int):
        self._client_sample_rates[id(ws)] = sample_rate

    def get_sample_rate(self, ws: WebSocket) -> int:
        return self._client_sample_rates.get(id(ws), 48000)  # default 48kHz

    async def broadcast(self, message: dict):
        data = json.dumps(message)
        dead: list[WebSocket] = []
        for client in list(self._clients):
            try:
                await client.send_text(data)
            except Exception:
                dead.append(client)
        for client in dead:
            self.disconnect(client)


manager = ConnectionManager()


@app.get("/healthz")
async def healthz():
    return {"status": "ok", "providers": get_provider_names()}


class IdentifyResponse(BaseModel):
    user_id: str | None
    confidence: float | None


class STTResponse(BaseModel):
    transcript: str
    speaker: IdentifyResponse | None = None


class EnrollResponse(BaseModel):
    user_id: str
    sample_count: int


@app.post("/stt")
async def stt(file: UploadFile) -> STTResponse:
    """Transcribe uploaded audio. Accepts any audio format the provider supports."""
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio")
    stt_provider = get_stt_provider()
    # Default to 16000 Hz — providers that need the actual rate should parse it from the audio
    transcript = await stt_provider.transcribe(audio_bytes, sample_rate=16000)

    # Optionally run speaker ID concurrently
    speaker = None
    if os.getenv("SPEAKER_ID_PROVIDER", "stub") != "stub":
        sid_provider = get_speaker_id_provider()
        match = await sid_provider.identify(audio_bytes)
        if match:
            speaker = IdentifyResponse(user_id=match.user_id, confidence=match.confidence)

    return STTResponse(transcript=transcript, speaker=speaker)


@app.post("/enroll")
async def enroll(user_id: str, file: UploadFile) -> EnrollResponse:
    """Enroll a voice sample for a user. Call 3+ times for good accuracy."""
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio")
    provider = get_speaker_id_provider()
    await provider.enroll(user_id, [audio_bytes])
    # Count how many samples this user now has
    embeddings_dir = Path(os.getenv("SPEAKER_EMBEDDINGS_DIR",
                          os.path.expanduser("~/.config/claw-calendar/speaker_embeddings")))
    npy_path = embeddings_dir / f"{user_id}.npy"
    sample_count = len(np.load(str(npy_path))) if npy_path.exists() else 0
    return EnrollResponse(user_id=user_id, sample_count=sample_count)


@app.post("/identify")
async def identify(file: UploadFile) -> IdentifyResponse:
    """Identify speaker from audio clip."""
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio")
    provider = get_speaker_id_provider()
    match = await provider.identify(audio_bytes)
    if match is None:
        return IdentifyResponse(user_id=None, confidence=None)
    return IdentifyResponse(user_id=match.user_id, confidence=match.confidence)


class SynthesizeRequest(BaseModel):
    text: str
    voice: str | None = None


@app.post("/tts")
async def tts(req: SynthesizeRequest) -> Response:
    """Synthesize speech. Returns raw audio bytes (WAV)."""
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Empty text")
    provider = get_tts_provider()
    audio_bytes = await provider.synthesize(req.text, req.voice)
    return Response(content=audio_bytes, media_type="audio/wav")


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    wake_provider = get_wake_word_provider()
    try:
        while True:
            try:
                msg = await ws.receive()
            except Exception:
                break
            if msg["type"] == "websocket.disconnect":
                break
            if "bytes" in msg and msg["bytes"] is not None:
                audio_bytes = msg["bytes"]
                sample_rate = manager.get_sample_rate(ws)
                if sample_rate != 16000:
                    audio_bytes = _resample_to_16k(audio_bytes, sample_rate)
                if wake_provider.process_chunk(audio_bytes):
                    await manager.broadcast({
                        "type": "wake",
                        "timestamp": int(time.time() * 1000),
                    })
            elif "text" in msg and msg["text"] is not None:
                try:
                    cmd = json.loads(msg["text"])
                    if cmd.get("type") == "audio_config":
                        manager.set_sample_rate(ws, int(cmd.get("sample_rate", 48000)))
                except (json.JSONDecodeError, ValueError):
                    pass
    finally:
        manager.disconnect(ws)
