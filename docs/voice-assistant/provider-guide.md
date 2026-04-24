# Provider Guide

All four audio subsystems (STT, TTS, wake-word, and speaker-ID) are selected at runtime by setting the corresponding `*_PROVIDER` environment variables, making it easy to swap between local and cloud-backed implementations without code changes.
