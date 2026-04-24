import struct

# Minimal valid WAV: RIFF header for 0 bytes of PCM audio (44 bytes total)
_MINIMAL_WAV = (
    b"RIFF"
    + struct.pack("<I", 36)       # file size - 8
    + b"WAVE"
    + b"fmt "
    + struct.pack("<I", 16)       # chunk size
    + struct.pack("<H", 1)        # PCM format
    + struct.pack("<H", 1)        # mono
    + struct.pack("<I", 16000)    # 16kHz sample rate
    + struct.pack("<I", 32000)    # byte rate
    + struct.pack("<H", 2)        # block align
    + struct.pack("<H", 16)       # bits per sample
    + b"data"
    + struct.pack("<I", 0)        # data chunk size (0 bytes of audio)
)


class StubTTSProvider:
    async def synthesize(self, text: str, voice: str | None = None) -> bytes:
        return _MINIMAL_WAV
