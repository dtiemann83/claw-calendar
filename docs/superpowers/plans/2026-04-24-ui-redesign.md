# UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the settings modal and disconnected voice page with a pill tab toggle (Calendar ↔ Settings), a full Settings tab with left-rail navigation, and a persistent animated floating mic button in the bottom-right corner.

**Architecture:** `CalendarApp` gains a `tab` state and renders either the existing calendar UI or a new `SettingsLayout`. A `TabPill` (fixed, top-right) switches between them. A `FloatingVoiceButton` (fixed, bottom-right) is always rendered—tapping it or triggering the wake word expands it to screen-center with a backdrop and conversation card. `SettingsModal` and the `/voice` page are removed.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind v4, Chakra UI (existing), Lucide React icons, Vitest (node env for API tests), Drizzle ORM + better-sqlite3

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `app/api/profiles/[id]/route.ts` | Add PATCH handler |
| Create | `app/api/settings/voice/route.ts` | GET/PATCH voice settings |
| Create | `app/api/settings/voice/route.test.ts` | Tests for voice settings API |
| Create | `components/TabPill.tsx` | Two-segment pill toggle |
| Create | `components/settings/SettingsLayout.tsx` | Left-rail + content shell |
| Create | `components/settings/ProfilesSection.tsx` | Profile list + CRUD |
| Create | `components/settings/AppearanceSection.tsx` | Theme/font/overrides/rotation |
| Create | `components/settings/CalendarSection.tsx` | Tags + connector toggles + idle reset |
| Create | `components/settings/VoiceSection.tsx` | Voice provider form |
| Create | `components/voice/FloatingVoiceButton.tsx` | Animated mic + overlay + conversation |
| Modify | `components/CalendarToolbar.tsx` | Remove `onOpenSettings` prop + button |
| Modify | `components/Calendar.tsx` | Remove `onOpenSettings` prop |
| Modify | `components/CalendarApp.tsx` | Replace SettingsModal with tab system |
| Delete | `components/SettingsModal.tsx` | Removed |
| Delete | `app/voice/page.tsx` | Removed |

---

## Task 1: PATCH /api/profiles/[id]

**Files:**
- Modify: `app/api/profiles/[id]/route.ts`
- Modify: `app/api/profiles/[id]/route.test.ts`

- [ ] **Step 1: Write failing test**

Add to `app/api/profiles/[id]/route.test.ts` (the file already has GET/DELETE tests; add these at the bottom inside the existing test file structure with its `beforeEach`/`afterEach` setup):

```typescript
describe("PATCH /api/profiles/[id]", () => {
  it("updates name and color", async () => {
    const { POST } = await import("../route");
    const createReq = new Request("http://localhost/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Bob", color: "#ef4444" }),
    });
    const { id } = await (await POST(createReq as any)).json();

    const { PATCH } = await import("./route");
    const req = new Request(`http://localhost/api/profiles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Bobby", color: "#3b82f6" }),
    });
    const res = await PATCH(req as any, { params: Promise.resolve({ id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Bobby");
    expect(body.color).toBe("#3b82f6");
  });

  it("returns 404 for unknown id", async () => {
    const { PATCH } = await import("./route");
    const req = new Request("http://localhost/api/profiles/nope", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Ghost" }),
    });
    const res = await PATCH(req as any, { params: Promise.resolve({ id: "nope" }) });
    expect(res.status).toBe(404);
  });

  it("returns 400 when body has nothing to update", async () => {
    const { PATCH } = await import("./route");
    const req = new Request("http://localhost/api/profiles/any", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await PATCH(req as any, { params: Promise.resolve({ id: "any" }) });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd /Users/dtiemann/claw-calendar && npx vitest run "app/api/profiles/\[id\]/route.test.ts" --no-color 2>&1 | tail -20
```

Expected: FAIL — `PATCH is not a function`

- [ ] **Step 3: Add PATCH handler**

In `app/api/profiles/[id]/route.ts`, after the `DELETE` export, add:

```typescript
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const patch: Partial<{ name: string; color: string }> = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.color === "string") patch.color = body.color;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }
  const db = getDb();
  const updated = db.update(profiles).set(patch).where(eq(profiles.id, id)).returning().all();
  if (!updated.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated[0]);
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/dtiemann/claw-calendar && npx vitest run "app/api/profiles/\[id\]/route.test.ts" --no-color 2>&1 | tail -10
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
cd /Users/dtiemann/claw-calendar && git add "app/api/profiles/[id]/route.ts" "app/api/profiles/[id]/route.test.ts" && git commit -m "feat: add PATCH /api/profiles/[id] for inline name/color editing"
```

---

## Task 2: GET/PATCH /api/settings/voice

**Files:**
- Create: `app/api/settings/voice/route.ts`
- Create: `app/api/settings/voice/route.test.ts`

- [ ] **Step 1: Write failing test**

Create `app/api/settings/voice/route.test.ts`:

```typescript
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
    // other fields have their own defaults
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
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd /Users/dtiemann/claw-calendar && npx vitest run "app/api/settings/voice/route.test.ts" --no-color 2>&1 | tail -10
```

Expected: FAIL — module not found

- [ ] **Step 3: Create the route**

Create `app/api/settings/voice/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

const DEFAULT_SETTINGS_PATH = path.join(
  os.homedir(),
  ".config",
  "claw-calendar",
  "voice-settings.json"
);

function getSettingsPath(): string {
  return process.env.VOICE_SETTINGS_PATH ?? DEFAULT_SETTINGS_PATH;
}

interface VoiceSettings {
  sttProvider: string;
  ttsProvider: string;
  wakeWordProvider: string;
  wakeWordModel: string;
  wakeWordThreshold: number;
  speakerIdProvider: string;
  speakerIdThreshold: number;
}

function readEnvDefaults(): VoiceSettings {
  return {
    sttProvider: process.env.STT_PROVIDER ?? "faster_whisper_local",
    ttsProvider: process.env.TTS_PROVIDER ?? "apple_say",
    wakeWordProvider: process.env.WAKE_WORD_PROVIDER ?? "open_wake_word",
    wakeWordModel: process.env.WAKE_WORD_MODEL ?? "hey_jarvis_v0.1",
    wakeWordThreshold: parseFloat(process.env.WAKE_WORD_THRESHOLD ?? "0.5"),
    speakerIdProvider: process.env.SPEAKER_ID_PROVIDER ?? "resemblyzer",
    speakerIdThreshold: parseFloat(process.env.SPEAKER_ID_THRESHOLD ?? "0.75"),
  };
}

function readFileOverrides(): Partial<VoiceSettings> {
  const p = getSettingsPath();
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return {};
  }
}

function getSettings(): VoiceSettings {
  return { ...readEnvDefaults(), ...readFileOverrides() };
}

export async function GET() {
  return NextResponse.json(getSettings());
}

export async function PATCH(req: NextRequest) {
  const patch = await req.json() as Partial<VoiceSettings>;
  const existing = readFileOverrides();
  const merged = { ...existing, ...patch };

  const p = getSettingsPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(merged, null, 2));

  return NextResponse.json(getSettings());
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/dtiemann/claw-calendar && npx vitest run "app/api/settings/voice/route.test.ts" --no-color 2>&1 | tail -10
```

Expected: all 3 tests pass

- [ ] **Step 5: Commit**

```bash
cd /Users/dtiemann/claw-calendar && git add app/api/settings/voice/ && git commit -m "feat: add GET/PATCH /api/settings/voice with file persistence"
```

---

## Task 3: TabPill component + CalendarToolbar cleanup

**Files:**
- Create: `components/TabPill.tsx`
- Modify: `components/CalendarToolbar.tsx`
- Modify: `components/Calendar.tsx`

No automated test — verify visually in browser after Task 9 wires everything.

- [ ] **Step 1: Create TabPill**

Create `components/TabPill.tsx`:

```typescript
"use client"

import { CalendarDays, Settings } from "lucide-react"

export type Tab = "calendar" | "settings"

interface Props {
  tab: Tab
  onChange: (tab: Tab) => void
}

export function TabPill({ tab, onChange }: Props) {
  return (
    <div
      style={{
        position: "fixed",
        top: 12,
        right: 12,
        zIndex: 50,
        display: "flex",
        background: "rgba(0,0,0,0.35)",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: 20,
        padding: 3,
        gap: 2,
      }}
    >
      {(["calendar", "settings"] as Tab[]).map((t) => {
        const isActive = tab === t
        const Icon = t === "calendar" ? CalendarDays : Settings
        const label = t === "calendar" ? "Calendar" : "Settings"
        return (
          <button
            key={t}
            onClick={() => onChange(t)}
            style={{
              background: isActive ? "rgba(255,255,255,0.2)" : "transparent",
              border: "none",
              borderRadius: 16,
              color: isActive ? "#fff" : "rgba(255,255,255,0.45)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 10px",
              fontSize: "0.8rem",
              fontFamily: "inherit",
              transition: "background 0.15s, color 0.15s",
            }}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Remove settings button from CalendarToolbar**

In `components/CalendarToolbar.tsx`:

1. Remove `onOpenSettings` from the `Props` interface (delete the line `onOpenSettings: () => void`)
2. Remove `onOpenSettings` from the destructured parameters
3. Remove the `SettingsIcon` line: `const SettingsIcon = resolveIcon("settings", theme)`
4. Remove the settings button from the JSX — the entire `<button style={btnBase} onClick={onOpenSettings} aria-label="Settings">` block
5. The "Left" div still keeps the Today button; remove the now-empty `<div style={{ display: "flex", gap: 4 }}>` wrapper if it becomes a single-item div, OR just remove only the settings button and keep Today there.

The left section should end up as just:
```typescript
{/* Left: today */}
<div style={{ display: "flex", gap: 4 }}>
  <button style={btnBase} onClick={onToday} aria-label="Today">
    <TodayIcon size={16} />
    <span>Today</span>
  </button>
</div>
```

- [ ] **Step 3: Remove onOpenSettings from Calendar.tsx**

In `components/Calendar.tsx`:

1. Remove `onOpenSettings?: () => void` from the `Props` interface
2. Remove `onOpenSettings` from the destructured props in the function signature
3. Remove `onOpenSettings={onOpenSettings ?? (() => {})}` from the `<CalendarToolbar>` JSX

- [ ] **Step 4: Commit**

```bash
cd /Users/dtiemann/claw-calendar && git add components/TabPill.tsx components/CalendarToolbar.tsx components/Calendar.tsx && git commit -m "feat: add TabPill, remove settings button from CalendarToolbar"
```

---

## Task 4: SettingsLayout shell

**Files:**
- Create: `components/settings/SettingsLayout.tsx`

No test — verify visually in browser after Task 9.

- [ ] **Step 1: Create SettingsLayout**

Create `components/settings/SettingsLayout.tsx`:

```typescript
"use client"

import { useState } from "react"
import { Users, Mic, CalendarDays, Palette } from "lucide-react"
import type { CalendarTheme, ThemeOverrides } from "@/themes/types"
import type { TagConfig } from "@/lib/events/tags"
import type { ConnectorMeta } from "@/lib/connectors/types"
import { ProfilesSection } from "./ProfilesSection"
import { VoiceSection } from "./VoiceSection"
import { CalendarSection } from "./CalendarSection"
import { AppearanceSection } from "./AppearanceSection"

type Section = "profiles" | "voice" | "calendar" | "appearance"

const SECTIONS: { id: Section; label: string; Icon: React.FC<{ size?: number }> }[] = [
  { id: "profiles",   label: "Profiles",   Icon: Users },
  { id: "voice",      label: "Voice",      Icon: Mic },
  { id: "calendar",   label: "Calendar",   Icon: CalendarDays },
  { id: "appearance", label: "Appearance", Icon: Palette },
]

export interface SettingsLayoutProps {
  theme: CalendarTheme
  themes: Record<string, CalendarTheme>
  currentThemeName: string
  onThemeChange: (name: string) => void
  themeOverrides: ThemeOverrides
  onOverrideChange: (patch: ThemeOverrides) => void
  onResetOverrides: () => void
  cycleIntervalMs: number
  onCycleIntervalChange: (ms: number) => void
  idleResetMs: number
  onIdleResetChange: (ms: number) => void
  tagConfigs: TagConfig[]
  onTagConfigsChange: (configs: TagConfig[]) => void
  connectors: ConnectorMeta[]
  hiddenConnectorIds: Set<string>
  onToggleConnector: (id: string) => void
}

export function SettingsLayout({
  theme,
  themes,
  currentThemeName,
  onThemeChange,
  themeOverrides,
  onOverrideChange,
  onResetOverrides,
  cycleIntervalMs,
  onCycleIntervalChange,
  idleResetMs,
  onIdleResetChange,
  tagConfigs,
  onTagConfigsChange,
  connectors,
  hiddenConnectorIds,
  onToggleConnector,
}: SettingsLayoutProps) {
  const [section, setSection] = useState<Section>("profiles")

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", paddingTop: 48 }}>
      {/* Left rail */}
      <div
        style={{
          width: 220,
          flexShrink: 0,
          background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(12px)",
          borderRight: "1px solid rgba(255,255,255,0.08)",
          padding: "16px 0",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {SECTIONS.map(({ id, label, Icon }) => {
          const isActive = section === id
          return (
            <button
              key={id}
              onClick={() => setSection(id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 16px",
                background: isActive ? "rgba(255,255,255,0.1)" : "transparent",
                border: "none",
                borderLeft: `3px solid ${isActive ? "rgba(255,255,255,0.6)" : "transparent"}`,
                color: isActive ? "#fff" : "rgba(255,255,255,0.45)",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "0.88rem",
                textAlign: "left",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              <Icon size={15} />
              {label}
            </button>
          )
        })}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 36px", color: "#fff" }}>
        {section === "profiles" && <ProfilesSection />}
        {section === "voice" && <VoiceSection />}
        {section === "calendar" && (
          <CalendarSection
            tagConfigs={tagConfigs}
            onTagConfigsChange={onTagConfigsChange}
            connectors={connectors}
            hiddenConnectorIds={hiddenConnectorIds}
            onToggleConnector={onToggleConnector}
            idleResetMs={idleResetMs}
            onIdleResetChange={onIdleResetChange}
          />
        )}
        {section === "appearance" && (
          <AppearanceSection
            theme={theme}
            themes={themes}
            currentThemeName={currentThemeName}
            onThemeChange={onThemeChange}
            themeOverrides={themeOverrides}
            onOverrideChange={onOverrideChange}
            onResetOverrides={onResetOverrides}
            cycleIntervalMs={cycleIntervalMs}
            onCycleIntervalChange={onCycleIntervalChange}
          />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/dtiemann/claw-calendar && git add components/settings/SettingsLayout.tsx && git commit -m "feat: add SettingsLayout shell with left rail"
```

---

## Task 5: AppearanceSection

**Files:**
- Create: `components/settings/AppearanceSection.tsx`

- [ ] **Step 1: Create AppearanceSection**

This component moves the "Theme" and "Photo Rotation" content out of `SettingsModal`. Copy the theme grid, `CollapsibleThemeSettings`, and photo rotation slider from `SettingsModal` into this component.

Create `components/settings/AppearanceSection.tsx`:

```typescript
"use client"

import type { CalendarTheme, ThemeOverrides } from "@/themes/types"
import { CollapsibleThemeSettings } from "@/components/CollapsibleThemeSettings"

const CYCLE_PRESETS = [
  { ms:       60_000, label:  "1m" },
  { ms:      300_000, label:  "5m" },
  { ms:      900_000, label: "15m" },
  { ms:    1_800_000, label: "30m" },
  { ms:    3_600_000, label:  "1h" },
  { ms:   10_800_000, label:  "3h" },
  { ms:   21_600_000, label:  "6h" },
  { ms:   43_200_000, label: "12h" },
  { ms:   86_400_000, label: "24h" },
]

interface Props {
  theme: CalendarTheme
  themes: Record<string, CalendarTheme>
  currentThemeName: string
  onThemeChange: (name: string) => void
  themeOverrides: ThemeOverrides
  onOverrideChange: (patch: ThemeOverrides) => void
  onResetOverrides: () => void
  cycleIntervalMs: number
  onCycleIntervalChange: (ms: number) => void
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.4, marginBottom: 12 }}>
      {children}
    </div>
  )
}

export function AppearanceSection({
  theme, themes, currentThemeName, onThemeChange,
  themeOverrides, onOverrideChange, onResetOverrides,
  cycleIntervalMs, onCycleIntervalChange,
}: Props) {
  const { calendar: c } = theme
  const activeIdx = CYCLE_PRESETS.findIndex((p) => p.ms === cycleIntervalMs)
  const idx = activeIdx === -1 ? 4 : activeIdx

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <div>
        <SectionLabel>Theme</SectionLabel>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
            gap: 8,
          }}
        >
          {Object.entries(themes).map(([name, t]) => {
            const isActive = name === currentThemeName
            return (
              <button
                key={name}
                onClick={() => onThemeChange(name)}
                style={{
                  border: `2px solid ${isActive ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.12)"}`,
                  borderRadius: 8,
                  overflow: "hidden",
                  cursor: "pointer",
                  padding: 0,
                  background: "none",
                  textAlign: "left",
                  transition: "border-color 0.15s",
                }}
              >
                <div
                  style={{
                    height: 52,
                    background: t.fallbackBackground,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
                <div
                  style={{
                    padding: "5px 8px",
                    background: isActive ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.45)",
                    color: "#fff",
                    fontSize: "0.78rem",
                    fontWeight: isActive ? 600 : 400,
                    textTransform: "capitalize",
                    fontFamily: "inherit",
                  }}
                >
                  {name.replace(/-/g, " ")}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <CollapsibleThemeSettings
        theme={theme}
        overrides={themeOverrides}
        onOverrideChange={onOverrideChange}
        onReset={onResetOverrides}
        drawerBorder={c.drawerBorder}
      />

      {theme.backgrounds.length > 0 && (
        <div>
          <SectionLabel>Photo Rotation</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              type="range"
              min={0}
              max={CYCLE_PRESETS.length - 1}
              step={1}
              value={idx}
              onChange={(e) => onCycleIntervalChange(CYCLE_PRESETS[parseInt(e.target.value, 10)].ms)}
              className="claw-range"
              style={{ width: "100%" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              {CYCLE_PRESETS.map((p, i) => (
                <span
                  key={p.ms}
                  onClick={() => onCycleIntervalChange(p.ms)}
                  style={{
                    fontSize: "0.65rem",
                    letterSpacing: "0.02em",
                    color: "#fff",
                    opacity: i === idx ? 1 : 0.3,
                    fontWeight: i === idx ? 700 : 400,
                    cursor: "pointer",
                    userSelect: "none",
                    transition: "opacity 0.15s",
                  }}
                >
                  {p.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/dtiemann/claw-calendar && git add components/settings/AppearanceSection.tsx && git commit -m "feat: add AppearanceSection (theme/photo rotation)"
```

---

## Task 6: CalendarSection

**Files:**
- Create: `components/settings/CalendarSection.tsx`

- [ ] **Step 1: Create CalendarSection**

This moves "Calendars", "Tags", and "Behavior" (idle reset) from `SettingsModal` into one section.

Create `components/settings/CalendarSection.tsx`:

```typescript
"use client"

import { TagSettingsForm } from "@/components/TagSettingsForm"
import type { TagConfig } from "@/lib/events/tags"
import type { ConnectorMeta } from "@/lib/connectors/types"
import { SwitchRoot, SwitchHiddenInput, SwitchControl, SwitchThumb } from "@chakra-ui/react"

const IDLE_PRESETS = [
  { ms:       5_000, label:   "5s" },
  { ms:      10_000, label:  "10s" },
  { ms:      30_000, label:  "30s" },
  { ms:      60_000, label:   "1m" },
  { ms:     300_000, label:   "5m" },
  { ms:     600_000, label:  "10m" },
  { ms:     900_000, label:  "15m" },
  { ms:   1_800_000, label:  "30m" },
  { ms:   3_600_000, label:   "1h" },
]

interface Props {
  tagConfigs: TagConfig[]
  onTagConfigsChange: (configs: TagConfig[]) => void
  connectors: ConnectorMeta[]
  hiddenConnectorIds: Set<string>
  onToggleConnector: (id: string) => void
  idleResetMs: number
  onIdleResetChange: (ms: number) => void
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.4, marginBottom: 12 }}>
      {children}
    </div>
  )
}

export function CalendarSection({
  tagConfigs, onTagConfigsChange, connectors, hiddenConnectorIds, onToggleConnector,
  idleResetMs, onIdleResetChange,
}: Props) {
  const enabled = idleResetMs > 0
  const activeIdx = IDLE_PRESETS.findIndex((p) => p.ms === idleResetMs)
  const idx = activeIdx === -1 ? 3 : activeIdx

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {/* Calendars */}
      <div>
        <SectionLabel>Calendars</SectionLabel>
        {connectors.length === 0 ? (
          <p style={{ margin: 0, opacity: 0.45, fontSize: "0.88rem" }}>No calendars connected.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {connectors.map((conn) => {
              const hidden = hiddenConnectorIds.has(conn.id)
              return (
                <div
                  key={conn.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "9px 12px",
                    background: "rgba(255,255,255,0.06)",
                    borderRadius: 6,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        width: 10, height: 10, borderRadius: "50%",
                        background: conn.color, flexShrink: 0,
                        opacity: hidden ? 0.25 : 1,
                      }}
                    />
                    <span style={{ fontSize: "0.9rem", opacity: hidden ? 0.4 : 1, transition: "opacity 0.15s" }}>
                      {conn.name}
                    </span>
                  </div>
                  <button
                    onClick={() => onToggleConnector(conn.id)}
                    style={{
                      background: hidden ? "rgba(255,255,255,0.08)" : conn.color,
                      border: `1px solid ${hidden ? "rgba(255,255,255,0.18)" : conn.color}`,
                      borderRadius: 12,
                      padding: "3px 12px",
                      color: "#fff",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      transition: "background 0.15s",
                    }}
                  >
                    {hidden ? "Show" : "Hide"}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Tags */}
      <div>
        <SectionLabel>Event Tags</SectionLabel>
        <TagSettingsForm tagConfigs={tagConfigs} onTagConfigsChange={onTagConfigsChange} />
      </div>

      {/* Idle reset */}
      <div>
        <SectionLabel>Idle View Reset</SectionLabel>
        <p style={{ margin: "0 0 14px", fontSize: "0.82rem", opacity: 0.55, lineHeight: 1.5 }}>
          Return to Month view after a period of inactivity.
        </p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: enabled ? 20 : 0 }}>
          <span style={{ fontSize: "0.88rem", opacity: 0.85 }}>Enable</span>
          <SwitchRoot
            checked={enabled}
            onCheckedChange={(e) => onIdleResetChange(e.checked ? IDLE_PRESETS[3].ms : 0)}
            colorPalette="blue"
            size="md"
          >
            <SwitchHiddenInput />
            <SwitchControl><SwitchThumb /></SwitchControl>
          </SwitchRoot>
        </div>
        {enabled && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              type="range"
              min={0}
              max={IDLE_PRESETS.length - 1}
              step={1}
              value={idx}
              onChange={(e) => onIdleResetChange(IDLE_PRESETS[parseInt(e.target.value, 10)].ms)}
              className="claw-range"
              style={{ width: "100%" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              {IDLE_PRESETS.map((p, i) => (
                <span
                  key={p.ms}
                  onClick={() => onIdleResetChange(p.ms)}
                  style={{
                    fontSize: "0.65rem",
                    letterSpacing: "0.02em",
                    color: "#fff",
                    opacity: i === idx ? 1 : 0.3,
                    fontWeight: i === idx ? 700 : 400,
                    cursor: "pointer",
                    userSelect: "none",
                    transition: "opacity 0.15s",
                  }}
                >
                  {p.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/dtiemann/claw-calendar && git add components/settings/CalendarSection.tsx && git commit -m "feat: add CalendarSection (connectors, tags, idle reset)"
```

---

## Task 7: VoiceSection

**Files:**
- Create: `components/settings/VoiceSection.tsx`

- [ ] **Step 1: Create VoiceSection**

Create `components/settings/VoiceSection.tsx`:

```typescript
"use client"

import { useState, useEffect } from "react"

interface VoiceSettings {
  sttProvider: string
  ttsProvider: string
  wakeWordProvider: string
  wakeWordModel: string
  wakeWordThreshold: number
  speakerIdProvider: string
  speakerIdThreshold: number
}

const STT_OPTIONS = ["faster_whisper_local", "openai_whisper_api", "stub"]
const TTS_OPTIONS = ["apple_say", "piper", "stub"]
const WAKE_OPTIONS = ["open_wake_word", "stub"]
const SPEAKER_OPTIONS = ["resemblyzer", "stub"]

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.4, marginBottom: 12 }}>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      <span style={{ fontSize: "0.88rem", opacity: 0.85 }}>{label}</span>
      {children}
    </div>
  )
}

function Select({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: "rgba(255,255,255,0.1)",
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: 6,
        color: "#fff",
        fontFamily: "inherit",
        fontSize: "0.85rem",
        padding: "4px 8px",
        cursor: "pointer",
      }}
    >
      {options.map((o) => <option key={o} value={o} style={{ background: "#1a1a2e" }}>{o}</option>)}
    </select>
  )
}

export function VoiceSection() {
  const [settings, setSettings] = useState<VoiceSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch("/api/settings/voice").then(r => r.json()).then(setSettings).catch(() => {})
  }, [])

  const update = (patch: Partial<VoiceSettings>) => {
    setSettings(prev => prev ? { ...prev, ...patch } : null)
    setSaved(false)
  }

  const save = async () => {
    if (!settings) return
    setSaving(true)
    try {
      await fetch("/api/settings/voice", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  if (!settings) return <p style={{ opacity: 0.45, fontSize: "0.88rem" }}>Loading…</p>

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ marginBottom: 28 }}>
        <SectionLabel>Speech Recognition</SectionLabel>
        <Row label="Provider">
          <Select value={settings.sttProvider} options={STT_OPTIONS} onChange={(v) => update({ sttProvider: v })} />
        </Row>
      </div>

      <div style={{ marginBottom: 28 }}>
        <SectionLabel>Text to Speech</SectionLabel>
        <Row label="Provider">
          <Select value={settings.ttsProvider} options={TTS_OPTIONS} onChange={(v) => update({ ttsProvider: v })} />
        </Row>
      </div>

      <div style={{ marginBottom: 28 }}>
        <SectionLabel>Wake Word</SectionLabel>
        <Row label="Provider">
          <Select value={settings.wakeWordProvider} options={WAKE_OPTIONS} onChange={(v) => update({ wakeWordProvider: v })} />
        </Row>
        <Row label="Model">
          <input
            value={settings.wakeWordModel}
            onChange={(e) => update({ wakeWordModel: e.target.value })}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 6,
              color: "#fff",
              fontFamily: "inherit",
              fontSize: "0.85rem",
              padding: "4px 8px",
              width: 180,
            }}
          />
        </Row>
        <Row label={`Threshold  (${settings.wakeWordThreshold.toFixed(2)})`}>
          <input
            type="range" min={0} max={1} step={0.05}
            value={settings.wakeWordThreshold}
            onChange={(e) => update({ wakeWordThreshold: parseFloat(e.target.value) })}
            className="claw-range"
            style={{ width: 160 }}
          />
        </Row>
      </div>

      <div style={{ marginBottom: 28 }}>
        <SectionLabel>Speaker Identification</SectionLabel>
        <Row label="Provider">
          <Select value={settings.speakerIdProvider} options={SPEAKER_OPTIONS} onChange={(v) => update({ speakerIdProvider: v })} />
        </Row>
        <Row label={`Threshold  (${settings.speakerIdThreshold.toFixed(2)})`}>
          <input
            type="range" min={0} max={1} step={0.05}
            value={settings.speakerIdThreshold}
            onChange={(e) => update({ speakerIdThreshold: parseFloat(e.target.value) })}
            className="claw-range"
            style={{ width: 160 }}
          />
        </Row>
      </div>

      <button
        onClick={save}
        disabled={saving}
        style={{
          background: "rgba(59,130,246,0.7)",
          border: "1px solid rgba(59,130,246,0.5)",
          borderRadius: 8,
          color: "#fff",
          cursor: saving ? "default" : "pointer",
          fontFamily: "inherit",
          fontSize: "0.88rem",
          padding: "8px 20px",
          transition: "background 0.15s",
        }}
      >
        {saving ? "Saving…" : "Save"}
      </button>

      {saved && (
        <div style={{
          marginTop: 14,
          padding: "8px 14px",
          background: "rgba(234,179,8,0.15)",
          border: "1px solid rgba(234,179,8,0.3)",
          borderRadius: 6,
          fontSize: "0.82rem",
          color: "rgba(253,224,71,0.9)",
        }}>
          Settings saved. Restart the audio server for provider changes to take effect.
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/dtiemann/claw-calendar && git add components/settings/VoiceSection.tsx && git commit -m "feat: add VoiceSection with GET/PATCH /api/settings/voice"
```

---

## Task 8: ProfilesSection

**Files:**
- Create: `components/settings/ProfilesSection.tsx`

- [ ] **Step 1: Create ProfilesSection**

Create `components/settings/ProfilesSection.tsx`:

```typescript
"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Trash2, Check, X, Plus } from "lucide-react"

interface Profile {
  id: string
  name: string
  color: string
  createdAt: number
}

const COLOR_OPTIONS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316",
]

export function ProfilesSection() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editColor, setEditColor] = useState("")
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const router = useRouter()

  const load = useCallback(() => {
    fetch("/api/profiles").then(r => r.json()).then(setProfiles).catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])

  const startEdit = (p: Profile) => {
    setEditingId(p.id)
    setEditName(p.name)
    setEditColor(p.color)
    setConfirmDeleteId(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const saveEdit = async (id: string) => {
    await fetch(`/api/profiles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, color: editColor }),
    })
    setEditingId(null)
    load()
  }

  const deleteProfile = async (id: string) => {
    await fetch(`/api/profiles/${id}`, { method: "DELETE" })
    setConfirmDeleteId(null)
    load()
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Family Members</h2>
        <button
          onClick={() => router.push("/profiles/new")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(59,130,246,0.6)",
            border: "1px solid rgba(59,130,246,0.4)",
            borderRadius: 8,
            color: "#fff",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: "0.82rem",
            padding: "6px 14px",
          }}
        >
          <Plus size={14} />
          Add member
        </button>
      </div>

      {profiles.length === 0 && (
        <p style={{ opacity: 0.45, fontSize: "0.88rem" }}>No profiles yet. Add a family member to get started.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {profiles.map((p) => {
          const isEditing = editingId === p.id
          const isConfirmingDelete = confirmDeleteId === p.id

          return (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
              }}
            >
              {/* Color dot / picker */}
              {isEditing ? (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", width: 56 }}>
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setEditColor(c)}
                      style={{
                        width: 16, height: 16,
                        borderRadius: "50%",
                        background: c,
                        border: editColor === c ? "2px solid #fff" : "2px solid transparent",
                        cursor: "pointer",
                        padding: 0,
                        flexShrink: 0,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <span
                  style={{
                    width: 12, height: 12,
                    borderRadius: "50%",
                    background: p.color,
                    flexShrink: 0,
                  }}
                />
              )}

              {/* Name */}
              {isEditing ? (
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{
                    flex: 1,
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    borderRadius: 6,
                    color: "#fff",
                    fontFamily: "inherit",
                    fontSize: "0.9rem",
                    padding: "4px 8px",
                  }}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") saveEdit(p.id); if (e.key === "Escape") cancelEdit() }}
                />
              ) : (
                <span style={{ flex: 1, fontSize: "0.9rem" }}>{p.name}</span>
              )}

              {/* Actions */}
              {isConfirmingDelete ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: "0.78rem", opacity: 0.7 }}>Delete?</span>
                  <button onClick={() => deleteProfile(p.id)} style={iconBtnStyle("#ef4444")} aria-label="Confirm delete">
                    <Check size={14} />
                  </button>
                  <button onClick={() => setConfirmDeleteId(null)} style={iconBtnStyle()} aria-label="Cancel delete">
                    <X size={14} />
                  </button>
                </div>
              ) : isEditing ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => saveEdit(p.id)} style={iconBtnStyle("#22c55e")} aria-label="Save">
                    <Check size={14} />
                  </button>
                  <button onClick={cancelEdit} style={iconBtnStyle()} aria-label="Cancel">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => startEdit(p)} style={iconBtnStyle()} aria-label="Edit">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => setConfirmDeleteId(p.id)} style={iconBtnStyle()} aria-label="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function iconBtnStyle(color?: string): React.CSSProperties {
  return {
    background: color ? `${color}33` : "rgba(255,255,255,0.07)",
    border: `1px solid ${color ? `${color}55` : "rgba(255,255,255,0.12)"}`,
    borderRadius: 6,
    color: color ?? "rgba(255,255,255,0.7)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 5,
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/dtiemann/claw-calendar && git add components/settings/ProfilesSection.tsx && git commit -m "feat: add ProfilesSection with inline edit and delete"
```

---

## Task 9: Wire CalendarApp

**Files:**
- Modify: `components/CalendarApp.tsx`

- [ ] **Step 1: Update CalendarApp**

Replace the contents of `components/CalendarApp.tsx` with the following. The key changes are: add `tab` state, remove `settingsOpen`/SettingsModal, add TabPill, add conditional settings rendering, add FloatingVoiceButton. All existing theme/connector/tag state and handlers are preserved unchanged.

```typescript
"use client"

import { useState, useEffect, useMemo } from "react"
import dynamic from "next/dynamic"
import type { CalendarTheme } from "@/themes/types"
import type { AllThemeOverrides, ThemeOverrides } from "@/themes/types"
import type { ConnectorMeta } from "@/lib/connectors/types"
import type { TagConfig } from "@/lib/events/tags"
import { ThemeBackground } from "./ThemeBackground"
import { TabPill } from "./TabPill"
import type { Tab } from "./TabPill"
import { SettingsLayout } from "./settings/SettingsLayout"
import { FloatingVoiceButton } from "./voice/FloatingVoiceButton"
import { loadAllOverrides, saveAllOverrides, mergeThemeOverrides } from "@/lib/themeOverrides"
import { fonts } from "@/lib/fonts"
import type { FontId } from "@/lib/fonts"

const Calendar = dynamic(
  () => import("@/components/Calendar").then((m) => m.Calendar),
  { ssr: false, loading: () => null }
)

const DEFAULT_THEME = "yosemite"
const LS_THEME_KEY = "claw:theme"
const LS_CYCLE_KEY = "claw:cycleInterval"
const LS_IDLE_KEY  = "claw:idleReset"
const LS_TAGS_KEY = "claw:tagConfigs"

interface Props {
  themes: Record<string, CalendarTheme>
  configuredFont?: string
}

export function CalendarApp({ themes, configuredFont }: Props) {
  const themeNames = Object.keys(themes)
  const [tab, setTab] = useState<Tab>("calendar")
  const [themeName, setThemeName] = useState(DEFAULT_THEME)
  const [connectors, setConnectors] = useState<ConnectorMeta[]>([])
  const [hiddenConnectorIds, setHiddenConnectorIds] = useState<Set<string>>(new Set())
  const [cycleIntervalMs, setCycleIntervalMs] = useState<number>(3_600_000)
  const [idleResetMs, setIdleResetMs] = useState<number>(0)
  const [allOverrides, setAllOverrides] = useState<AllThemeOverrides>({})
  const [tagConfigs, setTagConfigs] = useState<TagConfig[]>([])

  useEffect(() => {
    const savedTheme = localStorage.getItem(LS_THEME_KEY)
    if (savedTheme && themes[savedTheme]) setThemeName(savedTheme)

    const savedCycle = localStorage.getItem(LS_CYCLE_KEY)
    if (savedCycle) {
      setCycleIntervalMs(parseInt(savedCycle, 10))
    } else {
      const t = savedTheme && themes[savedTheme] ? themes[savedTheme] : themes[DEFAULT_THEME] ?? Object.values(themes)[0]
      setCycleIntervalMs(t.cycleIntervalMs)
    }

    const savedIdle = localStorage.getItem(LS_IDLE_KEY)
    if (savedIdle) setIdleResetMs(parseInt(savedIdle, 10))

    setAllOverrides(loadAllOverrides())

    const savedTags = localStorage.getItem(LS_TAGS_KEY)
    if (savedTags) {
      try { setTagConfigs(JSON.parse(savedTags)) } catch { /* ignore corrupt data */ }
    }
  }, [themes])

  const baseTheme = themes[themeName] ?? themes[themeNames[0]]

  const theme = useMemo(() => {
    const withCycle = { ...baseTheme, cycleIntervalMs }
    return mergeThemeOverrides(withCycle, allOverrides[themeName] ?? {})
  }, [baseTheme, cycleIntervalMs, allOverrides, themeName])

  useEffect(() => {
    if (theme.font && theme.font in fonts) {
      document.documentElement.style.setProperty("--font-family", fonts[theme.font as FontId].family)
    } else if (configuredFont && configuredFont in fonts) {
      document.documentElement.style.setProperty("--font-family", fonts[configuredFont as FontId].family)
    }
  }, [theme.font, configuredFont])

  const handleThemeChange = (name: string) => {
    setThemeName(name)
    localStorage.setItem(LS_THEME_KEY, name)
    const newTheme = themes[name]
    if (newTheme) {
      setCycleIntervalMs(newTheme.cycleIntervalMs)
      localStorage.removeItem(LS_CYCLE_KEY)
    }
  }

  const handleCycleIntervalChange = (ms: number) => {
    setCycleIntervalMs(ms)
    localStorage.setItem(LS_CYCLE_KEY, String(ms))
  }

  const handleIdleResetChange = (ms: number) => {
    setIdleResetMs(ms)
    if (ms === 0) localStorage.removeItem(LS_IDLE_KEY)
    else localStorage.setItem(LS_IDLE_KEY, String(ms))
  }

  const handleOverrideChange = (patch: ThemeOverrides) => {
    setAllOverrides((prev) => {
      const current = prev[themeName] ?? {}
      return {
        ...prev,
        [themeName]: {
          ...current,
          ...patch,
          calendar: patch.calendar
            ? { ...(current.calendar ?? {}), ...patch.calendar }
            : current.calendar,
        },
      }
    })
  }

  const handleResetOverrides = () => {
    setAllOverrides((prev) => {
      const next = { ...prev }
      delete next[themeName]
      return next
    })
  }

  useEffect(() => { saveAllOverrides(allOverrides) }, [allOverrides])
  useEffect(() => { localStorage.setItem(LS_TAGS_KEY, JSON.stringify(tagConfigs)) }, [tagConfigs])

  const handleToggleConnector = (id: string) => {
    setHiddenConnectorIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <main style={{ position: "relative", height: "100vh", overflow: "hidden" }}>
      <ThemeBackground theme={theme} />
      <TabPill tab={tab} onChange={setTab} />

      {/* Calendar is always mounted (hidden on settings tab) so connectors load regardless of active tab */}
      <div style={{ display: tab === "calendar" ? "block" : "none" }}>
        <Calendar
          theme={theme}
          hiddenConnectorIds={hiddenConnectorIds}
          onConnectorsLoaded={setConnectors}
          idleResetMs={idleResetMs}
          tagConfigs={tagConfigs}
          onTagConfigsChange={setTagConfigs}
        />
      </div>

      {tab === "settings" && (
        <SettingsLayout
          theme={theme}
          themes={themes}
          currentThemeName={themeName}
          onThemeChange={handleThemeChange}
          themeOverrides={allOverrides[themeName] ?? {}}
          onOverrideChange={handleOverrideChange}
          onResetOverrides={handleResetOverrides}
          cycleIntervalMs={cycleIntervalMs}
          onCycleIntervalChange={handleCycleIntervalChange}
          idleResetMs={idleResetMs}
          onIdleResetChange={handleIdleResetChange}
          tagConfigs={tagConfigs}
          onTagConfigsChange={setTagConfigs}
          connectors={connectors}
          hiddenConnectorIds={hiddenConnectorIds}
          onToggleConnector={handleToggleConnector}
        />
      )}

      <FloatingVoiceButton />
    </main>
  )
}
```

- [ ] **Step 2: Run all tests to confirm nothing broke**

```bash
cd /Users/dtiemann/claw-calendar && npx vitest run --no-color 2>&1 | tail -15
```

Expected: all existing tests still pass (CalendarApp has no direct tests; API tests should be unaffected)

- [ ] **Step 3: Commit**

```bash
cd /Users/dtiemann/claw-calendar && git add components/CalendarApp.tsx && git commit -m "feat: replace SettingsModal with tab system in CalendarApp"
```

---

## Task 10: FloatingVoiceButton

**Files:**
- Create: `components/voice/FloatingVoiceButton.tsx`

- [ ] **Step 1: Add fadeIn keyframe to globals.css**

In `app/globals.css`, add before the last closing block (or at the end):

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
```

- [ ] **Step 2: Create FloatingVoiceButton**

This component contains all the voice logic from `VoiceSession` plus the floating/animation behavior. The button lives at `position: fixed; right: 24px; bottom: 24px`. When expanded, it uses a CSS `transform` to animate to the screen center.

Create `components/voice/FloatingVoiceButton.tsx`:

```typescript
"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Mic, MicOff, Volume2, Loader2, X } from "lucide-react"
import { useAudioServerWS } from "@/hooks/useAudioServerWS"
import { useWakeWordStream } from "@/hooks/useWakeWordStream"

type VoiceState = "idle" | "listening" | "thinking" | "speaking" | "error"
type Message = { role: "user" | "assistant"; text: string; speakerName?: string }

export function FloatingVoiceButton() {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle")
  const [expanded, setExpanded] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<{ id: string; name: string }[]>([])
  const [correctionIdx, setCorrectionIdx] = useState<number | null>(null)
  const [wakeDetected, setWakeDetected] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const sessionId = useRef(crypto.randomUUID())

  const { lastEvent, wsState, sendAudioChunk } = useAudioServerWS()
  const streamingEnabled = wsState === "open" && voiceState === "idle"
  useWakeWordStream(streamingEnabled, sendAudioChunk)

  useEffect(() => {
    fetch("/api/profiles").then(r => r.json()).then(setProfiles).catch(() => {})
  }, [])

  const startRecording = useCallback(async () => {
    setErrorMsg(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        await processAudio(new Blob(chunksRef.current, { type: "audio/webm" }))
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setVoiceState("listening")
    } catch {
      setErrorMsg("Microphone access denied")
      setVoiceState("error")
    }
  }, [])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
  }, [])

  const dismiss = useCallback(() => {
    if (voiceState === "listening") {
      mediaRecorderRef.current?.stop()
      mediaRecorderRef.current = null
    }
    setExpanded(false)
    setVoiceState("idle")
    setErrorMsg(null)
  }, [voiceState])

  useEffect(() => {
    if (lastEvent?.type === "wake" && voiceState === "idle") {
      setWakeDetected(true)
      setTimeout(() => {
        setWakeDetected(false)
        setExpanded(true)
        startRecording()
      }, 500)
    }
  }, [lastEvent, voiceState, startRecording])

  const processAudio = async (blob: Blob) => {
    setVoiceState("thinking")
    try {
      const formData = new FormData()
      formData.append("file", blob, "audio.webm")
      const transcribeRes = await fetch("/api/voice/transcribe", { method: "POST", body: formData })
      if (!transcribeRes.ok) throw new Error("Transcription failed")
      const { transcript, speaker } = await transcribeRes.json()
      if (!transcript?.trim()) { setVoiceState("idle"); return }

      let speakerName: string | undefined
      if (speaker?.user_id) {
        try {
          const r = await fetch(`/api/profiles/${speaker.user_id}`)
          if (r.ok) speakerName = (await r.json()).name
        } catch {}
      }
      setMessages(prev => [...prev, { role: "user", text: transcript, speakerName }])

      const agentRes = await fetch("/api/agent/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: transcript, sessionId: sessionId.current }),
      })
      if (!agentRes.ok) throw new Error("Agent error")
      const agentData = await agentRes.json()
      const replyText: string = agentData.text ?? agentData.reply ?? agentData.content ?? JSON.stringify(agentData)
      setMessages(prev => [...prev, { role: "assistant", text: replyText }])

      setVoiceState("speaking")
      const speakRes = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: replyText }),
      })
      if (speakRes.ok) {
        const audioUrl = URL.createObjectURL(await speakRes.blob())
        const audio = new Audio(audioUrl)
        audio.onended = () => { URL.revokeObjectURL(audioUrl); setVoiceState("idle") }
        audio.onerror = () => { URL.revokeObjectURL(audioUrl); setVoiceState("idle") }
        try { await audio.play() } catch { setVoiceState("idle") }
      } else {
        setVoiceState("idle")
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong")
      setVoiceState("error")
    }
  }

  const isRecording = voiceState === "listening"
  const isBusy = voiceState === "thinking" || voiceState === "speaking"

  const stateLabel: Record<VoiceState, string> = {
    idle: "Tap to speak",
    listening: "Listening…",
    thinking: "Thinking…",
    speaking: "Speaking…",
    error: "Error",
  }

  // The button is always positioned at bottom-right.
  // When expanded, a CSS transform animates it to screen center.
  // 52px button: center is at (right: 24 + 26 = 50px from right edge, 50px from bottom)
  // To reach screen center: translate(-50vw + 50px, -50vh + 50px)
  const btnTransform = expanded
    ? `translate(calc(-50vw + 50px), calc(-50vh + 50px)) scale(${72 / 52})`
    : "translate(0, 0) scale(1)"

  return (
    <>
      {/* Backdrop */}
      {expanded && (
        <div
          onClick={dismiss}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(6px)",
            zIndex: 200,
            animation: "fadeIn 0.25s ease",
          }}
        />
      )}

      {/* Conversation card */}
      {expanded && (messages.length > 0 || errorMsg) && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            top: "14%",
            transform: "translateX(-50%)",
            width: "min(500px, 88vw)",
            maxHeight: "42vh",
            overflowY: "auto",
            background: "rgba(15,15,25,0.88)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 16,
            padding: "16px 18px",
            zIndex: 202,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {errorMsg && (
            <p style={{ margin: 0, color: "#f87171", fontSize: "0.85rem" }}>{errorMsg}</p>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "84%",
                background: msg.role === "user" ? "rgba(59,130,246,0.28)" : "rgba(255,255,255,0.07)",
                borderRadius: 10,
                padding: "8px 12px",
                color: "#fff",
                fontSize: "0.9rem",
                lineHeight: 1.45,
              }}
            >
              {msg.role === "user" && (
                <div style={{ fontSize: "0.72rem", opacity: 0.55, marginBottom: 4, position: "relative" }}>
                  {msg.speakerName ?? "You"}
                  {" · "}
                  <button
                    onClick={() => setCorrectionIdx(correctionIdx === i ? null : i)}
                    style={{ background: "none", border: "none", color: "inherit", textDecoration: "underline", cursor: "pointer", fontFamily: "inherit", fontSize: "inherit" }}
                  >
                    Not you?
                  </button>
                  {correctionIdx === i && (
                    <div style={{
                      position: "absolute",
                      top: "100%",
                      right: 0,
                      background: "rgba(15,15,25,0.97)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: 8,
                      padding: 8,
                      zIndex: 210,
                      minWidth: 140,
                      marginTop: 4,
                    }}>
                      {profiles.map(p => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setMessages(prev => prev.map((m, j) => j === i ? { ...m, speakerName: p.name } : m))
                            setCorrectionIdx(null)
                          }}
                          style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", color: "#fff", cursor: "pointer", padding: "6px 8px", borderRadius: 4, fontSize: "0.85rem", fontFamily: "inherit" }}
                        >
                          {p.name}
                        </button>
                      ))}
                      <button
                        onClick={() => setCorrectionIdx(null)}
                        style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", padding: "6px 8px", borderRadius: 4, fontSize: "0.85rem", fontFamily: "inherit" }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
              {msg.role === "assistant" && (
                <Volume2 size={11} style={{ opacity: 0.45, marginRight: 5, display: "inline", verticalAlign: "middle" }} />
              )}
              {msg.text}
            </div>
          ))}
        </div>
      )}

      {/* State label */}
      {expanded && (
        <div
          style={{
            position: "fixed",
            bottom: "calc(24px + 52px + 16px)",
            right: 0,
            left: 0,
            textAlign: "center",
            color: "rgba(255,255,255,0.65)",
            fontSize: "0.82rem",
            zIndex: 203,
            pointerEvents: "none",
          }}
        >
          {wakeDetected
            ? <span style={{ color: "#4ade80" }}>Wake word detected!</span>
            : stateLabel[voiceState]}
          {wsState !== "open" && voiceState === "idle" && (
            <span style={{ marginLeft: 10, color: wsState === "connecting" ? "#93c5fd" : "#f87171", fontSize: "0.75rem" }}>
              {wsState === "connecting" ? "● Connecting…" : "● Wake word offline"}
            </span>
          )}
        </div>
      )}

      {/* Dismiss X */}
      {expanded && !isRecording && !isBusy && (
        <button
          onClick={dismiss}
          aria-label="Close"
          style={{
            position: "fixed",
            top: 56,
            right: 16,
            zIndex: 204,
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: "50%",
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "#fff",
          }}
        >
          <X size={15} />
        </button>
      )}

      {/* Mic button — always at bottom-right, animates to center when expanded */}
      <button
        onPointerDown={() => {
          if (isBusy) return
          if (!expanded) setExpanded(true)
          startRecording()
        }}
        onPointerUp={() => { if (isRecording) stopRecording() }}
        onPointerLeave={() => { if (isRecording) stopRecording() }}
        aria-label={stateLabel[voiceState]}
        style={{
          position: "fixed",
          right: 24,
          bottom: 24,
          width: 52,
          height: 52,
          borderRadius: "50%",
          border: "none",
          cursor: isBusy ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 201,
          transform: btnTransform,
          transition: "transform 0.4s cubic-bezier(0.34,1.56,0.64,1), background 0.25s, box-shadow 0.25s",
          background: isRecording
            ? "rgba(239,68,68,0.9)"
            : expanded
              ? "rgba(59,130,246,0.85)"
              : "rgba(255,255,255,0.12)",
          backdropFilter: "blur(8px)",
          boxShadow: expanded
            ? "0 0 40px rgba(59,130,246,0.35), 0 4px 20px rgba(0,0,0,0.5)"
            : "0 2px 14px rgba(0,0,0,0.45)",
        }}
      >
        {isBusy
          ? <Loader2 size={22} style={{ color: "#fff", animation: "spin 1s linear infinite" }} />
          : isRecording
            ? <MicOff size={22} style={{ color: "#fff" }} />
            : <Mic size={22} style={{ color: expanded ? "#fff" : "rgba(255,255,255,0.65)" }} />
        }
      </button>
    </>
  )
}
```

- [ ] **Step 3: Add spin keyframe to globals.css if not present**

Check `app/globals.css` for a `@keyframes spin` block. If absent, add:

```css
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
```

- [ ] **Step 4: Run all tests**

```bash
cd /Users/dtiemann/claw-calendar && npx vitest run --no-color 2>&1 | tail -15
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
cd /Users/dtiemann/claw-calendar && git add components/voice/FloatingVoiceButton.tsx app/globals.css && git commit -m "feat: add FloatingVoiceButton with center-screen animation"
```

---

## Task 11: Cleanup

**Files:**
- Delete: `components/SettingsModal.tsx`
- Delete: `app/voice/page.tsx`

- [ ] **Step 1: Delete SettingsModal**

```bash
rm /Users/dtiemann/claw-calendar/components/SettingsModal.tsx
```

- [ ] **Step 2: Delete voice page**

```bash
rm /Users/dtiemann/claw-calendar/app/voice/page.tsx
```

If the `/app/voice/` directory is now empty, remove it too:

```bash
rmdir /Users/dtiemann/claw-calendar/app/voice 2>/dev/null || true
```

- [ ] **Step 3: Run all tests to confirm nothing broke**

```bash
cd /Users/dtiemann/claw-calendar && npx vitest run --no-color 2>&1 | tail -15
```

Expected: all tests pass (no test files imported SettingsModal or the voice page)

- [ ] **Step 4: Build to confirm no TypeScript errors**

```bash
cd /Users/dtiemann/claw-calendar && npm run build 2>&1 | tail -20
```

Expected: successful build with no type errors

- [ ] **Step 5: Commit**

```bash
cd /Users/dtiemann/claw-calendar && git add -A && git commit -m "chore: remove SettingsModal and /voice page (replaced by tab system + FloatingVoiceButton)"
```

---

## Verification

After Task 11, verify these behaviors in the browser at `http://localhost:4000`:

1. **TabPill visible** — top-right corner, glassy, shows Calendar and Settings segments
2. **Calendar tab** — full-screen calendar renders normally, no settings gear
3. **Settings tab** — left rail with Profiles / Voice / Calendar / Appearance sections
4. **Profiles section** — lists profiles, Add button goes to `/profiles/new`, inline edit and delete work
5. **Appearance section** — theme grid, overrides, photo rotation slider all functional
6. **Calendar section** — connector toggles, tag settings, idle reset
7. **Voice section** — shows current providers, save writes to file, banner appears
8. **Floating mic button** — visible bottom-right on both tabs, glassy, small
9. **Mic button expand** — tap → button animates to center, backdrop fades in, recording starts
10. **Conversation card** — appears above button with transcript + response
11. **Dismiss** — tapping backdrop or X collapses button back to corner
12. **Wake word** — if audio server is running, wake word detection auto-triggers expansion
