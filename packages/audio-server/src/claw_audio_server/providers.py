import os

def get_provider_names() -> dict[str, str]:
    return {
        "wake_word": os.getenv("WAKE_WORD_PROVIDER", "stub"),
        "stt": os.getenv("STT_PROVIDER", "stub"),
        "tts": os.getenv("TTS_PROVIDER", "stub"),
        "speaker_id": os.getenv("SPEAKER_ID_PROVIDER", "stub"),
    }
