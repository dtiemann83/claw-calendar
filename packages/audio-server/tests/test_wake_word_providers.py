import sys
import pytest
from unittest.mock import patch, MagicMock
import numpy as np

from claw_audio_server.wake_word.stub import StubWakeWordProvider


def _make_oww_mock(model_instance):
    """Return a sys.modules patch dict that stubs out openwakeword."""
    oww_model_module = MagicMock()
    oww_model_module.Model = MagicMock(return_value=model_instance)
    return {"openwakeword": MagicMock(), "openwakeword.model": oww_model_module}


@pytest.mark.asyncio
async def test_stub_process_chunk_returns_false():
    provider = StubWakeWordProvider()
    assert provider.process_chunk(b"\x00" * 2560) is False


@pytest.mark.asyncio
async def test_stub_start_stop():
    provider = StubWakeWordProvider()
    called = []
    await provider.start(lambda: called.append(True))
    await provider.stop()
    assert called == []


def test_open_wake_word_process_chunk_below_threshold():
    mock_model = MagicMock()
    mock_model.predict.return_value = {"hey_jarvis_v0.1": 0.1}

    with patch.dict("sys.modules", _make_oww_mock(mock_model)):
        with patch.dict("os.environ", {"WAKE_WORD_MODEL": "hey_jarvis_v0.1", "WAKE_WORD_THRESHOLD": "0.5"}):
            from claw_audio_server.wake_word.open_wake_word import OpenWakeWordProvider
            provider = OpenWakeWordProvider()
            # 1280 samples of silence = one chunk
            audio = np.zeros(1280, dtype=np.int16).tobytes()
            result = provider.process_chunk(audio)
    assert result is False


def test_open_wake_word_process_chunk_above_threshold():
    mock_model = MagicMock()
    mock_model.predict.return_value = {"hey_jarvis_v0.1": 0.9}

    with patch.dict("sys.modules", _make_oww_mock(mock_model)):
        with patch.dict("os.environ", {"WAKE_WORD_MODEL": "hey_jarvis_v0.1", "WAKE_WORD_THRESHOLD": "0.5"}):
            from claw_audio_server.wake_word.open_wake_word import OpenWakeWordProvider
            provider = OpenWakeWordProvider()
            audio = np.zeros(1280, dtype=np.int16).tobytes()
            result = provider.process_chunk(audio)
    assert result is True


def test_open_wake_word_accumulates_partial_chunks():
    """Partial chunks should be buffered until a full 1280-sample chunk is ready."""
    mock_model = MagicMock()
    mock_model.predict.return_value = {"hey_jarvis_v0.1": 0.0}

    with patch.dict("sys.modules", _make_oww_mock(mock_model)):
        with patch.dict("os.environ", {"WAKE_WORD_MODEL": "hey_jarvis_v0.1"}):
            from claw_audio_server.wake_word.open_wake_word import OpenWakeWordProvider
            provider = OpenWakeWordProvider()
            half = np.zeros(640, dtype=np.int16).tobytes()
            result1 = provider.process_chunk(half)  # partial — no predict yet
            assert result1 is False
            assert mock_model.predict.call_count == 0
            result2 = provider.process_chunk(half)  # completes the chunk
            assert mock_model.predict.call_count == 1


def test_get_wake_word_provider_stub():
    with patch.dict("os.environ", {"WAKE_WORD_PROVIDER": "stub"}):
        from claw_audio_server.providers import get_wake_word_provider
        provider = get_wake_word_provider()
        from claw_audio_server.wake_word.stub import StubWakeWordProvider
        assert isinstance(provider, StubWakeWordProvider)
