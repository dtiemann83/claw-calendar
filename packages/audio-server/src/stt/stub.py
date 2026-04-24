class StubSTTProvider:
    async def transcribe(self, audio: bytes, sample_rate: int) -> str:
        return ""
