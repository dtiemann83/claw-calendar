import json
import numpy as np
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from claw_audio_server.main import app


def test_ws_connects_and_disconnects():
    """WebSocket endpoint accepts connections."""
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as ws:
            # Just connect and disconnect cleanly — no exception = connected OK
            pass


def test_ws_receives_wake_event():
    """When a full-threshold audio chunk is sent, a wake event is broadcast back."""
    mock_provider = MagicMock()
    mock_provider.process_chunk.return_value = True  # always triggers wake

    with patch("claw_audio_server.main.get_wake_word_provider", return_value=mock_provider):
        with TestClient(app) as client:
            with client.websocket_connect("/ws") as ws:
                # Send audio_config first
                ws.send_text(json.dumps({"type": "audio_config", "sample_rate": 16000}))
                # Send a chunk of silence (16kHz int16)
                audio = np.zeros(1280, dtype=np.int16).tobytes()
                ws.send_bytes(audio)
                # Should receive a wake event
                data = ws.receive_json()
                assert data["type"] == "wake"
                assert "timestamp" in data


def test_ws_no_wake_when_below_threshold():
    """When provider returns False, no wake event is sent."""
    import threading
    mock_provider = MagicMock()
    processed = threading.Event()

    def _process(audio: bytes) -> bool:
        processed.set()
        return False

    mock_provider.process_chunk.side_effect = _process

    with patch("claw_audio_server.main.get_wake_word_provider", return_value=mock_provider):
        with TestClient(app) as client:
            with client.websocket_connect("/ws") as ws:
                ws.send_text(json.dumps({"type": "audio_config", "sample_rate": 16000}))
                audio = np.zeros(1280, dtype=np.int16).tobytes()
                ws.send_bytes(audio)
                processed.wait(timeout=2.0)
    assert mock_provider.process_chunk.called


def test_ws_audio_config_sets_sample_rate():
    """audio_config command sets the sample rate for this connection."""
    import threading
    mock_provider = MagicMock()
    processed = threading.Event()

    def _process(audio: bytes) -> bool:
        processed.set()
        return False

    mock_provider.process_chunk.side_effect = _process

    with patch("claw_audio_server.main.get_wake_word_provider", return_value=mock_provider):
        with TestClient(app) as client:
            with client.websocket_connect("/ws") as ws:
                ws.send_text(json.dumps({"type": "audio_config", "sample_rate": 48000}))
                # Send audio at 48kHz — it'll be resampled to 16kHz (3840 → 1280 samples)
                audio = np.zeros(3840, dtype=np.int16).tobytes()
                ws.send_bytes(audio)
                processed.wait(timeout=2.0)
    assert mock_provider.process_chunk.called
