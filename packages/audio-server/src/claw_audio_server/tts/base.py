from typing import Protocol, runtime_checkable


@runtime_checkable
class TTSProvider(Protocol):
    async def synthesize(self, text: str, voice: str | None = None) -> bytes: ...
