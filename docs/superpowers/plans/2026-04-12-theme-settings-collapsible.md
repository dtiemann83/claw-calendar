# Theme Settings Collapsible Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Chakra `Collapsible` "Theme Settings" section to the Theme tab with font, overlay, and calendar color overrides — each persisted per-theme in localStorage — plus a live calendar cell preview.

**Architecture:** `CalendarApp` owns `allOverrides` state (keyed by theme name), persists to `claw:themeOverrides` in localStorage, and deep-merges overrides into the active theme before passing it down. `SettingsModal` gains a new `CollapsibleThemeSettings` sub-component that renders a two-column layout (form left, preview right) inside a Chakra `CollapsibleRoot`.

**Tech Stack:** React, Chakra UI v3 (`CollapsibleRoot/Trigger/Content`, `NativeSelectRoot/Field`, `SliderRoot/Control/Track/Range/Thumb`, `ColorPickerRoot` + floating content), `parseColor` from `@chakra-ui/react` (re-exported from ark-ui), TypeScript, localStorage.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `themes/types.ts` | Modify | Add `font?: string` to `CalendarTheme`; add `ThemeOverrides` and `AllThemeOverrides` types |
| `lib/themeOverrides.ts` | Create | localStorage helpers + `mergeThemeOverrides` |
| `components/CalendarApp.tsx` | Modify | Add `allOverrides` state, load/save, merge, apply font CSS var, pass new props |
| `components/SettingsModal.tsx` | Modify | Widen dialog; add `themeOverrides`/`onOverrideChange` props; render `CollapsibleThemeSettings` |
| `components/CollapsibleThemeSettings.tsx` | Create | Chakra collapsible shell + two-column grid |
| `components/ThemeSettingsForm.tsx` | Create | Font dropdown, overlay slider, color rows |
| `components/ColorRow.tsx` | Create | Single labeled row + inline Chakra ColorPicker popover |
| `components/ThemeSettingsPreview.tsx` | Create | Static mini calendar grid with inline styles from theme |

---

## Task 1: Types & localStorage helpers

**Files:**
- Modify: `themes/types.ts`
- Create: `lib/themeOverrides.ts`

- [ ] **Step 1: Add `font` and overlay types to `CalendarTheme`**

In `themes/types.ts`, add `font?: string` as the first key inside `CalendarTheme` (before `name`), and add the two new exported types at the bottom:

```ts
// themes/types.ts
export interface CalendarTheme {
  font?: string
  name: string
  backgrounds: string[]
  fallbackBackground: string
  cycleIntervalMs: number
  backgroundOverlay: string
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
  backgroundOverlay?: string
  calendar?: Partial<CalendarTheme["calendar"]>
  icons?: {
    set?: string
    overrides?: Record<string, string>
  }
}

export type ThemeOverrides = {
  font?: string
  backgroundOverlay?: string
  calendar?: Partial<CalendarTheme["calendar"]>
}

export type AllThemeOverrides = Record<string, ThemeOverrides>
```

- [ ] **Step 2: Create `lib/themeOverrides.ts`**

```ts
// lib/themeOverrides.ts
import type { CalendarTheme, ThemeOverrides, AllThemeOverrides } from "@/themes/types"

const LS_KEY = "claw:themeOverrides"

export function loadAllOverrides(): AllThemeOverrides {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as AllThemeOverrides) : {}
  } catch {
    return {}
  }
}

export function saveAllOverrides(all: AllThemeOverrides): void {
  localStorage.setItem(LS_KEY, JSON.stringify(all))
}

export function mergeThemeOverrides(
  base: CalendarTheme,
  overrides: ThemeOverrides
): CalendarTheme {
  return {
    ...base,
    ...(overrides.font !== undefined ? { font: overrides.font } : {}),
    ...(overrides.backgroundOverlay !== undefined
      ? { backgroundOverlay: overrides.backgroundOverlay }
      : {}),
    calendar: overrides.calendar
      ? { ...base.calendar, ...overrides.calendar }
      : base.calendar,
  }
}
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/dtiemann/claw-calendar && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add themes/types.ts lib/themeOverrides.ts
git commit -m "feat: add ThemeOverrides types and localStorage helpers"
```

---

## Task 2: CalendarApp — overrides state & wiring

**Files:**
- Modify: `components/CalendarApp.tsx`

- [ ] **Step 1: Add overrides state, load from localStorage, and define handler**

Replace the imports block and add `allOverrides` state. The full updated `CalendarApp.tsx`:

```tsx
"use client"

import { useState, useEffect, useMemo } from "react"
import dynamic from "next/dynamic"
import type { CalendarTheme } from "@/themes/types"
import type { AllThemeOverrides, ThemeOverrides } from "@/themes/types"
import type { ConnectorMeta } from "@/lib/connectors/types"
import { ThemeBackground } from "./ThemeBackground"
import { SettingsModal } from "./SettingsModal"
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

interface Props {
  themes: Record<string, CalendarTheme>
}

export function CalendarApp({ themes }: Props) {
  const themeNames = Object.keys(themes)
  const [themeName, setThemeName] = useState(DEFAULT_THEME)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [connectors, setConnectors] = useState<ConnectorMeta[]>([])
  const [hiddenConnectorIds, setHiddenConnectorIds] = useState<Set<string>>(new Set())
  const [cycleIntervalMs, setCycleIntervalMs] = useState<number>(3_600_000)
  const [idleResetMs, setIdleResetMs] = useState<number>(0)
  const [allOverrides, setAllOverrides] = useState<AllThemeOverrides>({})

  // Read saved preferences from localStorage after mount
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
  }, [themes])

  const baseTheme = themes[themeName] ?? themes[themeNames[0]]

  const theme = useMemo(() => {
    const withCycle = { ...baseTheme, cycleIntervalMs }
    return mergeThemeOverrides(withCycle, allOverrides[themeName] ?? {})
  }, [baseTheme, cycleIntervalMs, allOverrides, themeName])

  // Apply font override to CSS variable whenever it changes
  useEffect(() => {
    if (theme.font && theme.font in fonts) {
      document.documentElement.style.setProperty(
        "--font-family",
        fonts[theme.font as FontId].family
      )
    }
  }, [theme.font])

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
      const next: AllThemeOverrides = {
        ...prev,
        [themeName]: {
          ...current,
          ...patch,
          calendar: patch.calendar
            ? { ...(current.calendar ?? {}), ...patch.calendar }
            : current.calendar,
        },
      }
      saveAllOverrides(next)
      return next
    })
  }

  const handleResetOverrides = () => {
    setAllOverrides((prev) => {
      const next = { ...prev }
      delete next[themeName]
      saveAllOverrides(next)
      return next
    })
    // Restore server-configured font
    document.documentElement.style.removeProperty("--font-family")
  }

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
      <Calendar
        theme={theme}
        hiddenConnectorIds={hiddenConnectorIds}
        onOpenSettings={() => setSettingsOpen(true)}
        onConnectorsLoaded={setConnectors}
        idleResetMs={idleResetMs}
      />
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        themes={themes}
        currentThemeName={themeName}
        onThemeChange={handleThemeChange}
        connectors={connectors}
        hiddenConnectorIds={hiddenConnectorIds}
        onToggleConnector={handleToggleConnector}
        cycleIntervalMs={cycleIntervalMs}
        onCycleIntervalChange={handleCycleIntervalChange}
        idleResetMs={idleResetMs}
        onIdleResetChange={handleIdleResetChange}
        themeOverrides={allOverrides[themeName] ?? {}}
        onOverrideChange={handleOverrideChange}
        onResetOverrides={handleResetOverrides}
      />
    </main>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: errors about `themeOverrides`, `onOverrideChange`, `onResetOverrides` not existing on `SettingsModal` props — that's fine, they'll be added in Task 6.

- [ ] **Step 3: Commit**

```bash
git add components/CalendarApp.tsx
git commit -m "feat: add theme overrides state and persistence to CalendarApp"
```

---

## Task 3: ThemeSettingsPreview component

**Files:**
- Create: `components/ThemeSettingsPreview.tsx`

- [ ] **Step 1: Create the component**

This is a static mini calendar grid styled entirely from the passed theme. No FullCalendar dependency.

```tsx
// components/ThemeSettingsPreview.tsx
import type { CalendarTheme } from "@/themes/types"

interface Props {
  theme: CalendarTheme
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

// 3 weeks × 7 cols of sample day data
const SAMPLE_DAYS = [
  { n: 30, otherMonth: true,  today: false, events: [] },
  { n: 31, otherMonth: true,  today: false, events: [] },
  { n:  1, otherMonth: false, today: false, events: [] },
  { n:  2, otherMonth: false, today: false, events: [] },
  { n:  3, otherMonth: false, today: false, events: [] },
  { n:  4, otherMonth: false, today: false, events: ["School pickup"] },
  { n:  5, otherMonth: false, today: false, events: [] },
  { n:  6, otherMonth: false, today: false, events: [] },
  { n:  7, otherMonth: false, today: false, events: ["Doctor appt"] },
  { n:  8, otherMonth: false, today: false, events: [] },
  { n:  9, otherMonth: false, today: true,  events: ["Family Meeting"] },
  { n: 10, otherMonth: false, today: false, events: [] },
  { n: 11, otherMonth: false, today: false, events: ["Date night"] },
  { n: 12, otherMonth: false, today: false, events: [] },
  { n: 13, otherMonth: false, today: false, events: [] },
  { n: 14, otherMonth: false, today: false, events: ["Pick up kids"] },
  { n: 15, otherMonth: false, today: false, events: [] },
  { n: 16, otherMonth: false, today: false, events: ["Dentist"] },
  { n: 17, otherMonth: false, today: false, events: [] },
  { n: 18, otherMonth: false, today: false, events: [] },
  { n: 19, otherMonth: false, today: false, events: [] },
]

export function ThemeSettingsPreview({ theme }: Props) {
  const c = theme.calendar

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          fontSize: "0.68rem",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          opacity: 0.35,
        }}
      >
        Preview
      </div>

      <div style={{ borderRadius: 6, overflow: "hidden" }}>
        {/* Day headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            background: c.headerBg,
          }}
        >
          {DAYS.map((d) => (
            <div
              key={d}
              style={{
                padding: "5px 4px",
                textAlign: "center",
                fontSize: "0.6rem",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: c.textColor,
                opacity: 0.5,
                fontWeight: 600,
              }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
          {SAMPLE_DAYS.map((day, i) => (
            <div
              key={i}
              style={{
                background: day.today ? c.todayBg : c.cellBg,
                borderRight: `1px solid ${c.cellBorder}`,
                borderBottom: `1px solid ${c.cellBorder}`,
                padding: "4px 5px",
                minHeight: 52,
                display: "flex",
                flexDirection: "column",
                gap: 3,
                ...(i % 7 === 6 ? { borderRight: "none" } : {}),
              }}
            >
              {day.today ? (
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: c.textColor,
                    color: "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.62rem",
                    fontWeight: 700,
                    flexShrink: 0,
                    filter: "invert(1)",
                  }}
                >
                  {day.n}
                </span>
              ) : (
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 500,
                    color: c.textColor,
                    opacity: day.otherMonth ? 0.2 : 1,
                    lineHeight: 1,
                  }}
                >
                  {day.n}
                </span>
              )}
              {day.events.map((ev) => (
                <div
                  key={ev}
                  style={{
                    background: c.eventBg,
                    borderLeft: `2px solid ${c.eventBorder}`,
                    borderRadius: 3,
                    padding: "2px 4px",
                    fontSize: "0.58rem",
                    color: "#fff",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    lineHeight: 1.3,
                  }}
                >
                  {ev}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {[
          { color: c.textColor, label: "Text color" },
          { color: c.todayBg, label: "Today highlight" },
          { color: c.cellBorder, label: "Cell border" },
          { color: c.eventBg, label: "Event color" },
          { color: c.headerBg, label: "Header background" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: color,
                border: "1px solid rgba(255,255,255,0.2)",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: "0.67rem", color: "rgba(255,255,255,0.4)", lineHeight: 1.3 }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/ThemeSettingsPreview.tsx
git commit -m "feat: add ThemeSettingsPreview static calendar cell component"
```

---

## Task 4: ColorRow component

**Files:**
- Create: `components/ColorRow.tsx`

- [ ] **Step 1: Create the component**

Each row is a full-width trigger that opens a Chakra floating color picker popover.

```tsx
// components/ColorRow.tsx
"use client"

import {
  ColorPickerRoot,
  ColorPickerControl,
  ColorPickerTrigger,
  ColorPickerPositioner,
  ColorPickerContent,
  ColorPickerArea,
  ColorPickerAreaBackground,
  ColorPickerAreaThumb,
  ColorPickerChannelSlider,
  ColorPickerChannelSliderTrack,
  ColorPickerChannelSliderThumb,
  ColorPickerTransparencyGrid,
  ColorPickerInput,
  parseColor,
} from "@chakra-ui/react"
import type { ColorValueChangeDetails } from "@chakra-ui/react"

interface Props {
  label: string
  value: string      // CSS color string, e.g. "rgba(59, 130, 246, 0.85)"
  onChange: (css: string) => void
}

function safeParse(css: string) {
  try {
    return parseColor(css)
  } catch {
    return parseColor("rgba(255,255,255,1)")
  }
}

export function ColorRow({ label, value, onChange }: Props) {
  const parsed = safeParse(value)

  const handleChange = (details: ColorValueChangeDetails) => {
    onChange(details.value.toString("css"))
  }

  return (
    <ColorPickerRoot
      value={parsed}
      onValueChange={handleChange}
      format="rgba"
    >
      <ColorPickerControl>
        <ColorPickerTrigger
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
            padding: "6px 9px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: 6,
            cursor: "pointer",
            color: "#fff",
            fontFamily: "inherit",
            transition: "background 0.15s",
          }}
          _hover={{ background: "rgba(255,255,255,0.08)" }}
        >
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 3,
              border: "1px solid rgba(255,255,255,0.2)",
              flexShrink: 0,
              background: value,
            }}
          />
          <span style={{ fontSize: "0.72rem", opacity: 0.7, flex: 1, textAlign: "left" }}>
            {label}
          </span>
          <span style={{ fontSize: "0.65rem", opacity: 0.25 }}>✎</span>
        </ColorPickerTrigger>
      </ColorPickerControl>

      <ColorPickerPositioner>
        <ColorPickerContent
          style={{
            background: "#1e293b",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 10,
            padding: 14,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            width: 220,
          }}
        >
          <ColorPickerArea style={{ borderRadius: 6, overflow: "hidden", height: 100 }}>
            <ColorPickerAreaBackground />
            <ColorPickerAreaThumb />
          </ColorPickerArea>

          <ColorPickerChannelSlider channel="hue">
            <ColorPickerChannelSliderTrack style={{ borderRadius: 4, height: 10 }} />
            <ColorPickerChannelSliderThumb />
          </ColorPickerChannelSlider>

          <ColorPickerChannelSlider channel="alpha">
            <ColorPickerTransparencyGrid />
            <ColorPickerChannelSliderTrack style={{ borderRadius: 4, height: 10 }} />
            <ColorPickerChannelSliderThumb />
          </ColorPickerChannelSlider>

          <ColorPickerInput
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 5,
              color: "#fff",
              fontSize: "0.72rem",
              padding: "5px 8px",
              fontFamily: "monospace",
            }}
          />
        </ColorPickerContent>
      </ColorPickerPositioner>
    </ColorPickerRoot>
  )
}
```

Note: `ColorValueChangeDetails` is exported from `@chakra-ui/react`. If the import fails at type-check time, replace with `{ value: { toString: (format: string) => string } }`.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

If `ColorValueChangeDetails` isn't exported, replace with the inline type shown above.

- [ ] **Step 3: Commit**

```bash
git add components/ColorRow.tsx
git commit -m "feat: add ColorRow component with Chakra ColorPicker popover"
```

---

## Task 5: ThemeSettingsForm component

**Files:**
- Create: `components/ThemeSettingsForm.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/ThemeSettingsForm.tsx
"use client"

import {
  NativeSelectRoot,
  NativeSelectField,
  NativeSelectIndicator,
  SliderRoot,
  SliderControl,
  SliderTrack,
  SliderRange,
  SliderThumb,
} from "@chakra-ui/react"
import type { CalendarTheme, ThemeOverrides } from "@/themes/types"
import { fonts } from "@/lib/fonts"
import { ColorRow } from "./ColorRow"

interface Props {
  theme: CalendarTheme       // current merged theme (base + overrides)
  overrides: ThemeOverrides  // just the overrides for the current theme
  onOverrideChange: (patch: ThemeOverrides) => void
  onReset: () => void
}

function parseOverlayOpacity(overlay: string): number {
  // Extract alpha from "rgba(0,0,0,0.45)" → 45
  const match = overlay.match(/rgba?\([^)]+,\s*([\d.]+)\)/)
  if (!match) return 45
  return Math.round(parseFloat(match[1]) * 100)
}

const FONT_OPTIONS = Object.entries(fonts).map(([id, { label }]) => ({ id, label }))

const COLOR_FIELDS: { key: keyof CalendarTheme["calendar"]; label: string }[] = [
  { key: "cellBg",             label: "Cell Background" },
  { key: "cellBorder",         label: "Cell Border" },
  { key: "textColor",          label: "Text Color" },
  { key: "todayBg",            label: "Today Highlight" },
  { key: "headerBg",           label: "Header Background" },
  { key: "eventBg",            label: "Event Color" },
  { key: "drawerBg",           label: "Drawer Background" },
  { key: "toolbarButtonBg",    label: "Toolbar Buttons" },
]

export function ThemeSettingsForm({ theme, onOverrideChange, onReset }: Props) {
  const overlayOpacity = parseOverlayOpacity(theme.backgroundOverlay)

  const handleFontChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onOverrideChange({ font: e.target.value })
  }

  const handleOverlayChange = (details: { value: number[] }) => {
    const alpha = (details.value[0] / 100).toFixed(2)
    onOverrideChange({ backgroundOverlay: `rgba(0,0,0,${alpha})` })
  }

  const handleColorChange = (key: keyof CalendarTheme["calendar"]) => (css: string) => {
    onOverrideChange({ calendar: { [key]: css } })
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Font */}
      <div>
        <div style={subsectionLabelStyle}>Font</div>
        <NativeSelectRoot size="sm">
          <NativeSelectField
            value={theme.font ?? "nunito"}
            onChange={handleFontChange}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 6,
              color: "#fff",
              fontFamily: "inherit",
            }}
          >
            {FONT_OPTIONS.map(({ id, label }) => (
              <option key={id} value={id} style={{ background: "#1e293b" }}>
                {label}
              </option>
            ))}
          </NativeSelectField>
          <NativeSelectIndicator color="rgba(255,255,255,0.4)" />
        </NativeSelectRoot>
      </div>

      {/* Background Overlay */}
      <div>
        <div style={subsectionLabelStyle}>Background Overlay</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              border: "1px solid rgba(255,255,255,0.2)",
              flexShrink: 0,
              background: theme.backgroundOverlay,
            }}
          />
          <SliderRoot
            min={0}
            max={100}
            step={1}
            value={[overlayOpacity]}
            onValueChange={handleOverlayChange}
            style={{ flex: 1 }}
          >
            <SliderControl>
              <SliderTrack>
                <SliderRange />
              </SliderTrack>
              <SliderThumb index={0} />
            </SliderControl>
          </SliderRoot>
          <span style={{ fontSize: "0.72rem", opacity: 0.5, width: 32, textAlign: "right", flexShrink: 0 }}>
            {overlayOpacity}%
          </span>
        </div>
      </div>

      {/* Calendar Colors */}
      <div>
        <div style={subsectionLabelStyle}>Calendar Colors</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {COLOR_FIELDS.map(({ key, label }) => (
            <ColorRow
              key={key}
              label={label}
              value={theme.calendar[key]}
              onChange={handleColorChange(key)}
            />
          ))}
        </div>
      </div>

      {/* Reset */}
      <div style={{ textAlign: "right" }}>
        <button
          onClick={onReset}
          style={{
            background: "none",
            border: "none",
            color: "rgba(255,255,255,0.35)",
            fontSize: "0.7rem",
            cursor: "pointer",
            textDecoration: "underline",
            textUnderlineOffset: 3,
            fontFamily: "inherit",
            padding: 0,
          }}
        >
          Reset to theme defaults
        </button>
      </div>

    </div>
  )
}

const subsectionLabelStyle: React.CSSProperties = {
  fontSize: "0.68rem",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  opacity: 0.35,
  marginBottom: 6,
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/ThemeSettingsForm.tsx
git commit -m "feat: add ThemeSettingsForm with font, overlay, and color controls"
```

---

## Task 6: CollapsibleThemeSettings + SettingsModal integration

**Files:**
- Create: `components/CollapsibleThemeSettings.tsx`
- Modify: `components/SettingsModal.tsx`

- [ ] **Step 1: Create `CollapsibleThemeSettings`**

```tsx
// components/CollapsibleThemeSettings.tsx
"use client"

import {
  CollapsibleRoot,
  CollapsibleTrigger,
  CollapsibleContent,
  CollapsibleIndicator,
} from "@chakra-ui/react"
import { ChevronDown } from "lucide-react"
import type { CalendarTheme, ThemeOverrides } from "@/themes/types"
import { ThemeSettingsForm } from "./ThemeSettingsForm"
import { ThemeSettingsPreview } from "./ThemeSettingsPreview"

interface Props {
  theme: CalendarTheme
  overrides: ThemeOverrides
  onOverrideChange: (patch: ThemeOverrides) => void
  onReset: () => void
  drawerBorder: string
}

export function CollapsibleThemeSettings({
  theme,
  overrides,
  onOverrideChange,
  onReset,
  drawerBorder,
}: Props) {
  return (
    <div style={{ marginBottom: 24 }}>
      <CollapsibleRoot>
        <CollapsibleTrigger
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            padding: "11px 14px",
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${drawerBorder}`,
            borderRadius: 8,
            color: "#fff",
            fontFamily: "inherit",
            fontSize: "0.82rem",
            fontWeight: 500,
            cursor: "pointer",
            transition: "background 0.15s",
          }}
          _open={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
          _hover={{ background: "rgba(255,255,255,0.07)" }}
        >
          Theme Settings
          <CollapsibleIndicator>
            <ChevronDown size={12} color="rgba(255,255,255,0.4)" />
          </CollapsibleIndicator>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 0,
              border: `1px solid ${drawerBorder}`,
              borderTop: "none",
              borderBottomLeftRadius: 8,
              borderBottomRightRadius: 8,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: 16,
                borderRight: `1px solid ${drawerBorder}`,
              }}
            >
              <ThemeSettingsForm
                theme={theme}
                overrides={overrides}
                onOverrideChange={onOverrideChange}
                onReset={onReset}
              />
            </div>
            <div style={{ padding: 16 }}>
              <ThemeSettingsPreview theme={theme} />
            </div>
          </div>
        </CollapsibleContent>
      </CollapsibleRoot>
    </div>
  )
}
```

- [ ] **Step 2: Update `SettingsModal` props, widen dialog, render `CollapsibleThemeSettings`**

Add three new props to the `Props` interface and update the component. The key changes are:
1. Add `themeOverrides`, `onOverrideChange`, `onResetOverrides` to `Props`
2. Widen dialog from `min(500px, 92vw)` to `min(760px, 94vw)`
3. Render `<CollapsibleThemeSettings>` in the Theme tab after the theme grid

Replace the `Props` interface at the top of `components/SettingsModal.tsx`:

```tsx
interface Props {
  open: boolean
  onClose: () => void
  theme: CalendarTheme
  themes: Record<string, CalendarTheme>
  currentThemeName: string
  onThemeChange: (name: string) => void
  connectors: ConnectorMeta[]
  hiddenConnectorIds: Set<string>
  onToggleConnector: (id: string) => void
  cycleIntervalMs: number
  onCycleIntervalChange: (ms: number) => void
  idleResetMs: number
  onIdleResetChange: (ms: number) => void
  themeOverrides: ThemeOverrides
  onOverrideChange: (patch: ThemeOverrides) => void
  onResetOverrides: () => void
}
```

Add two imports at the top of the file (after existing imports):

```tsx
import type { ThemeOverrides } from "@/themes/types"
import { CollapsibleThemeSettings } from "./CollapsibleThemeSettings"
```

Add `themeOverrides`, `onOverrideChange`, `onResetOverrides` to the destructured props list.

Change the dialog width in the `/* Panel */` div:

```tsx
width: "min(760px, 94vw)",
```

In the Theme tab section, add `<CollapsibleThemeSettings>` after the closing `</Section>` tag of the theme grid and before the `{theme.backgrounds.length > 0 && ...}` block:

```tsx
<CollapsibleThemeSettings
  theme={theme}
  overrides={themeOverrides}
  onOverrideChange={onOverrideChange}
  onReset={onResetOverrides}
  drawerBorder={c.drawerBorder}
/>
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/CollapsibleThemeSettings.tsx components/SettingsModal.tsx
git commit -m "feat: add CollapsibleThemeSettings to SettingsModal with two-column layout"
```

---

## Task 7: Browser verification

- [ ] **Step 1: Rebuild and restart**

```bash
npm run build 2>&1 | tail -20
pm2 restart claw-calendar
```

Expected: build succeeds with no errors, pm2 shows `online`.

- [ ] **Step 2: Open the app and verify the Theme tab**

Navigate to `http://localhost:3000`, open Settings → Theme tab. Confirm:
- Dialog is wider (~760px)
- "Theme Settings" collapsible appears below the theme grid
- Clicking the trigger expands the two-column layout
- Left: font dropdown, overlay slider, 8 color rows
- Right: mini calendar preview

- [ ] **Step 3: Test font override**

Change font to "Lato". Confirm the calendar font changes immediately. Reload the page — confirm the localStorage value is restored (`claw:themeOverrides` → `{ "yosemite": { "font": "lato" } }`).

- [ ] **Step 4: Test overlay override**

Drag the overlay slider to 80%. Confirm the background image gets darker. Switch themes and back — confirm the override is theme-specific.

- [ ] **Step 5: Test color override**

Click the "Event Color" row. Confirm the Chakra color picker popover appears. Change the hue. Confirm the event chips in the preview update live and the calendar events on the main page update.

- [ ] **Step 6: Test reset**

Click "Reset to theme defaults". Confirm all overrides for the current theme are removed and the calendar returns to base theme values.

- [ ] **Step 7: Final commit**

```bash
git add -p   # review any lingering changes
git commit -m "feat: complete theme settings collapsible with live preview"
```
