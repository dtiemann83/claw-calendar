import asyncio
import os
import tempfile


class AppleSayTTSProvider:
    """TTS via macOS `say` + `afconvert`. Returns WAV bytes playable in any browser."""

    async def synthesize(self, text: str, voice: str | None = None) -> bytes:
        aiff_file = tempfile.NamedTemporaryFile(suffix=".aiff", delete=False)
        aiff_file.close()
        wav_file = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        wav_file.close()
        try:
            cmd = ["say", "-o", aiff_file.name]
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

            # Convert AIFF → WAV so browsers can play it
            convert = await asyncio.create_subprocess_exec(
                "afconvert", "-f", "WAVE", "-d", "LEI16@22050",
                aiff_file.name, wav_file.name,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.PIPE,
            )
            _, conv_err = await convert.communicate()
            if convert.returncode != 0:
                raise RuntimeError(f"afconvert failed: {conv_err.decode()}")

            with open(wav_file.name, "rb") as f:
                return f.read()
        finally:
            os.unlink(aiff_file.name)
            if os.path.exists(wav_file.name):
                os.unlink(wav_file.name)
