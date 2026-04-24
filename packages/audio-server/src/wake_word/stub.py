from typing import Callable


class StubWakeWordProvider:
    async def start(self, on_detected: Callable[[], None]) -> None:
        pass

    async def stop(self) -> None:
        pass
