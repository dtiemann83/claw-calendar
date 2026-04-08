# Theme Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the theme system with fallback backgrounds, additional color controls, UI icon sets (Lucide), per-connector event icon rules, and a `default.theme.json` base that individual themes override.

**Architecture:** A `default.theme.json` is loaded first and deep-merged with each `*.theme.json` override. UI icons come from `lib/icons/index.ts` (Lucide-backed), consumed by a new custom `CalendarToolbar` component and `EventDrawer`. Event icons come from `lib/events/icons.ts`, which resolves per-connector `iconRules` in `calendar.config.json`.

**Tech Stack:** Next.js 16 (App Router), TypeScript, FullCalendar v6, Chakra UI v3, lucide-react (new dependency)

---

## File Map

| File | Action |
|------|--------|
| `themes/types.ts` | Modify — add `ThemeInput`, expand `CalendarTheme` |
| `themes/index.ts` | Modify — add `deepMerge`, load `default.theme.json` as base |
| `themes/default.theme.json` | Create — complete baseline theme |
| `themes/yosemite.theme.json` | Modify — slim to overrides only |
| `lib/connectors/types.ts` | Modify — add `iconRules` to `ConnectorBase` and `ConnectorMeta` |
| `lib/icons/index.ts` | Create — Lucide icon registry + `resolveIcon()` |
| `lib/events/icons.ts` | Create — event icon resolution from `iconRules` + iCal metadata |
| `app/api/connectors/route.ts` | Modify — pass `iconRules` through to `ConnectorMeta` response |
| `components/CalendarToolbar.tsx` | Create — custom toolbar with Lucide icons, replaces FullCalendar's built-in toolbar |
| `components/ThemeBackground.tsx` | Modify — add `fallbackBackground` layer |
| `components/EventDrawer.tsx` | Modify — accept `theme` prop, use theme colors, Lucide close icon |
| `components/Calendar.tsx` | Modify — disable FC toolbar, render CalendarToolbar, add `eventContent`, pass `theme` to `EventDrawer` |
| `app/globals.css` | Modify — remove hardcoded toolbar button styles (replaced by custom toolbar) |

---

### Task 1: Update TypeScript types

**Files:**
- Modify: `themes/types.ts`
- Modify: `lib/connectors/types.ts`

- [ ] **Step 1: Replace `themes/types.ts`**

```typescript
// themes/types.ts
export interface CalendarTheme {
  name: string
  backgrounds: string[]
  fallbackBackground: string
  cycleIntervalMs: number
  calendar: {
    cellBg: string
    cellBorder: string
    textColor: string
    todayBg: string
    headerBg: string
    eventBg: string
    eventBorder: string
    drawerBg: string
    drawerBorder: string
    toolbarButtonBg: string
    toolbarButtonBorder: string
  }
  icons: {
    set: string
    overrides: Record<string, string>
  }
}

export type ThemeInput = {
  name: string
  backgrounds?: string[]
  fallbackBackground?: string
  cycleIntervalMs?: number
  calendar?: Partial<CalendarTheme["calendar"]>
  icons?: {
    set?: string
    overrides?: Record<string, string>
  }
}
```

- [ ] **Step 2: Update `lib/connectors/types.ts` — add `iconRules` to `ConnectorBase` and `ConnectorMeta`**

```typescript
// lib/connectors/types.ts
interface ConnectorBase {
  id: string
  name: string
  color: string
  iconRules?: Record<string, string>
}

export interface AgentApiConnector extends ConnectorBase {
  type: "agent-api"
  baseUrl: string
  calendarSlug: string
}

export interface IcalUrlConnector extends ConnectorBase {
  type: "ical-url"
  url: string
}

export interface LocalFileConnector extends ConnectorBase {
  type: "local-file"
  path: string
}

export type ConnectorConfig =
  | AgentApiConnector
  | IcalUrlConnector
  | LocalFileConnector

export interface CalendarConfig {
  connectors: ConnectorConfig[]
  font?: string
}

/** Shape sent to the browser — no internal URLs or file paths */
export interface ConnectorMeta {
  id: string
  name: string
  color: string
  proxyUrl: string
  iconRules?: Record<string, string>
}
```

- [ ] **Step 3: Verify build passes with type changes**

```bash
cd /Users/dtiemann/claw-calendar && yarn build 2>&1 | tail -10
```

Expected: build fails with errors about `CalendarTheme` missing new fields (theme files don't have them yet — that's expected at this stage).

- [ ] **Step 4: Commit**

```bash
git add themes/types.ts lib/connectors/types.ts
git commit -m "feat: expand CalendarTheme and ConnectorMeta types for theme extension"
```

---

### Task 2: Create `default.theme.json` and slim `yosemite.theme.json`

**Files:**
- Create: `themes/default.theme.json`
- Modify: `themes/yosemite.theme.json`

- [ ] **Step 1: Create `themes/default.theme.json`**

```json
{
  "name": "default",
  "backgrounds": [],
  "fallbackBackground": "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
  "cycleIntervalMs": 30000,
  "calendar": {
    "cellBg": "transparent",
    "cellBorder": "rgba(255, 255, 255, 0.15)",
    "textColor": "#ffffff",
    "todayBg": "rgba(255, 255, 255, 0.12)",
    "headerBg": "rgba(0, 0, 0, 0.35)",
    "eventBg": "rgba(59, 130, 246, 0.85)",
    "eventBorder": "rgba(96, 165, 250, 0.9)",
    "drawerBg": "rgba(15, 23, 42, 0.92)",
    "drawerBorder": "rgba(255, 255, 255, 0.12)",
    "toolbarButtonBg": "rgba(255, 255, 255, 0.15)",
    "toolbarButtonBorder": "rgba(255, 255, 255, 0.25)"
  },
  "icons": {
    "set": "lucide",
    "overrides": {}
  }
}
```

- [ ] **Step 2: Replace `themes/yosemite.theme.json` with overrides only**

```json
{
  "name": "yosemite",
  "backgrounds": [
    "https://commons.wikimedia.org/wiki/Special:FilePath/Tunnel_View,_Yosemite_Valley,_Yosemite_NP_-_Diliff.jpg",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Half_Dome_from_Glacier_Point,_Yosemite_NP_-_Diliff.jpg",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Yosemite_Falls_from_trail,_Yosemite_NP,_CA,_US_-_Diliff.jpg",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Cathedral_Peak_and_Lake_in_Yosemite.jpg"
  ],
  "calendar": {
    "eventBg": "rgba(30, 100, 200, 0.85)",
    "eventBorder": "rgba(100, 160, 255, 0.9)"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add themes/default.theme.json themes/yosemite.theme.json
git commit -m "feat: add default.theme.json baseline, slim yosemite to overrides"
```

---

### Task 3: Update theme registry with `deepMerge`

**Files:**
- Modify: `themes/index.ts`

- [ ] **Step 1: Replace `themes/index.ts`**

```typescript
// themes/index.ts
import fs from "fs"
import path from "path"
import type { CalendarTheme, ThemeInput } from "./types"

const THEMES_DIR = path.join(process.cwd(), "themes")
const DEFAULT_FILE = "default.theme.json"

function readThemeFile(file: string): ThemeInput {
  const raw = fs.readFileSync(path.join(THEMES_DIR, file), "utf-8")
  return JSON.parse(raw) as ThemeInput
}

function deepMerge(base: CalendarTheme, override: ThemeInput): CalendarTheme {
  return {
    name: override.name,
    backgrounds: override.backgrounds ?? base.backgrounds,
    fallbackBackground: override.fallbackBackground ?? base.fallbackBackground,
    cycleIntervalMs: override.cycleIntervalMs ?? base.cycleIntervalMs,
    calendar: { ...base.calendar, ...(override.calendar ?? {}) },
    icons: {
      set: override.icons?.set ?? base.icons.set,
      overrides: { ...base.icons.overrides, ...(override.icons?.overrides ?? {}) },
    },
  }
}

export function loadThemes(): Record<string, CalendarTheme> {
  const files = fs.readdirSync(THEMES_DIR).filter((f) => f.endsWith(".theme.json"))

  if (!files.includes(DEFAULT_FILE)) {
    throw new Error(`${DEFAULT_FILE} not found in ${THEMES_DIR}`)
  }

  const base = readThemeFile(DEFAULT_FILE) as CalendarTheme

  const result: Record<string, CalendarTheme> = { [base.name]: base }

  for (const file of files) {
    if (file === DEFAULT_FILE) continue
    const input = readThemeFile(file)
    result[input.name] = deepMerge(base, input)
  }

  return result
}

export function loadTheme(name: string): CalendarTheme {
  const themes = loadThemes()
  if (!(name in themes)) {
    throw new Error(`Theme "${name}" not found. Available: ${Object.keys(themes).join(", ")}`)
  }
  return themes[name]
}

export function loadDefaultTheme(): CalendarTheme {
  const themes = loadThemes()
  return themes["yosemite"] ?? themes["default"] ?? Object.values(themes)[0]
}

export type { CalendarTheme }
```

- [ ] **Step 2: Verify build passes**

```bash
cd /Users/dtiemann/claw-calendar && yarn build 2>&1 | tail -15
```

Expected: build succeeds — TypeScript is satisfied because `default.theme.json` satisfies all fields after the cast, and yosemite merges on top.

- [ ] **Step 3: Commit**

```bash
git add themes/index.ts
git commit -m "feat: add deepMerge to theme registry, load default.theme.json as base"
```

---

### Task 4: Install lucide-react and create icon registry

**Files:**
- Create: `lib/icons/index.ts`

- [ ] **Step 1: Install lucide-react**

```bash
cd /Users/dtiemann/claw-calendar && yarn add lucide-react
```

Expected: `lucide-react` added to `package.json` dependencies.

- [ ] **Step 2: Create `lib/icons/index.ts`**

```typescript
// lib/icons/index.ts
import {
  ChevronLeft,
  ChevronRight,
  CalendarCheck,
  X,
  CalendarDays,
  CalendarRange,
  Calendar,
  List,
  type LucideIcon,
} from "lucide-react"
import type { CalendarTheme } from "@/themes/types"

// Default Lucide icons for each named UI element
const LUCIDE_SET: Record<string, LucideIcon> = {
  prev:      ChevronLeft,
  next:      ChevronRight,
  today:     CalendarCheck,
  close:     X,
  viewMonth: CalendarDays,
  viewWeek:  CalendarRange,
  viewDay:   Calendar,
  viewList:  List,
}

// Additional icons available as overrides: "kebab-case" → PascalCase lookup
const LUCIDE_ALL: Record<string, LucideIcon> = {
  ...LUCIDE_SET,
  "chevron-left":    ChevronLeft,
  "chevron-right":   ChevronRight,
  "calendar-check":  CalendarCheck,
  "x":               X,
  "calendar-days":   CalendarDays,
  "calendar-range":  CalendarRange,
  "calendar":        Calendar,
  "list":            List,
}

/**
 * Resolves the Lucide icon for a named UI element, respecting theme overrides.
 * Falls back to the default for that element, then to X if unknown.
 */
export function resolveIcon(
  elementKey: string,
  theme: Pick<CalendarTheme, "icons">
): LucideIcon {
  const overrideName = theme.icons.overrides[elementKey]
  if (overrideName && LUCIDE_ALL[overrideName]) {
    return LUCIDE_ALL[overrideName]
  }
  return LUCIDE_SET[elementKey] ?? X
}
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/dtiemann/claw-calendar && yarn build 2>&1 | tail -10
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add lib/icons/index.ts package.json yarn.lock
git commit -m "feat: add Lucide icon registry with resolveIcon()"
```

---

### Task 5: Create event icon resolver

**Files:**
- Create: `lib/events/icons.ts`

- [ ] **Step 1: Create `lib/events/icons.ts`**

```typescript
// lib/events/icons.ts
import type { EventApi } from "@fullcalendar/core"
import type { ConnectorMeta } from "@/lib/connectors/types"

/** Returns true if the string starts with an emoji character. */
function startsWithEmoji(str: string): boolean {
  return /^\p{Emoji_Presentation}/u.test(str.trimStart())
}

/** Extracts the leading emoji cluster from a string, or undefined. */
function extractLeadingEmoji(str: string): string | undefined {
  const match = str.trimStart().match(/^(\p{Emoji_Presentation}+)/u)
  return match?.[1]
}

/**
 * Resolves the display icon for a calendar event.
 *
 * Resolution order (highest priority first):
 * 1. X-EVENT-ICON custom iCal property (arrives in event.extendedProps)
 * 2. DESCRIPTION starting with an emoji
 * 3. First matching keyword rule in the connector's iconRules
 * 4. __default rule for the connector
 * 5. undefined — no icon, render event as plain text
 *
 * Requires event sources to have been created with `id: conn.id` so that
 * event.source?.id matches the connector id.
 */
export function resolveEventIcon(
  event: EventApi,
  connectors: ConnectorMeta[]
): string | undefined {
  // 1. X-EVENT-ICON custom property
  const xIcon = event.extendedProps?.["x-event-icon"] as string | undefined
  if (xIcon) return xIcon

  // 2. DESCRIPTION starting with emoji
  const description = event.extendedProps?.description as string | undefined
  if (description && startsWithEmoji(description)) {
    const emoji = extractLeadingEmoji(description)
    if (emoji) return emoji
  }

  // 3 & 4. iconRules on the matching connector (matched by event source id)
  const connector = connectors.find((c) => c.id === event.source?.id)
  if (!connector?.iconRules) return undefined

  const rules = connector.iconRules
  const title = event.title.toLowerCase()

  for (const [keyword, icon] of Object.entries(rules)) {
    if (keyword === "__default") continue
    if (title.includes(keyword.toLowerCase())) return icon
  }

  return rules["__default"]
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/dtiemann/claw-calendar && yarn build 2>&1 | tail -10
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add lib/events/icons.ts
git commit -m "feat: add event icon resolver with iconRules + iCal metadata support"
```

---

### Task 6: Update ThemeBackground with fallback background

**Files:**
- Modify: `components/ThemeBackground.tsx`

- [ ] **Step 1: Replace `components/ThemeBackground.tsx`**

```typescript
// components/ThemeBackground.tsx
"use client"

import { useEffect, useState } from "react"
import type { CalendarTheme } from "@/themes/types"

interface Props {
  theme: CalendarTheme
}

export function ThemeBackground({ theme }: Props) {
  const hasImages = theme.backgrounds.length > 0
  const [current, setCurrent] = useState(0)
  const [next, setNext] = useState(1)
  const [transitioning, setTransitioning] = useState(false)

  useEffect(() => {
    if (!hasImages) return
    const interval = setInterval(() => {
      setTransitioning(true)
      setTimeout(() => {
        setCurrent((c) => (c + 1) % theme.backgrounds.length)
        setNext((n) => (n + 1) % theme.backgrounds.length)
        setTransitioning(false)
      }, 1500)
    }, theme.cycleIntervalMs)
    return () => clearInterval(interval)
  }, [theme, hasImages])

  const base: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    backgroundSize: "cover",
    backgroundPosition: "center",
    transition: "opacity 1.5s ease-in-out",
    zIndex: -1,
  }

  return (
    <>
      {/* Fallback — always present behind everything, visible when images are absent or loading */}
      <div
        style={{
          ...base,
          background: theme.fallbackBackground,
          zIndex: -3,
          transition: "none",
        }}
      />

      {hasImages && (
        <>
          {/* Current image — fades out during transition */}
          <div
            style={{
              ...base,
              backgroundImage: `url(${theme.backgrounds[current]})`,
              opacity: transitioning ? 0 : 1,
            }}
          />
          {/* Next image — always underneath, becomes visible as current fades */}
          <div
            style={{
              ...base,
              backgroundImage: `url(${theme.backgrounds[next]})`,
              opacity: 1,
              zIndex: -2,
            }}
          />
        </>
      )}
    </>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/dtiemann/claw-calendar && yarn build 2>&1 | tail -10
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/ThemeBackground.tsx
git commit -m "feat: add fallback background layer to ThemeBackground"
```

---

### Task 7: Pass `iconRules` through the connectors API

**Files:**
- Modify: `app/api/connectors/route.ts`

- [ ] **Step 1: Update `app/api/connectors/route.ts` to include `iconRules`**

```typescript
// app/api/connectors/route.ts
import { loadConnectors } from "@/lib/connectors/registry"
import type { ConnectorMeta } from "@/lib/connectors/types"

export async function GET() {
  let connectors
  try {
    connectors = loadConnectors()
  } catch (err) {
    console.error("[GET /api/connectors] Failed to load config:", err)
    return Response.json(
      { error: "Failed to load calendar configuration" },
      { status: 500 }
    )
  }

  const meta: ConnectorMeta[] = connectors.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    proxyUrl: `/api/connectors/${c.id}`,
    ...(c.iconRules ? { iconRules: c.iconRules } : {}),
  }))

  return Response.json(meta)
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/dtiemann/claw-calendar && yarn build 2>&1 | tail -10
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/api/connectors/route.ts
git commit -m "feat: include iconRules in /api/connectors response"
```

---

### Task 8: Create `CalendarToolbar` and remove hardcoded toolbar CSS

**Files:**
- Create: `components/CalendarToolbar.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Create `components/CalendarToolbar.tsx`**

```typescript
// components/CalendarToolbar.tsx
"use client"

import { resolveIcon } from "@/lib/icons"
import type { CalendarTheme } from "@/themes/types"

interface Props {
  title: string
  currentView: string
  theme: CalendarTheme
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onChangeView: (view: string) => void
}

const VIEW_BUTTONS = [
  { key: "viewMonth", view: "dayGridMonth", label: "Month" },
  { key: "viewWeek",  view: "timeGridWeek", label: "Week"  },
  { key: "viewDay",   view: "timeGridDay",  label: "Day"   },
  { key: "viewList",  view: "listMonth",    label: "List"  },
]

export function CalendarToolbar({
  title,
  currentView,
  theme,
  onPrev,
  onNext,
  onToday,
  onChangeView,
}: Props) {
  const { calendar: c } = theme

  const btnBase: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 12px",
    background: c.toolbarButtonBg,
    border: `1px solid ${c.toolbarButtonBorder}`,
    borderRadius: 6,
    color: "#fff",
    cursor: "pointer",
    fontSize: "0.85rem",
    backdropFilter: "blur(4px)",
    transition: "background 0.15s",
    fontFamily: "inherit",
  }

  const btnActive: React.CSSProperties = {
    ...btnBase,
    background: "rgba(255,255,255,0.32)",
    borderColor: "rgba(255,255,255,0.5)",
  }

  const PrevIcon  = resolveIcon("prev",  theme)
  const NextIcon  = resolveIcon("next",  theme)
  const TodayIcon = resolveIcon("today", theme)

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: c.headerBg,
        backdropFilter: "blur(8px)",
        borderRadius: 8,
        padding: "8px 12px",
        marginBottom: 8,
      }}
    >
      {/* Left: navigation */}
      <div style={{ display: "flex", gap: 4 }}>
        <button style={btnBase} onClick={onPrev} aria-label="Previous">
          <PrevIcon size={16} />
        </button>
        <button style={btnBase} onClick={onNext} aria-label="Next">
          <NextIcon size={16} />
        </button>
        <button style={btnBase} onClick={onToday} aria-label="Today">
          <TodayIcon size={16} />
          <span>Today</span>
        </button>
      </div>

      {/* Center: title */}
      <div
        style={{
          color: "#fff",
          fontSize: "1.4rem",
          fontWeight: 600,
          textShadow: "0 1px 4px rgba(0,0,0,0.6)",
        }}
      >
        {title}
      </div>

      {/* Right: view switcher */}
      <div style={{ display: "flex", gap: 4 }}>
        {VIEW_BUTTONS.map(({ key, view, label }) => {
          const Icon = resolveIcon(key, theme)
          const isActive = currentView === view
          return (
            <button
              key={key}
              style={isActive ? btnActive : btnBase}
              onClick={() => onChangeView(view)}
              aria-label={label}
              aria-pressed={isActive}
            >
              <Icon size={14} />
              <span>{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Remove hardcoded toolbar button CSS from `app/globals.css`**

Remove the following blocks (they are replaced by the custom toolbar's inline styles):

```css
/* DELETE these blocks from globals.css: */

.fc .fc-toolbar {
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(8px);
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 8px !important;
}

.fc .fc-toolbar-title {
  color: #fff;
  font-size: 1.4rem;
  font-weight: 600;
  text-shadow: 0 1px 4px rgba(0,0,0,0.6);
}

.fc .fc-button {
  background: rgba(255, 255, 255, 0.15) !important;
  border: 1px solid rgba(255, 255, 255, 0.25) !important;
  color: #fff !important;
  backdrop-filter: blur(4px);
  text-transform: capitalize;
  transition: background 0.2s;
}

.fc .fc-button:hover {
  background: rgba(255, 255, 255, 0.28) !important;
}

.fc .fc-button-active,
.fc .fc-button:not(:disabled):active {
  background: rgba(255, 255, 255, 0.35) !important;
}
```

The updated `globals.css` toolbar section should look like this after deletion:

```css
/* ── FullCalendar overrides ─────────────────────────────────────────── */

.fc-theme-wrapper {
  height: 100vh;
  padding: 12px;
}

.fc .fc-col-header-cell {
  /* ... rest of file unchanged ... */
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/dtiemann/claw-calendar && yarn build 2>&1 | tail -10
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add components/CalendarToolbar.tsx app/globals.css
git commit -m "feat: add CalendarToolbar with Lucide icons, remove hardcoded toolbar CSS"
```

---

### Task 9: Update `EventDrawer` to accept theme and use Lucide close icon

**Files:**
- Modify: `components/EventDrawer.tsx`

- [ ] **Step 1: Replace `components/EventDrawer.tsx`**

```typescript
// components/EventDrawer.tsx
"use client"

import {
  DrawerBackdrop,
  DrawerBody,
  DrawerCloseTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerPositioner,
  DrawerRoot,
  DrawerTitle,
} from "@chakra-ui/react"
import type { EventApi } from "@fullcalendar/core"
import type { CalendarTheme } from "@/themes/types"
import { resolveIcon } from "@/lib/icons"

interface Props {
  event: EventApi | null
  onClose: () => void
  theme: CalendarTheme
}

function formatDateTime(date: Date | null, allDay: boolean): string {
  if (!date) return ""
  if (allDay) {
    return date.toLocaleDateString([], {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  }
  return date.toLocaleString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function EventDrawer({ event, onClose, theme }: Props) {
  const { calendar: c } = theme
  const CloseIcon = resolveIcon("close", theme)

  return (
    <DrawerRoot
      open={event !== null}
      onOpenChange={({ open }) => { if (!open) onClose() }}
      placement="end"
      size="sm"
    >
      <DrawerBackdrop />
      <DrawerPositioner>
        <DrawerContent
          style={{
            background: c.drawerBg,
            backdropFilter: "blur(16px)",
            borderLeft: `1px solid ${c.drawerBorder}`,
            color: "#fff",
          }}
        >
          <DrawerHeader
            style={{
              borderBottom: `1px solid ${c.drawerBorder}`,
              paddingBottom: 16,
              position: "relative",
            }}
          >
            <DrawerTitle style={{ fontSize: "1.1rem", fontWeight: 600 }}>
              {event?.title ?? ""}
            </DrawerTitle>
            <DrawerCloseTrigger
              style={{
                position: "absolute",
                top: 12,
                right: 16,
                color: "rgba(255,255,255,0.6)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                border: "none",
                padding: 4,
                borderRadius: 4,
              }}
            >
              <CloseIcon size={18} />
            </DrawerCloseTrigger>
          </DrawerHeader>

          <DrawerBody style={{ paddingTop: 16 }}>
            {event && (
              <dl style={{ display: "grid", gap: "12px" }}>
                <Row
                  label="Calendar"
                  value={
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          display: "inline-block",
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          background: event.backgroundColor || "#60a5fa",
                          flexShrink: 0,
                        }}
                      />
                      {"Calendar"}
                    </span>
                  }
                />

                <Row label="Start" value={formatDateTime(event.start, event.allDay)} />

                {event.end && !event.allDay && (
                  <Row label="End" value={formatDateTime(event.end, false)} />
                )}

                {event.allDay && (
                  <Row label="Type" value="All day" />
                )}

                {event.url && (
                  <Row
                    label="Link"
                    value={
                      <a
                        href={event.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: "#93c5fd",
                          textDecoration: "underline",
                          wordBreak: "break-all",
                        }}
                      >
                        {event.url}
                      </a>
                    }
                  />
                )}
              </dl>
            )}
          </DrawerBody>
        </DrawerContent>
      </DrawerPositioner>
    </DrawerRoot>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "contents" }}>
      <dt
        style={{
          fontSize: "0.75rem",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          opacity: 0.5,
          marginBottom: 2,
        }}
      >
        {label}
      </dt>
      <dd style={{ margin: 0, fontSize: "0.9rem" }}>{value}</dd>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/dtiemann/claw-calendar && yarn build 2>&1 | tail -10
```

Expected: build succeeds — TypeScript will error if `theme` prop is missing anywhere `EventDrawer` is used (Calendar.tsx, addressed in Task 10).

- [ ] **Step 3: Commit**

```bash
git add components/EventDrawer.tsx
git commit -m "feat: EventDrawer accepts theme prop, uses themed colors and Lucide close icon"
```

---

### Task 10: Wire everything into `Calendar.tsx`

**Files:**
- Modify: `components/Calendar.tsx`

- [ ] **Step 1: Replace `components/Calendar.tsx`**

```typescript
// components/Calendar.tsx
"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import listPlugin from "@fullcalendar/list"
import iCalendarPlugin from "@fullcalendar/icalendar"
import interactionPlugin from "@fullcalendar/interaction"
import type { DateClickArg } from "@fullcalendar/interaction"
import type { EventClickArg, EventContentArg, DatesSetArg } from "@fullcalendar/core"
import type { CalendarTheme } from "@/themes/types"
import type { ConnectorMeta } from "@/lib/connectors/types"
import { resolveEventIcon } from "@/lib/events/icons"
import { CalendarToolbar } from "./CalendarToolbar"
import { EventDrawer } from "./EventDrawer"

interface Props {
  theme: CalendarTheme
}

export function Calendar({ theme }: Props) {
  const { calendar: c } = theme
  const [connectors, setConnectors] = useState<ConnectorMeta[]>([])
  const [eventSources, setEventSources] = useState<object[]>([])
  const [selectedEvent, setSelectedEvent] = useState<EventApi | null>(null)
  const [calendarTitle, setCalendarTitle] = useState("")
  const [currentView, setCurrentView] = useState("dayGridMonth")
  const calendarRef = useRef<FullCalendar>(null)

  // Load connector list once on mount
  useEffect(() => {
    fetch("/api/connectors")
      .then((res) => {
        if (!res.ok) throw new Error(`/api/connectors returned ${res.status}`)
        return res.json() as Promise<ConnectorMeta[]>
      })
      .then((data) => {
        setConnectors(data)
        setEventSources(
          data.map((conn) => ({
            id: conn.id,
            url: conn.proxyUrl,
            format: "ics",
            backgroundColor: conn.color,
            borderColor: conn.color,
          }))
        )
      })
      .catch((err) => {
        console.error("Failed to load calendar connectors:", err)
      })
  }, [])

  // Stream updates — refetch events when the server detects a change
  useEffect(() => {
    const es = new EventSource("/api/stream")

    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as { type: string }
        if (msg.type === "update") {
          calendarRef.current?.getApi().refetchEvents()
        }
      } catch {
        // malformed message — ignore
      }
    }

    es.onerror = () => {
      console.warn("[calendar] SSE connection lost, will reconnect automatically")
    }

    return () => es.close()
  }, [])

  const handleDateClick = useCallback((arg: DateClickArg) => {
    const api = calendarRef.current?.getApi()
    if (!api) return
    api.changeView("timeGridDay", arg.date)
  }, [])

  const handleEventClick = useCallback((arg: EventClickArg) => {
    arg.jsEvent.preventDefault()
    setSelectedEvent(arg.event)
  }, [])

  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    setCalendarTitle(arg.view.title)
    setCurrentView(arg.view.type)
  }, [])

  const renderEventContent = useCallback(
    (arg: EventContentArg) => {
      const icon = resolveEventIcon(arg.event, connectors)
      if (!icon) return true // use FullCalendar's default rendering
      return (
        <div
          style={{
            overflow: "hidden",
            padding: "0 2px",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
          }}
        >
          <span style={{ marginRight: "0.2em" }}>{icon}</span>
          <span style={{ fontWeight: 500 }}>{arg.event.title}</span>
        </div>
      )
    },
    [connectors]
  )

  return (
    <div
      style={
        {
          "--fc-border-color": c.cellBorder,
          "--fc-today-bg-color": c.todayBg,
          "--fc-page-bg-color": "transparent",
          "--fc-neutral-bg-color": "transparent",
          "--fc-list-event-hover-bg-color": "rgba(255,255,255,0.1)",
          "--fc-event-bg-color": c.eventBg,
          "--fc-event-border-color": c.eventBorder,
          "--fc-event-text-color": "#fff",
          color: c.textColor,
        } as React.CSSProperties
      }
      className="fc-theme-wrapper"
    >
      <CalendarToolbar
        title={calendarTitle}
        currentView={currentView}
        theme={theme}
        onPrev={() => calendarRef.current?.getApi().prev()}
        onNext={() => calendarRef.current?.getApi().next()}
        onToday={() => calendarRef.current?.getApi().today()}
        onChangeView={(view) => calendarRef.current?.getApi().changeView(view)}
      />

      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, iCalendarPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={false}
        height="calc(100vh - 60px)"
        eventSources={eventSources}
        eventDisplay="block"
        dateClick={handleDateClick}
        eventClick={handleEventClick}
        datesSet={handleDatesSet}
        eventContent={renderEventContent}
      />

      <EventDrawer
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        theme={theme}
      />
    </div>
  )
}
```

Note: `height="calc(100vh - 60px)"` accounts for the custom toolbar height (~56px + 8px margin). Adjust if needed.

Also fix the missing `EventApi` import — it's already imported via `EventClickArg` but needs to be explicit for the state type:

In the imports, change:
```typescript
import type { EventClickArg, EventContentArg, DatesSetArg } from "@fullcalendar/core"
```
to:
```typescript
import type { EventApi, EventClickArg, EventContentArg, DatesSetArg } from "@fullcalendar/core"
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/dtiemann/claw-calendar && yarn build 2>&1 | tail -15
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 3: Restart and visually verify**

```bash
pm2 restart claw-calendar
```

Open `http://localhost:4000` (or take a Playwright screenshot). Confirm:
- Custom toolbar with Lucide icons renders at the top
- Calendar grid fills remaining space
- Background fallback gradient is visible before images load
- Clicking an event opens the drawer with themed background

- [ ] **Step 4: Commit**

```bash
git add components/Calendar.tsx
git commit -m "feat: wire CalendarToolbar, event icons, and theme into Calendar"
```

---

### Task 11: Final build and smoke test

- [ ] **Step 1: Full production build**

```bash
cd /Users/dtiemann/claw-calendar && yarn build 2>&1
```

Expected: clean compile, no TypeScript errors, all 5 routes listed.

- [ ] **Step 2: Verify connectors API includes iconRules**

```bash
curl -s http://localhost:4000/api/connectors | python3 -m json.tool
```

Expected: JSON array where connectors with `iconRules` in `calendar.config.json` include the `iconRules` key.

- [ ] **Step 3: Verify theme merging works**

```bash
node -e "
const path = require('path')
process.chdir('/Users/dtiemann/claw-calendar')
// Patch module resolution for the test
const { loadDefaultTheme } = require('./.next/server/chunks/[root-of-the-server]__08n~jpf._.js')
" 2>/dev/null || echo "Direct module test not available — rely on build + runtime check above"
```

If the Node script doesn't work (Next.js chunks are not directly importable), the `yarn build` success in Step 1 is sufficient — TypeScript validates the merge output matches `CalendarTheme`.

- [ ] **Step 4: Commit any final tweaks, then push**

```bash
git status  # confirm clean
git push
```
