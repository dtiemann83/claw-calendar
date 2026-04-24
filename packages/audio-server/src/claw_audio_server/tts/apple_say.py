import asyncio
import os
import tempfile


class AppleSayTTSProvider:
    """TTS via macOS `say` command. Free, no internet required.

    Note: `say -o` produces AIFF format, not WAV. The returned bytes are AIFF
    audio. Callers should treat the content-type as audio/aiff if strict
    format compliance is needed, though most browsers play AIFF directly.
    """

    async def synthesize(self, text: str, voice: str | None = None) -> bytes:
        with tempfile.NamedTemporaryFile(suffix=".aiff", delete=False) as f:
            tmp_path = f.name
        try:
            cmd = ["say", "-o", tmp_path]
            if voice:
                cmd += ["-v", voice]
            cmd.append(text)
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.PIPE,
            )
            _, stderr = await proc.communicate()
            if proc.returncode != 0:
                raise RuntimeError(f"say failed: {stderr.decode()}")
            with open(tmp_path, "rb") as f:
                return f.read()
        finally:
            os.unlink(tmp_path)
