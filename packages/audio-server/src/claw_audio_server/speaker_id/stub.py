from .base import SpeakerMatch


class StubSpeakerIDProvider:
    async def enroll(self, user_id: str, audio_samples: list[bytes]) -> None:
        pass

    async def identify(self, audio: bytes) -> SpeakerMatch | None:
        return None
