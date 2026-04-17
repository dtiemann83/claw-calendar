import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { loadEmailDomainsConfig } from "./config.js"

describe("loadEmailDomainsConfig", () => {
  let dir: string
  let configPath: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "email-core-test-"))
    configPath = join(dir, "openclaw.json")
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it("loads a well-formed emailDomains block", () => {
    writeFileSync(
      configPath,
      JSON.stringify({
        emailDomains: {
          fallback: "general",
          routes: [
            {
              address: "school@tiemannfamily.us",
              domainTag: "school",
              subAddressing: { enabled: true, schema: "person", allowed: ["james"] },
            },
          ],
        },
      })
    )
    const cfg = loadEmailDomainsConfig(configPath)
    expect(cfg.fallback).toBe("general")
    expect(cfg.routes).toHaveLength(1)
    expect(cfg.routes[0].domainTag).toBe("school")
  })

  it("returns a safe default when emailDomains is missing", () => {
    writeFileSync(configPath, JSON.stringify({ agents: {} }))
    const cfg = loadEmailDomainsConfig(configPath)
    expect(cfg.fallback).toBe("general")
    expect(cfg.routes).toEqual([])
  })

  it("throws a clear error when emailDomains is malformed", () => {
    writeFileSync(
      configPath,
      JSON.stringify({ emailDomains: { routes: [{ address: "x@y" }] } }) // missing fallback + domainTag
    )
    expect(() => loadEmailDomainsConfig(configPath)).toThrow(/emailDomains/)
  })
})
