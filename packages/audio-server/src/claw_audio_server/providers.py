import os

from .stt.base import STTProvider
from .tts.base import TTSProvider


def get_provider_names() -> dict[str, str]:
    return {
        "wake_word": os.getenv("WAKE_WORD_PROVIDER", "stub"),
        "stt": os.getenv("STT_PROVIDER", "stub"),
        "tts": os.getenv("TTS_PROVIDER", "stub"),
        "speaker_id": os.getenv("SPEAKER_ID_PROVIDER", "stub"),
    }


def get_stt_provider() -> STTProvider:
    name = os.getenv("STT_PROVIDER", "stub")
    if name == "stub":
        from .stt.stub import StubSTTProvider
        return StubSTTProvider()
    if name == "openai_whisper_api":
        from .stt.openai_whisper_api import OpenAIWhisperSTTProvider
        return OpenAIWhisperSTTProvider()
    if name == "faster_whisper_local":
        from .stt.faster_whisper_local import FasterWhisperLocalSTTProvider
        return FasterWhisperLocalSTTProvider()
    raise ValueError(f"Unknown STT provider: {name}")


def get_tts_provider() -> TTSProvider:
    name = os.getenv("TTS_PROVIDER", "stub")
    if name == "stub":
        from .tts.stub import StubTTSProvider
        return StubTTSProvider()
    if name == "piper":
        from .tts.piper import PiperTTSProvider
        return PiperTTSProvider()
    if name == "apple_say":
        from .tts.apple_say import AppleSayTTSProvider
        return AppleSayTTSProvider()
    raise ValueError(f"Unknown TTS provider: {name}")
