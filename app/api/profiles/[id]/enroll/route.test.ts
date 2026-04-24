// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/profiles/[id]/enroll", () => {
  it("returns 400 when no file", async () => {
    const { POST } = await import("./route");
    const formData = new FormData();
    const req = new Request("http://localhost/api/profiles/abc/enroll", {
      method: "POST",
      body: formData,
    });
    const res = await POST(req as any, { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(400);
  });

  it("forwards audio to audio server and returns result", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user_id: "abc", sample_count: 1 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", mockFetch);

    const { POST } = await import("./route");
    const formData = new FormData();
    formData.append("file", new Blob([new Uint8Array(100)], { type: "audio/webm" }), "sample.webm");
    const req = new Request("http://localhost/api/profiles/abc/enroll", {
      method: "POST",
      body: formData,
    });
    const res = await POST(req as any, { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user_id).toBe("abc");
    expect(body.sample_count).toBe(1);
  });
});
