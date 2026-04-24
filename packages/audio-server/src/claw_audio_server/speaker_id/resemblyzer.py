"""Resemblyzer-based speaker identification.

Embeddings are stored as .npy files in SPEAKER_EMBEDDINGS_DIR.
Each user gets a file: {dir}/{user_id}.npy — shape (N, 256) for N enrolled samples.
Identification: cosine similarity of new embedding against the mean of stored embeddings.
"""
import asyncio
import os
import numpy as np
from pathlib import Path
from .base import SpeakerMatch

EMBEDDINGS_DIR_DEFAULT = os.path.expanduser("~/.config/claw-calendar/speaker_embeddings")


class ResemblyzerSpeakerIDProvider:
    SAMPLE_RATE = 16000
    CONFIDENCE_THRESHOLD = float(os.getenv("SPEAKER_ID_THRESHOLD", "0.75"))

    def __init__(self) -> None:
        from resemblyzer import VoiceEncoder
        self._encoder = VoiceEncoder("cpu")
        self._dir = Path(os.getenv("SPEAKER_EMBEDDINGS_DIR", EMBEDDINGS_DIR_DEFAULT))
        self._dir.mkdir(parents=True, exist_ok=True)

    def _audio_to_embedding(self, audio_bytes: bytes) -> np.ndarray:
        """Convert raw 16kHz int16 PCM bytes → 256-dim float32 embedding."""
        from resemblyzer import preprocess_wav
        samples = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
        wav = preprocess_wav(samples, source_sr=self.SAMPLE_RATE)
        return self._encoder.embed_utterance(wav)

    def _load_embeddings(self, user_id: str) -> np.ndarray | None:
        """Load stored embeddings for a user. Returns (N, 256) array or None."""
        path = self._dir / f"{user_id}.npy"
        if not path.exists():
            return None
        return np.load(str(path))

    def _save_embeddings(self, user_id: str, embeddings: np.ndarray) -> None:
        np.save(str(self._dir / f"{user_id}.npy"), embeddings)

    def _cosine_similarity(self, a: np.ndarray, b: np.ndarray) -> float:
        return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-8))

    async def enroll(self, user_id: str, audio_samples: list[bytes]) -> None:
        """Enroll a user with one or more audio clips."""
        loop = asyncio.get_running_loop()
        new_embeddings = await asyncio.gather(
            *[loop.run_in_executor(None, self._audio_to_embedding, s) for s in audio_samples]
        )
        existing = self._load_embeddings(user_id)
        if existing is not None:
            combined = np.vstack([existing, new_embeddings])
        else:
            combined = np.array(new_embeddings)
        self._save_embeddings(user_id, combined)

    async def identify(self, audio: bytes) -> SpeakerMatch | None:
        """Identify speaker from raw 16kHz int16 PCM. Returns best match or None."""
        loop = asyncio.get_running_loop()
        query_emb = await loop.run_in_executor(None, self._audio_to_embedding, audio)

        best_match: SpeakerMatch | None = None
        for npy_file in self._dir.glob("*.npy"):
            user_id = npy_file.stem
            stored = np.load(str(npy_file))
            mean_emb = stored.mean(axis=0) if stored.ndim == 2 else stored
            similarity = self._cosine_similarity(query_emb, mean_emb)
            if similarity >= self.CONFIDENCE_THRESHOLD:
                if best_match is None or similarity > best_match.confidence:
                    best_match = SpeakerMatch(user_id=user_id, confidence=similarity)

        return best_match
