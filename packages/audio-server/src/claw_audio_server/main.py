from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from .providers import get_provider_names, get_stt_provider, get_tts_provider

app = FastAPI(title="claw-audio-server")


@app.get("/healthz")
async def healthz():
    return {"status": "ok", "providers": get_provider_names()}


@app.post("/stt")
async def stt(file: UploadFile) -> dict:
    """Transcribe uploaded audio. Accepts any audio format the provider supports."""
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio")
    provider = get_stt_provider()
    # Default to 16000 Hz — providers that need the actual rate should parse it from the audio
    transcript = await provider.transcribe(audio_bytes, sample_rate=16000)
    return {"transcript": transcript}


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
