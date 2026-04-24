export type SpeakerMatch = { userId: string; confidence: number };

// From audio service → Web client
export type AudioServerEvent =
  | { type: "wake"; timestamp: number; room?: string }
  | { type: "partial_transcript"; text: string }
  | { type: "final_transcript"; text: string; speaker?: SpeakerMatch }
  | { type: "error"; message: string };

// From Web client → audio service
export type WebCommand =
  | { type: "start_listening"; sessionId: string }
  | { type: "stop_listening" }
  | { type: "synthesize"; text: string; voice?: string }
  | { type: "enroll_start"; userId: string }
  | { type: "enroll_sample"; userId: string; audioB64: string };
