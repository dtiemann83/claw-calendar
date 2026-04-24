class StubTTSProvider:
    async def synthesize(self, text: str, voice: str | None = None) -> bytes:
        return b""
