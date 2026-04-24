"""openWakeWord provider — client-side chunk processing mode.

Processes 80ms PCM chunks (1280 samples at 16kHz, int16) fed by the WebSocket
endpoint. Also supports room-mic mode via start()/stop() if sounddevice is
available, but that's optional for Phase 2.
"""
import asyncio
import os
import numpy as np
from typing import Callable

from openwakeword.model import Model


class OpenWakeWordProvider:
    CHUNK_SAMPLES = 1280  # 80ms at 16kHz

    def __init__(self) -> None:
        model_name = os.getenv("WAKE_WORD_MODEL", "hey_jarvis_v0.1")
        self._model = Model(wakeword_models=[model_name], inference_framework="onnx")
        self._threshold = float(os.getenv("WAKE_WORD_THRESHOLD", "0.5"))
        self._model_name = model_name
        self._on_detected: Callable[[], None] | None = None
        self._running = False
        self._buffer = bytearray()  # accumulates partial chunks

    def process_chunk(self, audio: bytes) -> bool:
        """Feed raw 16kHz int16 mono PCM bytes. Returns True when wake word fires."""
        self._buffer.extend(audio)
        chunk_bytes = self.CHUNK_SAMPLES * 2  # int16 = 2 bytes per sample
        detected = False
        while len(self._buffer) >= chunk_bytes:
            chunk = bytes(self._buffer[:chunk_bytes])
            del self._buffer[:chunk_bytes]
            samples = np.frombuffer(chunk, dtype=np.int16)
            scores = self._model.predict(samples)
            score = scores.get(self._model_name, 0.0)
            if score >= self._threshold:
                detected = True
        return detected

    async def start(self, on_detected: Callable[[], None]) -> None:
        """Room-mic mode — not implemented in Phase 2; use process_chunk instead."""
        self._on_detected = on_detected
        self._running = True

    async def stop(self) -> None:
        self._running = False
