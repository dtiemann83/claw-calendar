from dataclasses import dataclass
from typing import Protocol, runtime_checkable


@dataclass
class SpeakerMatch:
    user_id: str
    confidence: float


@runtime_checkable
class SpeakerIDProvider(Protocol):
    async def enroll(self, user_id: str, audio_samples: list[bytes]) -> None: ...
    async def identify(self, audio: bytes) -> SpeakerMatch | None: ...
