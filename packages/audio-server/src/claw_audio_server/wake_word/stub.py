from typing import Callable


class StubWakeWordProvider:
    async def start(self, on_detected: Callable[[], None]) -> None:
        pass

    async def stop(self) -> None:
        pass

    def process_chunk(self, audio: bytes) -> bool:
        return False
