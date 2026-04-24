from typing import Protocol, Callable, runtime_checkable


@runtime_checkable
class WakeWordProvider(Protocol):
    async def start(self, on_detected: Callable[[], None]) -> None: ...
    async def stop(self) -> None: ...
    def process_chunk(self, audio: bytes) -> bool:
        """Process a raw 16kHz int16 mono PCM chunk. Returns True if wake word detected."""
        ...
