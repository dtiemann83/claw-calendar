import pytest
import numpy as np
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient
from claw_audio_server.main import app
from claw_audio_server.speaker_id.base import SpeakerMatch


def test_enroll_empty_returns_400():
    with TestClient(app) as client:
        resp = client.post("/enroll", params={"user_id": "alice"},
                          files={"file": ("test.wav", b"", "audio/wav")})
    assert resp.status_code == 400


def test_identify_empty_returns_400():
    with TestClient(app) as client:
        resp = client.post("/identify",
                          files={"file": ("test.wav", b"", "audio/wav")})
    assert resp.status_code == 400


def test_identify_stub_returns_no_match():
    with TestClient(app) as client:
        resp = client.post("/identify",
                          files={"file": ("test.wav", b"\x00" * 1000, "audio/wav")})
    assert resp.status_code == 200
    data = resp.json()
    assert data["user_id"] is None
    assert data["confidence"] is None


def test_stt_response_includes_speaker_field():
    """STT response always includes speaker field (None for stub provider)."""
    with TestClient(app) as client:
        resp = client.post("/stt",
                          files={"file": ("test.wav", b"\x00" * 100, "audio/wav")})
    assert resp.status_code == 200
    data = resp.json()
    assert "transcript" in data
    assert "speaker" in data  # present even when None
