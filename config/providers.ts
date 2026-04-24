export const providers = {
  wakeWord: process.env.WAKE_WORD_PROVIDER ?? "open_wake_word",
  stt: process.env.STT_PROVIDER ?? "openai_whisper_api",
  tts: process.env.TTS_PROVIDER ?? "piper",
  speakerId: process.env.SPEAKER_ID_PROVIDER ?? "resemblyzer",
} as const;

export type WakeWordProviderName = typeof providers.wakeWord;
export type STTProviderName = typeof providers.stt;
export type TTSProviderName = typeof providers.tts;
export type SpeakerIDProviderName = typeof providers.speakerId;
