import io
import os
import tempfile


class FasterWhisperLocalSTTProvider:
    """STT via faster-whisper running locally on CPU. Use tiny.en or base.en on Intel Mac."""

    def __init__(self) -> None:
        from faster_whisper import WhisperModel

        model_name = os.getenv("WHISPER_MODEL", "tiny.en")
        device = os.getenv("WHISPER_DEVICE", "cpu")
        # int8 is fastest on CPU with no quality loss for transcription
        self._model = WhisperModel(model_name, device=device, compute_type="int8")

    async def transcribe(self, audio: bytes, sample_rate: int) -> str:
        import asyncio

        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._run_sync, audio)

    def _run_sync(self, audio: bytes) -> str:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(audio)
            tmp_path = f.name
        try:
            segments, _ = self._model.transcribe(tmp_path, language="en")
            return " ".join(seg.text.strip() for seg in segments).strip()
        finally:
            os.unlink(tmp_path)
