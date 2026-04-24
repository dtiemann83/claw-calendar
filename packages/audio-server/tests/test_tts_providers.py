import pytest
from unittest.mock import patch

from claw_audio_server.tts.stub import StubTTSProvider


@pytest.mark.asyncio
async def test_stub_returns_valid_wav():
    provider = StubTTSProvider()
    audio = await provider.synthesize("hello")
    assert audio[:4] == b"RIFF"
    assert len(audio) >= 44


@pytest.mark.asyncio
async def test_piper_missing_model_raises():
    from claw_audio_server.tts.piper import PiperTTSProvider
    with patch.dict("os.environ", {"PIPER_VOICE": "nonexistent-voice", "PIPER_MODELS_DIR": "/nonexistent"}):
        provider = PiperTTSProvider()
        with pytest.raises(FileNotFoundError):
            await provider.synthesize("hello")
