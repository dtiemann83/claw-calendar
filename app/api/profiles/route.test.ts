// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import fs from "fs";

// Use a unique temp DB for each test run
let tempDb: string;

beforeEach(() => {
  tempDb = path.join(os.tmpdir(), `test-profiles-${Date.now()}.db`);
  vi.stubEnv("DATABASE_PATH", tempDb);
  vi.resetModules(); // force fresh db singleton per test
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  try { fs.unlinkSync(tempDb); } catch {}
});

describe("GET /api/profiles", () => {
  it("returns empty array when no profiles", async () => {
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});

describe("POST /api/profiles", () => {
  it("creates a profile", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Alice", color: "#ef4444" }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("Alice");
    expect(body.color).toBe("#ef4444");
    expect(body.id).toBeTruthy();
  });

  it("returns 400 when name missing", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color: "#ef4444" }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });
});
