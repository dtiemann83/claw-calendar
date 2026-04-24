import { describe, it, expect, vi, beforeEach } from "vitest";
import { promisify } from "util";

const execFileMock = vi.fn();
// Give the mock the promisify.custom symbol so promisify(execFile)
// resolves with { stdout, stderr } matching Node's real execFile behavior.
const execFileCustomMock = vi.fn();
(execFileMock as any)[promisify.custom] = execFileCustomMock;

vi.mock("child_process", () => ({ execFile: execFileMock }));

describe("POST /api/agent/message", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.OPENCLAW_BIN = "/usr/bin/openclaw";
    process.env.OPENCLAW_AGENT_ID = "main";
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

  it("calls openclaw CLI and returns response", async () => {
    execFileCustomMock.mockResolvedValue({
      stdout: "",
      stderr: JSON.stringify({ payloads: [{ text: "The weather is sunny" }] }),
    });

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/agent/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "What's the weather?" }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ text: "The weather is sunny" });
  });
});
