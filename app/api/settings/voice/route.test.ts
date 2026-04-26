// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import fs from "fs";

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "voice-settings-test-"));
  vi.stubEnv("VOICE_SETTINGS_PATH", path.join(tempDir, "voice-settings.json"));
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("GET /api/settings/voice", () => {
  it("returns env-based defaults when no config file exists", async () => {
    vi.stubEnv("STT_PROVIDER", "openai_whisper_api");
    vi.stubEnv("TTS_PROVIDER", "piper");
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sttProvider).toBe("openai_whisper_api");
    expect(body.ttsProvider).toBe("piper");
    expect(body.wakeWordThreshold).toBeTypeOf("number");
  });

  it("merges file values over env defaults", async () => {
    fs.writeFileSync(
      path.join(tempDir, "voice-settings.json"),
      JSON.stringify({ sttProvider: "stub" })
    );
    const { GET } = await import("./route");
    const res = await GET();
    const body = await res.json();
    expect(body.sttProvider).toBe("stub");
  });
});

describe("PATCH /api/settings/voice", () => {
  it("persists partial update and returns merged settings", async () => {
    const { PATCH } = await import("./route");
    const req = new Request("http://localhost/api/settings/voice", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sttProvider: "stub", wakeWordThreshold: 0.7 }),
    });
    const res = await PATCH(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sttProvider).toBe("stub");
    expect(body.wakeWordThreshold).toBe(0.7);

    const saved = JSON.parse(
      fs.readFileSync(path.join(tempDir, "voice-settings.json"), "utf8")
    );
    expect(saved.sttProvider).toBe("stub");
    expect(saved.wakeWordThreshold).toBe(0.7);
  });
});
