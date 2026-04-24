import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("POST /api/voice/transcribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUDIO_SERVER_URL = "http://localhost:8080";
  });

  it("returns 400 when no file provided", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/voice/transcribe", {
      method: "POST",
      body: new FormData(),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it("proxies to audio server and returns transcript", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ transcript: "hello world" }),
    });

    const { POST } = await import("./route");
    const formData = new FormData();
    formData.append("file", new Blob([new Uint8Array(100)]), "audio.webm");

    const req = new Request("http://localhost/api/voice/transcribe", {
      method: "POST",
      body: formData,
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ transcript: "hello world" });
  });
});
