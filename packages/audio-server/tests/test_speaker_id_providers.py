import pytest
import numpy as np
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock, AsyncMock
from claw_audio_server.speaker_id.stub import StubSpeakerIDProvider
from claw_audio_server.speaker_id.base import SpeakerMatch


@pytest.mark.asyncio
async def test_stub_identify_returns_none():
    provider = StubSpeakerIDProvider()
    result = await provider.identify(b"\x00" * 1000)
    assert result is None


@pytest.mark.asyncio
async def test_stub_enroll_no_error():
    provider = StubSpeakerIDProvider()
    await provider.enroll("user1", [b"\x00" * 1000, b"\x00" * 1000])


def test_resemblyzer_enroll_and_identify():
    """End-to-end: enroll a user and identify them (uses a temp dir)."""
    mock_encoder = MagicMock()
    # Give both enroll and identify the same embedding so similarity = 1.0
    fake_embedding = np.ones(256, dtype=np.float32)
    fake_embedding /= np.linalg.norm(fake_embedding)  # normalize
    mock_encoder.embed_utterance.return_value = fake_embedding

    mock_preprocess = MagicMock(return_value=np.zeros(16000, dtype=np.float32))

    with tempfile.TemporaryDirectory() as tmpdir:
        with patch.dict("os.environ", {
            "SPEAKER_EMBEDDINGS_DIR": tmpdir,
            "SPEAKER_ID_THRESHOLD": "0.5",
        }):
            with patch.dict("sys.modules", {
                "resemblyzer": MagicMock(
                    VoiceEncoder=MagicMock(return_value=mock_encoder),
                    preprocess_wav=mock_preprocess,
                ),
                "resemblyzer.VoiceEncoder": MagicMock(return_value=mock_encoder),
            }):
                import importlib
                import claw_audio_server.speaker_id.resemblyzer as mod
                importlib.reload(mod)
                provider = mod.ResemblyzerSpeakerIDProvider()

        import asyncio
        audio = np.zeros(32000, dtype=np.int16).tobytes()

        async def run():
            await provider.enroll("alice", [audio])
            npy_path = Path(tmpdir) / "alice.npy"
            assert npy_path.exists()
            match = await provider.identify(audio)
            assert match is not None
            assert match.user_id == "alice"
            assert match.confidence >= 0.5

        asyncio.run(run())


def test_get_speaker_id_provider_stub():
    with patch.dict("os.environ", {"SPEAKER_ID_PROVIDER": "stub"}):
        from claw_audio_server.providers import get_speaker_id_provider
        provider = get_speaker_id_provider()
        assert isinstance(provider, StubSpeakerIDProvider)
