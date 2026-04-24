from typing import Protocol, runtime_checkable


@runtime_checkable
class STTProvider(Protocol):
    async def transcribe(self, audio: bytes, sample_rate: int) -> str: ...
