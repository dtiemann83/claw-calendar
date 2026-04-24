module.exports = {
  apps: [
    {
      name: "claw-calendar",
      script: "/Users/dtiemann/.nvm/versions/node/v22.22.2/bin/npm",
      args: "start",
      cwd: "/Users/dtiemann/claw-calendar",
      env: {
        OPENCLAW_BIN: "/Users/dtiemann/.nvm/versions/node/v22.22.2/bin/openclaw",
        OPENCLAW_AGENT_ID: "main",
        AUDIO_SERVER_URL: "http://127.0.0.1:3010",
      },
    },
    {
      name: "claw-audio-server",
      script: "/opt/local/bin/python3.11",
      args: "-m uvicorn claw_audio_server.main:app --host 0.0.0.0 --port 3010",
      cwd: "/Users/dtiemann/claw-calendar/packages/audio-server",
      env: {
        STT_PROVIDER: "faster_whisper_local",
        TTS_PROVIDER: "apple_say",
        WAKE_WORD_PROVIDER: "stub",
        SPEAKER_ID_PROVIDER: "stub",
        WHISPER_MODEL: "tiny.en",
        WHISPER_DEVICE: "cpu",
        OPENCLAW_GATEWAY_URL: "http://127.0.0.1:18789",
        AUDIO_SERVER_URL: "http://127.0.0.1:3010",
      },
    },
  ],
};
