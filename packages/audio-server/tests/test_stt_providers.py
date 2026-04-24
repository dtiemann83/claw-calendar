import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from claw_audio_server.stt.openai_whisper_api import OpenAIWhisperSTTProvider


@pytest.mark.asyncio
async def test_openai_whisper_transcribes():
    fake_response = MagicMock()
    fake_response.json.return_value = {"text": "hello world"}
    fake_response.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=fake_response)

    with patch("claw_audio_server.stt.openai_whisper_api.httpx.AsyncClient") as mock_client_class:
        instance = MagicMock()
        instance.__aenter__ = AsyncMock(return_value=mock_client)
        instance.__aexit__ = AsyncMock(return_value=False)
        mock_client_class.return_value = instance

        with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}):
            provider = OpenAIWhisperSTTProvider()
            result = await provider.transcribe(b"\x00" * 100, sample_rate=16000)

    assert result == "hello world"


@pytest.mark.asyncio
async def test_openai_whisper_missing_key():
    import os
    env = {k: v for k, v in os.environ.items() if k != "OPENAI_API_KEY"}
    with patch.dict("os.environ", env, clear=True):
        with pytest.raises(KeyError):
            OpenAIWhisperSTTProvider()
