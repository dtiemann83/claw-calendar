import asyncio
import io
import os
import wave
from pathlib import Path


class PiperTTSProvider:
    """TTS via Piper neural TTS. Use low/medium quality voices on 2014 Intel Mac."""

    def __init__(self) -> None:
        self._voice = os.getenv("PIPER_VOICE", "en_US-amy-low")
        self._models_dir = Path(
            os.getenv("PIPER_MODELS_DIR", str(Path.home() / ".local/share/piper-voices"))
        )

    async def synthesize(self, text: str, voice: str | None = None) -> bytes:
        active_voice = voice or self._voice
        model_path = self._models_dir / f"{active_voice}.onnx"
        if not model_path.exists():
            raise FileNotFoundError(
                f"Piper voice model not found: {model_path}. "
                f"Download: python -m piper.download --data-dir {self._models_dir} "
                f"--download-dir {self._models_dir} {active_voice}"
            )
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._run_sync, text, model_path)

    def _run_sync(self, text: str, model_path: Path) -> bytes:
        from piper import PiperVoice  # imported lazily — only if piper-tts is installed
        buf = io.BytesIO()
        voice_model = PiperVoice.load(str(model_path))
        with wave.open(buf, "wb") as wav_file:
            voice_model.synthesize(text, wav_file)
        return buf.getvalue()
