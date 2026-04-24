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

  it("passes speaker field from audio server response", async () => {
    // Mock fetch to return response with speaker
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ transcript: "hello", speaker: { user_id: "abc", confidence: 0.9 } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", mockFetch);

    const { POST } = await import("./route");
    const formData = new FormData();
    formData.append("file", new Blob([new Uint8Array(100)], { type: "audio/webm" }), "audio.webm");
    const req = new Request("http://localhost/api/voice/transcribe", {
      method: "POST",
      body: formData,
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.transcript).toBe("hello");
    expect(body.speaker).toMatchObject({ user_id: "abc", confidence: 0.9 });
  });
});
