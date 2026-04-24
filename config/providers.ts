export type WakeWordProviderName = "open_wake_word" | "porcupine" | "stub";
export type STTProviderName = "openai_whisper_api" | "deepgram" | "faster_whisper_local" | "apple_speech" | "stub";
export type TTSProviderName = "piper" | "apple_say" | "elevenlabs" | "openai" | "stub";
export type SpeakerIDProviderName = "resemblyzer" | "speechbrain" | "stub";

export const providers = {
  wakeWord: (process.env.WAKE_WORD_PROVIDER ?? "open_wake_word") as WakeWordProviderName,
  stt: (process.env.STT_PROVIDER ?? "openai_whisper_api") as STTProviderName,
  tts: (process.env.TTS_PROVIDER ?? "piper") as TTSProviderName,
  speakerId: (process.env.SPEAKER_ID_PROVIDER ?? "resemblyzer") as SpeakerIDProviderName,
} as const;
