import os

from .stt.base import STTProvider
from .tts.base import TTSProvider
from .wake_word.base import WakeWordProvider
from .speaker_id.base import SpeakerIDProvider


def get_provider_names() -> dict[str, str]:
    return {
        "wake_word": os.getenv("WAKE_WORD_PROVIDER", "stub"),
        "stt": os.getenv("STT_PROVIDER", "stub"),
        "tts": os.getenv("TTS_PROVIDER", "stub"),
        "speaker_id": os.getenv("SPEAKER_ID_PROVIDER", "stub"),
    }


def get_wake_word_provider() -> WakeWordProvider:
    name = os.getenv("WAKE_WORD_PROVIDER", "stub")
    if name == "stub":
        from .wake_word.stub import StubWakeWordProvider
        return StubWakeWordProvider()
    if name == "open_wake_word":
        from .wake_word.open_wake_word import OpenWakeWordProvider
        return OpenWakeWordProvider()
    raise ValueError(f"Unknown wake word provider: {name}")


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


def get_speaker_id_provider() -> SpeakerIDProvider:
    name = os.getenv("SPEAKER_ID_PROVIDER", "stub")
    if name == "stub":
        from .speaker_id.stub import StubSpeakerIDProvider
        return StubSpeakerIDProvider()
    if name == "resemblyzer":
        from .speaker_id.resemblyzer import ResemblyzerSpeakerIDProvider
        return ResemblyzerSpeakerIDProvider()
    raise ValueError(f"Unknown speaker ID provider: {name}")
