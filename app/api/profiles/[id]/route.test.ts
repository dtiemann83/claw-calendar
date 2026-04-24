// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import fs from "fs";

let tempDb: string;

beforeEach(() => {
  tempDb = path.join(os.tmpdir(), `test-profiles-id-${Date.now()}.db`);
  vi.stubEnv("DATABASE_PATH", tempDb);
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  try { fs.unlinkSync(tempDb); } catch {}
});

describe("GET /api/profiles/[id]", () => {
  it("returns 404 for unknown id", async () => {
    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/profiles/nonexistent");
    const res = await GET(req as any, { params: Promise.resolve({ id: "nonexistent" }) });
    expect(res.status).toBe(404);
  });

  it("returns a profile that was created", async () => {
    // First create a profile via the parent route
    const { POST } = await import("../route");
    const createReq = new Request("http://localhost/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Bob", color: "#10b981" }),
    });
    const createRes = await POST(createReq as any);
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    // Then fetch it by id
    const { GET } = await import("./route");
    const req = new Request(`http://localhost/api/profiles/${created.id}`);
    const res = await GET(req as any, { params: Promise.resolve({ id: created.id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Bob");
    expect(body.id).toBe(created.id);
  });
});

describe("DELETE /api/profiles/[id]", () => {
  it("returns 404 when deleting nonexistent profile", async () => {
    const { DELETE } = await import("./route");
    const req = new Request("http://localhost/api/profiles/nonexistent", { method: "DELETE" });
    const res = await DELETE(req as any, { params: Promise.resolve({ id: "nonexistent" }) });
    expect(res.status).toBe(404);
  });

  it("deletes an existing profile", async () => {
    // Create a profile first
    const { POST } = await import("../route");
    const createReq = new Request("http://localhost/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Carol" }),
    });
    const createRes = await POST(createReq as any);
    const created = await createRes.json();

    // Delete it
    const { DELETE } = await import("./route");
    const req = new Request(`http://localhost/api/profiles/${created.id}`, { method: "DELETE" });
    const res = await DELETE(req as any, { params: Promise.resolve({ id: created.id }) });
    expect(res.status).toBe(204);

    // Verify it's gone
    const { GET } = await import("./route");
    const getReq = new Request(`http://localhost/api/profiles/${created.id}`);
    const getRes = await GET(getReq as any, { params: Promise.resolve({ id: created.id }) });
    expect(getRes.status).toBe(404);
  });
});
