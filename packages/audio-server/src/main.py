from fastapi import FastAPI
from .providers import get_provider_names

app = FastAPI(title="claw-audio-server")


@app.get("/healthz")
async def healthz():
    return {"status": "ok", "providers": get_provider_names()}
