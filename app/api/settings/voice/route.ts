import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

const DEFAULT_SETTINGS_PATH = path.join(
  os.homedir(),
  ".config",
  "claw-calendar",
  "voice-settings.json"
);

function getSettingsPath(): string {
  return process.env.VOICE_SETTINGS_PATH ?? DEFAULT_SETTINGS_PATH;
}

interface VoiceSettings {
  sttProvider: string;
  ttsProvider: string;
  wakeWordProvider: string;
  wakeWordModel: string;
  wakeWordThreshold: number;
  speakerIdProvider: string;
  speakerIdThreshold: number;
}

function readEnvDefaults(): VoiceSettings {
  return {
    sttProvider: process.env.STT_PROVIDER ?? "faster_whisper_local",
    ttsProvider: process.env.TTS_PROVIDER ?? "apple_say",
    wakeWordProvider: process.env.WAKE_WORD_PROVIDER ?? "open_wake_word",
    wakeWordModel: process.env.WAKE_WORD_MODEL ?? "hey_jarvis_v0.1",
    wakeWordThreshold: parseFloat(process.env.WAKE_WORD_THRESHOLD ?? "0.5"),
    speakerIdProvider: process.env.SPEAKER_ID_PROVIDER ?? "resemblyzer",
    speakerIdThreshold: parseFloat(process.env.SPEAKER_ID_THRESHOLD ?? "0.75"),
  };
}

function readFileOverrides(): Partial<VoiceSettings> {
  try {
    return JSON.parse(fs.readFileSync(getSettingsPath(), "utf8"));
  } catch {
    return {};
  }
}

function getSettings(): VoiceSettings {
  return { ...readEnvDefaults(), ...readFileOverrides() };
}

export async function GET() {
  return NextResponse.json(getSettings());
}

export async function PATCH(req: NextRequest) {
  const patch = (await req.json()) as Partial<VoiceSettings>;
  const merged = { ...readFileOverrides(), ...patch };

  const p = getSettingsPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(merged, null, 2));

  return NextResponse.json(getSettings());
}
