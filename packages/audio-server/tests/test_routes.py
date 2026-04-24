import pytest
from httpx import AsyncClient, ASGITransport
from claw_audio_server.main import app


async def test_healthz():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/healthz")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


async def test_stt_stub_empty_returns_400():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/stt", files={"file": ("test.wav", b"", "audio/wav")})
    assert resp.status_code == 400


async def test_stt_stub_returns_transcript():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/stt",
            files={"file": ("test.wav", b"\x00" * 100, "audio/wav")},
        )
    assert resp.status_code == 200
    assert "transcript" in resp.json()


async def test_tts_stub_empty_returns_400():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/tts", json={"text": "  "})
    assert resp.status_code == 400


async def test_tts_stub_returns_audio():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/tts", json={"text": "Hello world"})
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "audio/wav"
