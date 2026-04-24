import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("POST /api/agent/message", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENCLAW_GATEWAY_URL = "http://localhost:18789";
  });

  it("returns 400 when no text provided", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/agent/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "  " }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it("calls OpenClaw gateway and returns response", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ text: "The weather is sunny" }),
    });

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/agent/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "What's the weather?" }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ text: "The weather is sunny" });
  });
});
