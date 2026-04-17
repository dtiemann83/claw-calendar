# Address-aware Postie Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thread receiving-address context (Domain + optional SubTag) through Postie's triage into Zoidberg's handoff, driven by a data-driven `emailDomains` config in `openclaw.json`.

**Architecture:** A new workspace package `@claw/email-core` provides a pure `parseRecipient` function and a `claw-email` CLI. A bash shim at `~/.openclaw/workspace/scripts/email-domain.sh` makes the CLI easy to call from Postie's agent turn. Postie's `AGENTS.md` is updated to invoke the shim at the start of each turn, pre-filling Domain/SubTag before classifying Intent from the body. Zoidberg's family-calendar skill gains a hashtag composition table so `(domain, subTag)` maps to tag conventions like `#school #James`.

**Tech Stack:** TypeScript, Node 22, zod (runtime validation), vitest (tests), bash (shim). Mirrors the shape of existing `@claw/calendar-core` and `@claw/kitchen-core` packages.

---

## File Structure

**Create:**
- `packages/email-core/package.json` — workspace package manifest
- `packages/email-core/tsconfig.json` — TS config (copy of kitchen-core's)
- `packages/email-core/src/types.ts` — zod schemas for `EmailDomainsConfig`, `ParsedRecipient`
- `packages/email-core/src/parser.ts` — pure `parseRecipient(to, config)` function
- `packages/email-core/src/parser.test.ts` — vitest table-driven tests
- `packages/email-core/src/config.ts` — config loader (reads `OPENCLAW_CONFIG` or `~/.openclaw/openclaw.json`, validates the `emailDomains` block)
- `packages/email-core/src/config.test.ts` — vitest tests for loader
- `packages/email-core/src/index.ts` — public exports
- `packages/email-core/src/bin/claw-email.ts` — CLI
- `/Users/dtiemann/.openclaw/workspace/scripts/email-domain.sh` — bash shim

**Modify:**
- `/Users/dtiemann/.openclaw/openclaw.json` — add `emailDomains` block at top level
- `/Users/dtiemann/.openclaw/agents/resend-inbox/workspace/AGENTS.md` — invoke shim at turn start; add Domain/SubTag/Intent to handoff block
- `/Users/dtiemann/.openclaw/workspace/skills/family-calendar/SKILL.md` — add hashtag composition table for `(domain, subTag)` → hashtags

---

## Task 1: Scaffold `@claw/email-core` package

**Files:**
- Create: `packages/email-core/package.json`
- Create: `packages/email-core/tsconfig.json`
- Create: `packages/email-core/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@claw/email-core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    }
  },
  "bin": {
    "claw-email": "./dist/bin/claw-email.js"
  },
  "files": ["dist", "src"],
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@types/node": "^20",
    "typescript": "^5",
    "vitest": "^4.1.4"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

Copy from `packages/kitchen-core/tsconfig.json` — same compiler settings, same include/exclude.

Run: `cp /Users/dtiemann/claw-calendar/packages/kitchen-core/tsconfig.json /Users/dtiemann/claw-calendar/packages/email-core/tsconfig.json`

- [ ] **Step 3: Create empty src/index.ts placeholder**

```ts
// exports added as modules land
export {}
```

- [ ] **Step 4: Install workspace deps**

Run: `cd /Users/dtiemann/claw-calendar && npm install`
Expected: installs email-core's zod + vitest, adds email-core to the workspace.

- [ ] **Step 5: Smoke-build**

Run: `cd /Users/dtiemann/claw-calendar/packages/email-core && npm run build`
Expected: exits 0, creates `dist/index.js`.

- [ ] **Step 6: Commit**

```bash
cd /Users/dtiemann/claw-calendar
git add packages/email-core/ package-lock.json
git commit -m "feat(email-core): scaffold @claw/email-core workspace package"
```

---

## Task 2: Types module

**Files:**
- Create: `packages/email-core/src/types.ts`

- [ ] **Step 1: Write the types file**

```ts
import { z } from "zod"

/** How subaddress (+<sub>) values are validated for a given route. */
export const SubAddressingSchema = z.object({
  enabled: z.boolean().default(false),
  /**
   * "person" — `sub` must match one of `allowed` (case-insensitive).
   * "free"   — any non-empty string is accepted; no validation.
   */
  schema: z.enum(["person", "free"]).optional(),
  allowed: z.array(z.string()).optional(),
})

export type SubAddressing = z.infer<typeof SubAddressingSchema>

/** One configured inbound address. */
export const EmailRouteSchema = z.object({
  /** Full address, e.g. "school@tiemannfamily.us". Matched case-insensitively. */
  address: z.string().min(3),
  /** Short deterministic tag threaded through the handoff, e.g. "school". */
  domainTag: z.string().min(1),
  description: z.string().optional(),
  subAddressing: SubAddressingSchema.optional(),
})

export type EmailRoute = z.infer<typeof EmailRouteSchema>

/** Top-level `emailDomains` block in openclaw.json. */
export const EmailDomainsConfigSchema = z.object({
  /** Domain tag to use when no route matches (e.g. "general"). */
  fallback: z.string().min(1),
  routes: z.array(EmailRouteSchema),
})

export type EmailDomainsConfig = z.infer<typeof EmailDomainsConfigSchema>

/** Output of parseRecipient — the three fields threaded into Postie's envelope. */
export interface ParsedRecipient {
  domainTag: string
  subTag: string | null
  subTagKnown: boolean
  matchedAddress: string | null
}
```

- [ ] **Step 2: Export from index**

Replace `packages/email-core/src/index.ts` with:

```ts
export * from "./types.js"
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/dtiemann/claw-calendar/packages/email-core && npm run build`
Expected: exits 0, `dist/types.js` and `dist/types.d.ts` present.

- [ ] **Step 4: Commit**

```bash
cd /Users/dtiemann/claw-calendar
git add packages/email-core/src/types.ts packages/email-core/src/index.ts
git commit -m "feat(email-core): add zod schemas for EmailDomainsConfig + ParsedRecipient"
```

---

## Task 3: Parser — first failing test

**Files:**
- Create: `packages/email-core/src/parser.test.ts`

- [ ] **Step 1: Write the first failing test**

Create `packages/email-core/src/parser.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { parseRecipient } from "./parser.js"
import type { EmailDomainsConfig } from "./types.js"

const CONFIG: EmailDomainsConfig = {
  fallback: "general",
  routes: [
    {
      address: "school@tiemannfamily.us",
      domainTag: "school",
      subAddressing: { enabled: true, schema: "person", allowed: ["james", "sean", "eleanor"] },
    },
    {
      address: "sports@tiemannfamily.us",
      domainTag: "sports",
      subAddressing: { enabled: true, schema: "person", allowed: ["james", "sean", "eleanor"] },
    },
    {
      address: "general@tiemannfamily.us",
      domainTag: "general",
      subAddressing: { enabled: true, schema: "free" },
    },
  ],
}

describe("parseRecipient", () => {
  it("matches a bare configured address", () => {
    expect(parseRecipient("school@tiemannfamily.us", CONFIG)).toEqual({
      domainTag: "school",
      subTag: null,
      subTagKnown: true,
      matchedAddress: "school@tiemannfamily.us",
    })
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `cd /Users/dtiemann/claw-calendar/packages/email-core && npx vitest run`
Expected: FAIL — "Cannot find module './parser.js'" or similar.

---

## Task 4: Parser — minimal implementation

**Files:**
- Create: `packages/email-core/src/parser.ts`

- [ ] **Step 1: Write the parser**

```ts
import type { EmailDomainsConfig, EmailRoute, ParsedRecipient } from "./types.js"

/**
 * Parse an inbound `To:` string into the three fields Postie threads into its
 * envelope. Deterministic, pure, no I/O. Call with the Resend envelope `to`
 * when available; the raw `To:` header works too because display-name stripping
 * is handled here.
 */
export function parseRecipient(to: string, config: EmailDomainsConfig): ParsedRecipient {
  const addresses = extractAddresses(to)

  // First, try to match any address against a configured route.
  for (const addr of addresses) {
    const match = matchRoute(addr, config.routes)
    if (match) {
      const { route, base, sub } = match
      const { subTag, subTagKnown } = resolveSubTag(sub, route)
      return {
        domainTag: route.domainTag,
        subTag,
        subTagKnown,
        matchedAddress: route.address.toLowerCase(),
      }
    }
  }

  // No configured route matched → fallback.
  return {
    domainTag: config.fallback,
    subTag: null,
    subTagKnown: true,
    matchedAddress: null,
  }
}

/**
 * Pull bare email addresses out of a `To:`-style string that may include
 * display names, multiple addresses, or angle brackets.
 *
 * Examples:
 *   "School <school+james@tiemannfamily.us>"           → ["school+james@tiemannfamily.us"]
 *   "a@x.com, B <b@y.com>"                             → ["a@x.com", "b@y.com"]
 */
function extractAddresses(to: string): string[] {
  const out: string[] = []
  // Angle-bracketed addresses first.
  const angled = to.match(/<([^>]+)>/g)
  if (angled) {
    for (const a of angled) out.push(a.slice(1, -1).trim())
  }
  // Then comma-split fallback for bare addresses without angle brackets.
  for (const chunk of to.split(",")) {
    const cleaned = chunk.replace(/<[^>]*>/g, "").trim()
    if (cleaned && cleaned.includes("@") && !cleaned.includes(" ")) {
      out.push(cleaned)
    }
  }
  // Dedup preserving first-seen order.
  return [...new Set(out.map(s => s.trim()).filter(s => s.length > 0))]
}

/**
 * Try to match a single email address against any configured route.
 * Matching is case-insensitive on (base, domain); subaddress is preserved.
 */
function matchRoute(
  address: string,
  routes: EmailRoute[]
): { route: EmailRoute; base: string; sub: string | null } | null {
  const atIdx = address.lastIndexOf("@")
  if (atIdx < 0) return null
  const local = address.slice(0, atIdx)
  const domain = address.slice(atIdx + 1).toLowerCase()

  const plusIdx = local.indexOf("+")
  const base = (plusIdx >= 0 ? local.slice(0, plusIdx) : local).toLowerCase()
  const subRaw = plusIdx >= 0 ? local.slice(plusIdx + 1) : ""
  const sub = subRaw.length > 0 ? subRaw.toLowerCase() : null

  for (const route of routes) {
    const [rBase, rDomain] = splitAtSign(route.address)
    if (rBase.toLowerCase() === base && rDomain.toLowerCase() === domain) {
      return { route, base, sub }
    }
  }
  return null
}

function splitAtSign(address: string): [string, string] {
  const i = address.lastIndexOf("@")
  return i < 0 ? [address, ""] : [address.slice(0, i), address.slice(i + 1)]
}

/**
 * Apply a route's subAddressing rules to a parsed `sub`.
 * Returns the tag to emit and whether it was recognized.
 */
function resolveSubTag(
  sub: string | null,
  route: EmailRoute
): { subTag: string | null; subTagKnown: boolean } {
  const sa = route.subAddressing
  if (!sub || !sa?.enabled) return { subTag: null, subTagKnown: true }

  if (sa.schema === "person") {
    const allowed = (sa.allowed ?? []).map(s => s.toLowerCase())
    return { subTag: sub, subTagKnown: allowed.includes(sub) }
  }

  // "free" or unspecified: accept anything non-empty.
  return { subTag: sub, subTagKnown: true }
}
```

- [ ] **Step 2: Run the test, expect it to pass**

Run: `cd /Users/dtiemann/claw-calendar/packages/email-core && npx vitest run`
Expected: PASS (1 test).

- [ ] **Step 3: Commit**

```bash
cd /Users/dtiemann/claw-calendar
git add packages/email-core/src/parser.ts packages/email-core/src/parser.test.ts
git commit -m "feat(email-core): parseRecipient matches bare configured address"
```

---

## Task 5: Parser — subaddress + person-schema cases

**Files:**
- Modify: `packages/email-core/src/parser.test.ts` — append cases

- [ ] **Step 1: Add failing tests for subaddress handling**

Append to `parser.test.ts` inside the `describe` block:

```ts
  it("captures a known person subTag", () => {
    expect(parseRecipient("school+james@tiemannfamily.us", CONFIG)).toEqual({
      domainTag: "school",
      subTag: "james",
      subTagKnown: true,
      matchedAddress: "school@tiemannfamily.us",
    })
  })

  it("flags an unknown person subTag as subTagKnown=false", () => {
    expect(parseRecipient("school+aunt-lisa@tiemannfamily.us", CONFIG)).toEqual({
      domainTag: "school",
      subTag: "aunt-lisa",
      subTagKnown: false,
      matchedAddress: "school@tiemannfamily.us",
    })
  })

  it("accepts any subTag on a free-schema route", () => {
    expect(parseRecipient("general+field-trip@tiemannfamily.us", CONFIG)).toEqual({
      domainTag: "general",
      subTag: "field-trip",
      subTagKnown: true,
      matchedAddress: "general@tiemannfamily.us",
    })
  })

  it("treats an empty sub (trailing +) as no sub", () => {
    expect(parseRecipient("school+@tiemannfamily.us", CONFIG)).toEqual({
      domainTag: "school",
      subTag: null,
      subTagKnown: true,
      matchedAddress: "school@tiemannfamily.us",
    })
  })

  it("lowercases the subTag when comparing against allowed", () => {
    expect(parseRecipient("SCHOOL+James@tiemannfamily.us", CONFIG)).toEqual({
      domainTag: "school",
      subTag: "james",
      subTagKnown: true,
      matchedAddress: "school@tiemannfamily.us",
    })
  })
```

- [ ] **Step 2: Run tests, expect these to pass**

Run: `cd /Users/dtiemann/claw-calendar/packages/email-core && npx vitest run`
Expected: 6 passing tests. (Parser was written general enough in Task 4 to cover these.) If any fail, fix the parser inline; common culprits are forgotten lowercasing or the empty-sub edge.

- [ ] **Step 3: Commit**

```bash
cd /Users/dtiemann/claw-calendar
git add packages/email-core/src/parser.test.ts packages/email-core/src/parser.ts
git commit -m "test(email-core): cover subaddress matching + person/free schemas"
```

---

## Task 6: Parser — envelopes with display names, multiple addresses, fallback

**Files:**
- Modify: `packages/email-core/src/parser.test.ts`

- [ ] **Step 1: Add remaining edge-case tests**

Append to `parser.test.ts` inside the `describe` block:

```ts
  it("strips a display name with angle brackets", () => {
    expect(
      parseRecipient('"School" <school+james@tiemannfamily.us>', CONFIG)
    ).toEqual({
      domainTag: "school",
      subTag: "james",
      subTagKnown: true,
      matchedAddress: "school@tiemannfamily.us",
    })
  })

  it("picks the first configured route when multiple addresses are present", () => {
    expect(
      parseRecipient(
        "Nobody <nobody@example.com>, School <school@tiemannfamily.us>",
        CONFIG
      )
    ).toMatchObject({ domainTag: "school", matchedAddress: "school@tiemannfamily.us" })
  })

  it("falls back to config.fallback for unconfigured addresses", () => {
    expect(parseRecipient("billing@tiemannfamily.us", CONFIG)).toEqual({
      domainTag: "general",
      subTag: null,
      subTagKnown: true,
      matchedAddress: null,
    })
  })

  it("falls back when the input has no @ sign at all", () => {
    expect(parseRecipient("not-an-email", CONFIG)).toEqual({
      domainTag: "general",
      subTag: null,
      subTagKnown: true,
      matchedAddress: null,
    })
  })
```

- [ ] **Step 2: Run tests**

Run: `cd /Users/dtiemann/claw-calendar/packages/email-core && npx vitest run`
Expected: 10 passing tests.

- [ ] **Step 3: Commit**

```bash
cd /Users/dtiemann/claw-calendar
git add packages/email-core/src/parser.test.ts
git commit -m "test(email-core): cover display-name, multi-address, and fallback cases"
```

---

## Task 7: Config loader

**Files:**
- Create: `packages/email-core/src/config.ts`
- Create: `packages/email-core/src/config.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/email-core/src/config.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it — expect failure**

Run: `cd /Users/dtiemann/claw-calendar/packages/email-core && npx vitest run`
Expected: new tests fail with "Cannot find module './config.js'".

- [ ] **Step 3: Implement the loader**

Create `packages/email-core/src/config.ts`:

```ts
import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { EmailDomainsConfigSchema, type EmailDomainsConfig } from "./types.js"

const DEFAULT_CONFIG: EmailDomainsConfig = {
  fallback: "general",
  routes: [],
}

/**
 * Load the `emailDomains` block from an openclaw.json file.
 *
 * Resolution order for the path argument:
 *   1. Explicit `path` parameter.
 *   2. `OPENCLAW_CONFIG` env var.
 *   3. `~/.openclaw/openclaw.json`.
 *
 * If the file exists but has no `emailDomains` key, a safe default is returned
 * (`fallback=general`, no routes) so the caller can treat missing config as
 * "everything is general."
 */
export function loadEmailDomainsConfig(path?: string): EmailDomainsConfig {
  const resolved = path ?? process.env.OPENCLAW_CONFIG ?? join(homedir(), ".openclaw", "openclaw.json")
  const raw = readFileSync(resolved, "utf8")
  const parsed = JSON.parse(raw) as Record<string, unknown>
  if (!parsed || typeof parsed !== "object" || !("emailDomains" in parsed)) {
    return DEFAULT_CONFIG
  }
  const result = EmailDomainsConfigSchema.safeParse(parsed.emailDomains)
  if (!result.success) {
    throw new Error(`invalid emailDomains block in ${resolved}: ${result.error.message}`)
  }
  return result.data
}
```

- [ ] **Step 4: Export from index**

Update `packages/email-core/src/index.ts`:

```ts
export * from "./types.js"
export * from "./parser.js"
export * from "./config.js"
```

- [ ] **Step 5: Run tests, all pass**

Run: `cd /Users/dtiemann/claw-calendar/packages/email-core && npx vitest run`
Expected: 13 passing tests.

- [ ] **Step 6: Commit**

```bash
cd /Users/dtiemann/claw-calendar
git add packages/email-core/src/config.ts packages/email-core/src/config.test.ts packages/email-core/src/index.ts
git commit -m "feat(email-core): add openclaw.json emailDomains loader"
```

---

## Task 8: `claw-email` CLI

**Files:**
- Create: `packages/email-core/src/bin/claw-email.ts`

- [ ] **Step 1: Write the CLI**

```ts
#!/usr/bin/env node
import { parseArgs } from "node:util"
import { parseRecipient } from "../parser.js"
import { loadEmailDomainsConfig } from "../config.js"

const USAGE = `Usage:
  claw-email domain "<to-string>" [--json]

Reads emailDomains config from \$OPENCLAW_CONFIG or ~/.openclaw/openclaw.json.

Text output (default):
  Domain: <tag>
  SubTag: <sub>       (omitted when null)
  SubTagKnown: true|false   (only when SubTag present)
  MatchedAddress: <address> (or "none")

JSON output (--json):
  { "domainTag": "...", "subTag": "... | null", "subTagKnown": bool, "matchedAddress": "... | null" }
`

function die(msg: string, code = 1): never {
  process.stderr.write(`ERROR: ${msg}\n`)
  process.exit(code)
}

function main(argv: string[]): void {
  const cmd = argv[0]
  if (!cmd || cmd === "--help" || cmd === "-h") {
    process.stdout.write(USAGE)
    return
  }
  if (cmd !== "domain") die(`unknown command: ${cmd}\n${USAGE}`)

  const { values, positionals } = parseArgs({
    args: argv.slice(1),
    options: { json: { type: "boolean", default: false } },
    allowPositionals: true,
  })
  const to = positionals.join(" ").trim()
  if (!to) die("domain requires the To-string as a positional argument")

  const config = loadEmailDomainsConfig()
  const r = parseRecipient(to, config)

  if (values.json) {
    process.stdout.write(JSON.stringify(r) + "\n")
    return
  }
  process.stdout.write(`Domain: ${r.domainTag}\n`)
  if (r.subTag !== null) {
    process.stdout.write(`SubTag: ${r.subTag}\n`)
    process.stdout.write(`SubTagKnown: ${r.subTagKnown}\n`)
  }
  process.stdout.write(`MatchedAddress: ${r.matchedAddress ?? "none"}\n`)
}

main(process.argv.slice(2))
```

- [ ] **Step 2: Build the package**

Run: `cd /Users/dtiemann/claw-calendar/packages/email-core && npm run build`
Expected: exits 0, `dist/bin/claw-email.js` present with shebang.

- [ ] **Step 3: Make the CLI discoverable on PATH**

Run: `cd /Users/dtiemann/claw-calendar && npm install`
Expected: npm re-links `claw-email` into `node_modules/.bin`. Confirm: `npx claw-email --help` prints USAGE.

- [ ] **Step 4: Manual smoke test against a real config**

Set up a temporary config with the 3 example routes, point OPENCLAW_CONFIG at it, and run the CLI.

```bash
cat > /tmp/claw-email-smoke.json <<'EOF'
{
  "emailDomains": {
    "fallback": "general",
    "routes": [
      { "address": "school@tiemannfamily.us", "domainTag": "school",
        "subAddressing": { "enabled": true, "schema": "person", "allowed": ["james","sean","eleanor"] } },
      { "address": "sports@tiemannfamily.us", "domainTag": "sports",
        "subAddressing": { "enabled": true, "schema": "person", "allowed": ["james","sean","eleanor"] } },
      { "address": "general@tiemannfamily.us", "domainTag": "general",
        "subAddressing": { "enabled": true, "schema": "free" } }
    ]
  }
}
EOF

OPENCLAW_CONFIG=/tmp/claw-email-smoke.json npx claw-email domain 'School <school+james@tiemannfamily.us>'
OPENCLAW_CONFIG=/tmp/claw-email-smoke.json npx claw-email domain 'billing@tiemannfamily.us'
OPENCLAW_CONFIG=/tmp/claw-email-smoke.json npx claw-email domain 'school+aunt-lisa@tiemannfamily.us' --json
```

Expected output (in order):
```
Domain: school
SubTag: james
SubTagKnown: true
MatchedAddress: school@tiemannfamily.us

Domain: general
MatchedAddress: none

{"domainTag":"school","subTag":"aunt-lisa","subTagKnown":false,"matchedAddress":"school@tiemannfamily.us"}
```

- [ ] **Step 5: Commit**

```bash
cd /Users/dtiemann/claw-calendar
git add packages/email-core/src/bin/
git commit -m "feat(email-core): add claw-email CLI"
```

---

## Task 9: Bash shim at `~/.openclaw/workspace/scripts/email-domain.sh`

**Files:**
- Create: `/Users/dtiemann/.openclaw/workspace/scripts/email-domain.sh`

- [ ] **Step 1: Write the shim**

```bash
#!/usr/bin/env bash
# email-domain.sh — Deterministic recipient parser for Postie.
# Given an inbound email's To-string, prints:
#   Domain: <tag>
#   SubTag: <sub>            (omitted when none)
#   SubTagKnown: true|false  (only when SubTag present)
#   MatchedAddress: <addr>   (or "none")
#
# Reads route config from $OPENCLAW_CONFIG or ~/.openclaw/openclaw.json.
# Exits non-zero with "ERROR: ..." on bad input or malformed config.
#
# Usage:
#   email-domain.sh "<to-string>"          # text output
#   email-domain.sh --json "<to-string>"   # JSON output

if [ "${1:-}" = "--json" ]; then
  shift
  exec claw-email domain "${1:?Usage: email-domain.sh [--json] <to-string>}" --json
fi

exec claw-email domain "${1:?Usage: email-domain.sh [--json] <to-string>}"
```

- [ ] **Step 2: chmod +x the shim**

Run: `chmod +x /Users/dtiemann/.openclaw/workspace/scripts/email-domain.sh`

- [ ] **Step 3: Smoke test the shim**

```bash
OPENCLAW_CONFIG=/tmp/claw-email-smoke.json \
  /Users/dtiemann/.openclaw/workspace/scripts/email-domain.sh 'school+james@tiemannfamily.us'
```

Expected:
```
Domain: school
SubTag: james
SubTagKnown: true
MatchedAddress: school@tiemannfamily.us
```

- [ ] **Step 4: Commit (note: this path isn't the claw-calendar repo — it's the live openclaw workspace)**

The shim lives outside the git repo. Record the file in a note inside the repo for discoverability:

Append one line to `packages/email-core/README.md` (create if missing):

```md
# @claw/email-core

Pure parser + CLI for mapping inbound Resend email addresses onto Postie's
Domain/SubTag envelope fields. Consumed by:

- `/Users/dtiemann/.openclaw/workspace/scripts/email-domain.sh` — Postie's shim.
- `openclaw.json.emailDomains` — route table.

See `docs/superpowers/specs/2026-04-17-address-aware-postie-design.md` for the
design context.
```

```bash
cd /Users/dtiemann/claw-calendar
git add packages/email-core/README.md
git commit -m "docs(email-core): README pointing to shim + config"
```

---

## Task 10: Add `emailDomains` block to `openclaw.json`

**Files:**
- Modify: `/Users/dtiemann/.openclaw/openclaw.json`

- [ ] **Step 1: Back up the live config**

Run: `cp /Users/dtiemann/.openclaw/openclaw.json /Users/dtiemann/.openclaw/openclaw.json.bak-$(date -u +%Y%m%d-%H%M%S)`

- [ ] **Step 2: Add the top-level `emailDomains` block**

Insert this block at the root of `openclaw.json` (alongside `agents`, `bindings`, `channels`, …):

```json
  "emailDomains": {
    "fallback": "general",
    "routes": [
      {
        "address": "school@tiemannfamily.us",
        "domainTag": "school",
        "description": "Raleigh Oak Charter, PTA, teachers, report cards",
        "subAddressing": {
          "enabled": true,
          "schema": "person",
          "allowed": ["james", "sean", "eleanor"]
        }
      },
      {
        "address": "sports@tiemannfamily.us",
        "domainTag": "sports",
        "description": "Schedules, practices, coach communications",
        "subAddressing": {
          "enabled": true,
          "schema": "person",
          "allowed": ["james", "sean", "eleanor"]
        }
      },
      {
        "address": "general@tiemannfamily.us",
        "domainTag": "general",
        "description": "Catch-all family mail",
        "subAddressing": { "enabled": true, "schema": "free" }
      }
    ]
  },
```

- [ ] **Step 3: Verify JSON is still valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('/Users/dtiemann/.openclaw/openclaw.json','utf8'))"`
Expected: exits 0, no output.

- [ ] **Step 4: Verify via the CLI reading the real config**

Run (with no `OPENCLAW_CONFIG` override so it uses the default path):

```bash
unset OPENCLAW_CONFIG
claw-email domain 'school+james@tiemannfamily.us'
```

Expected:
```
Domain: school
SubTag: james
SubTagKnown: true
MatchedAddress: school@tiemannfamily.us
```

- [ ] **Step 5: Watch gateway.log for a config reload event**

Run: `tail -20 /Users/dtiemann/.openclaw/logs/gateway.log | grep -i reload`
Expected: a recent `[reload] config change detected` line — confirms the live gateway picked up the change. No restart should be required.

---

## Task 11: Update Postie's AGENTS.md to parse + thread Domain/SubTag

**Files:**
- Modify: `/Users/dtiemann/.openclaw/agents/resend-inbox/workspace/AGENTS.md`

- [ ] **Step 1: Add an envelope-parsing step to the triage workflow**

Find the block under `## What Each Turn Looks Like` that ends with `--- Body ---`. Immediately after that section, before `## Triage Workflow`, insert:

```md
## Envelope parsing (do this before classifying)

Before you classify the email, derive the Domain and SubTag deterministically from the `To:` address. Run:

```bash
~/.openclaw/workspace/scripts/email-domain.sh "<the To: value from the envelope>"
```

The output has this shape:

```
Domain: school
SubTag: james
SubTagKnown: true
MatchedAddress: school@tiemannfamily.us
```

`SubTag` and `SubTagKnown` are only present when a `+sub` was in the address. If `SubTagKnown: false`, note that in your handoff so Zoidberg can surface it to Dana.

Put these values into the Domain / SubTag fields of your handoff block. Do NOT re-derive them from the body — the address is the source of truth.
```

- [ ] **Step 2: Update the handoff template to include Domain/SubTag/Intent**

Find the existing handoff template (starts with `[FROM POSTIE 📬 — inbound email triage]`). Replace its header lines through `Confidence:` with:

```md
[FROM POSTIE 📬 — inbound email triage]
Domain: <school|sports|general|…>
SubTag: <sub or "none">        ← if SubTagKnown=false, write "<sub> (unknown — not in allowed list)"
Intent: <category>             ← the intent classification from the body (formerly "Classification")
Confidence: <high | medium | low>
```

Rename the remaining "Classification:" references in the file to "Intent:" for consistency. Keep every other field (`From:`, `Subject:`, `Summary:`, etc.) unchanged.

- [ ] **Step 3: Adjust the classification-instructions section**

Find the section explaining what "Classification" means (the current list: `personal`, `bill`, `invoice`, `receipt`, `calendar`, `account`, `marketing`, `newsletter`, `suspicious`, `other`). Rename the section and its references from "Classification" to "Intent." Add a one-line note at the top:

> Intent describes **what this email is about** (from the body). Domain describes **which mailbox it arrived at** (from the envelope, already pre-filled for you). They are independent — a tuition bill to `school@` is `Domain: school, Intent: bill`.

- [ ] **Step 4: Save the file; no build step**

- [ ] **Step 5: Commit (this edit is outside the claw-calendar repo — skip repo commit; memory only)**

The agent docs live in `~/.openclaw/agents/resend-inbox/workspace/AGENTS.md`, which is not in the claw-calendar repo. There is no separate repo for openclaw agent docs in this environment. The change is persisted on disk and will be read by Postie on the next turn.

---

## Task 12: Update Zoidberg's family-calendar skill with the hashtag composition table

**Files:**
- Modify: `/Users/dtiemann/.openclaw/workspace/skills/family-calendar/SKILL.md`

- [ ] **Step 1: Add the hashtag composition section**

After the existing `## Hashtag Metadata` section in the family-calendar SKILL.md, insert:

```md
### Composing hashtags from a Postie handoff

When Postie's handoff includes `Domain:` and optional `SubTag:` fields, convert them to hashtags deterministically before calling `cal-add.sh`:

| Domain  | SubTag  | Resulting hashtags                                  |
|---------|---------|-----------------------------------------------------|
| school  | james   | `#school #James`                                    |
| school  | none    | `#school`                                           |
| sports  | eleanor | `#sports #Eleanor`                                  |
| sports  | none    | `#sports`                                           |
| general | none    | (no domain tag; use content-derived person tags)    |
| <other> | <sub>   | `#<other>` plus, if sub is a known family name, `#<Sub>` title-cased; otherwise `#<sub-as-kebab-case>` |

Person SubTags are title-cased on the way into hashtags (`james` → `#James`). Free-form SubTags are lowercased kebab-case (`field-trip` → `#field-trip`). If Postie flagged `SubTag: <x> (unknown — not in allowed list)`, include the raw tag AND ask Dana to confirm the person's identity before saving — don't silently invent a new hashtag.
```

- [ ] **Step 2: Save; no build step**

- [ ] **Step 3: Smoke-verify by reading it back**

Run: `grep -A 3 "Composing hashtags" /Users/dtiemann/.openclaw/workspace/skills/family-calendar/SKILL.md | head -10`
Expected: the new section heading appears.

---

## Task 13: Integration smoke tests

These verify the full chain end-to-end without a real Resend webhook; they simulate what Postie would do.

**Files:** (no changes — these are manual checks)

- [ ] **Step 1: Bare school address**

Run: `unset OPENCLAW_CONFIG; claw-email domain 'school@tiemannfamily.us'`
Expected:
```
Domain: school
MatchedAddress: school@tiemannfamily.us
```

- [ ] **Step 2: Subaddress with known person**

Run: `claw-email domain 'school+james@tiemannfamily.us'`
Expected:
```
Domain: school
SubTag: james
SubTagKnown: true
MatchedAddress: school@tiemannfamily.us
```

- [ ] **Step 3: Subaddress with unknown person**

Run: `claw-email domain 'school+aunt-lisa@tiemannfamily.us'`
Expected:
```
Domain: school
SubTag: aunt-lisa
SubTagKnown: false
MatchedAddress: school@tiemannfamily.us
```

- [ ] **Step 4: Unconfigured address → fallback**

Run: `claw-email domain 'billing@tiemannfamily.us'`
Expected:
```
Domain: general
MatchedAddress: none
```

- [ ] **Step 5: Display-name wrapper**

Run: `claw-email domain 'Raleigh Oak <school+sean@tiemannfamily.us>'`
Expected:
```
Domain: school
SubTag: sean
SubTagKnown: true
MatchedAddress: school@tiemannfamily.us
```

- [ ] **Step 6: JSON flag**

Run: `claw-email domain 'sports+eleanor@tiemannfamily.us' --json`
Expected (one line):
```json
{"domainTag":"sports","subTag":"eleanor","subTagKnown":true,"matchedAddress":"sports@tiemannfamily.us"}
```

- [ ] **Step 7: Shim reachable from Postie's shell**

Run: `/Users/dtiemann/.openclaw/workspace/scripts/email-domain.sh 'school+james@tiemannfamily.us'`
Expected: same as Step 2.

- [ ] **Step 8: Verification complete — confirm the session store is fresh**

Run: `openclaw sessions --agent resend-inbox 2>&1 | tail -20`
Record the current state. On the next real inbound email, Postie should produce a handoff with the new Domain/SubTag/Intent shape.

---

## Task 14: Resend routing precondition (manual)

**Files:** (Resend dashboard; no code)

The code path above only matters if Resend actually forwards `school@`, `sports@`, and `general@` to our webhook. This is a one-time Resend configuration task that sits outside the code.

- [ ] **Step 1: Log in to Resend → Domains → `tiemannfamily.us` → Inbound**

- [ ] **Step 2: Confirm the existing webhook URL (Postie's entry point).**

Note the URL. It should match the current webhook Resend uses to drop emails into `/Users/dtiemann/.openclaw/workspace/webhooks/resend/emails/`.

- [ ] **Step 3: Ensure inbound routes exist for:**

- `school@tiemannfamily.us` → same webhook URL
- `sports@tiemannfamily.us` → same webhook URL
- `general@tiemannfamily.us` → same webhook URL

If subaddressing (plus-addressing) is a per-route toggle in Resend, enable it on each. If it's global, confirm it's on.

- [ ] **Step 4: Send one test email per address + one `+sub` variant per address**

Send from `tiemanndana@gmail.com` to each. Watch `gateway.log`:

```bash
tail -f /Users/dtiemann/.openclaw/logs/gateway.log | grep -i "resend\|postie"
```

For each test email, you should see the webhook fire and Postie wake up. Open Postie's handoff in the logs (or check Zoidberg's session jsonl) and confirm `Domain:` / `SubTag:` are populated correctly.

- [ ] **Step 5: If a route doesn't fire:** check Resend's delivery log for the missing address. Most likely cause is the route wasn't created (Step 3).

---

## Task 15: Final integration commit

**Files:**
- Modify: `packages/email-core/README.md`

- [ ] **Step 1: Append a "Status" section to the README**

```md
## Status

- V1 in use: `school`, `sports`, `general` routes.
- Config lives at `~/.openclaw/openclaw.json` → `emailDomains`.
- Parser is pure; CLI/shim are deterministic — Postie calls them once per turn.
- Per-domain confidence thresholds and per-domain allowlists are intentional deferrals (see design doc).
```

- [ ] **Step 2: Commit**

```bash
cd /Users/dtiemann/claw-calendar
git add packages/email-core/README.md
git commit -m "docs(email-core): note V1 status"
```

---

## Verification matrix

| # | Check | Command | Expected |
|---|-------|---------|----------|
| 1 | Unit tests pass | `cd packages/email-core && npx vitest run` | 13 passing |
| 2 | Build clean | `cd packages/email-core && npm run build` | exit 0 |
| 3 | CLI on PATH | `claw-email --help` | prints USAGE |
| 4 | Shim on disk | `ls -l ~/.openclaw/workspace/scripts/email-domain.sh` | +x |
| 5 | Real config loads | `claw-email domain 'school+james@tiemannfamily.us'` | Domain/SubTag populated |
| 6 | Gateway hot-reloaded | `grep reload ~/.openclaw/logs/gateway.log \| tail -3` | recent reload event |
| 7 | Postie sees shim | read `agents/resend-inbox/workspace/AGENTS.md` | envelope-parsing section present |
| 8 | Zoidberg sees hashtag table | read `workspace/skills/family-calendar/SKILL.md` | composition table present |
| 9 | End-to-end | send a real email to `school+james@tiemannfamily.us` | Zoidberg proposes `#school #James` on the resulting calendar item |

## Rollback

If anything goes sideways, rollback is two steps:

1. Restore `openclaw.json` from the `.bak-` file created in Task 10 Step 1. Gateway hot-reloads.
2. Revert the AGENTS.md + SKILL.md edits with `git diff`-style inspection or by pulling older copies from recent memory if no VCS on those paths.

The workspace package is additive — leaving it in place does nothing unless Postie calls the shim, so there's no urgency to remove it.
