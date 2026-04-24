<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:voice-assistant-rules -->
## Voice Assistant Subsystem

This app includes a Python FastAPI audio service at `packages/audio-server/`.
Shared TypeScript message types live in `packages/shared/src/messages.ts`.
Provider selection is env-driven via `config/providers.ts`.
See `docs/voice-assistant/` for architecture docs.
<!-- END:voice-assistant-rules -->
