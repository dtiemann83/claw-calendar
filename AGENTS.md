<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:voice-assistant-rules -->
## Voice Assistant Subsystem

This app includes a Python FastAPI audio service at `packages/audio-server/`.
Shared TypeScript message types live in `packages/shared/src/messages.ts`.
Provider selection is env-driven — see providers.py in the audio server.

### Audio server environment variables (packages/audio-server)
- `STT_PROVIDER` — `faster_whisper_local` | `openai_whisper_api` | `stub`
- `TTS_PROVIDER` — `apple_say` | `piper` | `stub`
- `WAKE_WORD_PROVIDER` — `open_wake_word` | `stub`
- `WAKE_WORD_MODEL` — openWakeWord model name (default: `hey_jarvis_v0.1`)
- `WAKE_WORD_THRESHOLD` — detection threshold 0–1 (default: `0.5`)
- `SPEAKER_ID_PROVIDER` — `stub` (Phase 3)

### Next.js environment variables
- `AUDIO_SERVER_URL` — server-side HTTP URL for audio service (e.g. `http://127.0.0.1:3010`)
- `NEXT_PUBLIC_AUDIO_SERVER_WS_URL` — browser-side WebSocket URL (e.g. `ws://danas.mac.mini.lan:3010/ws`)
- `OPENCLAW_BIN` — path to openclaw CLI binary
- `OPENCLAW_AGENT_ID` — agent name (default: `main`)

### Wake word flow (Phase 2)
1. Browser connects to `NEXT_PUBLIC_AUDIO_SERVER_WS_URL`
2. AudioWorklet streams 80ms Int16 PCM chunks (48kHz) via WebSocket
3. Audio server resamples to 16kHz and feeds openWakeWord
4. On detection: server broadcasts `{ type: "wake", timestamp }` to all clients
5. VoiceSession auto-triggers recording; tap-to-talk remains as fallback
<!-- END:voice-assistant-rules -->
