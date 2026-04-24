from typing import Protocol, Callable, runtime_checkable


@runtime_checkable
class WakeWordProvider(Protocol):
    async def start(self, on_detected: Callable[[], None]) -> None: ...
    async def stop(self) -> None: ...
