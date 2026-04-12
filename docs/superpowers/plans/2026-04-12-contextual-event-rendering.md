# Contextual Event Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render calendar events with category-based background colors and "who" initial badges, driven by hashtags parsed from event descriptions, with a Settings UI for customizing tag types and colors.

**Architecture:** A pure `lib/events/tags.ts` module parses `#hashtag` tokens from event descriptions and classifies them against a user-managed `TagConfig[]` stored in localStorage. `CalendarApp` owns tag config state and passes it down to `Calendar` (for rendering) and `SettingsModal` (for editing). `renderEventContent` applies category colors and who badges. A new Tags tab in Settings provides full CRUD for tag configurations.

**Tech Stack:** React 19, Next.js 16, FullCalendar 6.1.20, Chakra UI v3, TypeScript 5, Vitest (new)

**Spec:** `docs/superpowers/specs/2026-04-12-contextual-event-rendering-design.md`

---

## File Structure

**New files:**
- `lib/events/tags.ts` — `TagConfig` type, `DEFAULT_PALETTE`, `parseEventTags()`, `discoverNewTags()`
- `lib/events/tags.test.ts` — Unit tests for tag parsing and discovery
- `components/TagSettingsForm.tsx` — Tags tab UI component
- `vitest.config.ts` — Test runner configuration

**Modified files:**
- `package.json` — Add vitest dev dependency
- `components/Calendar.tsx:173-192` — `renderEventContent` uses tag data for colors + badges
- `components/CalendarApp.tsx:29-169` — Owns `tagConfigs` state, localStorage persistence, passes to children
- `components/SettingsModal.tsx:29,50,158` — Adds Tags tab, receives/passes tagConfigs props

---

### Task 1: Set Up Vitest

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Install vitest**

Run: `npm install -D vitest`

- [ ] **Step 2: Create vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
})
```

- [ ] **Step 3: Add test script to package.json**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify vitest runs**

Run: `npx vitest run`
Expected: "No test files found" (no error, clean exit)

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts package.json package-lock.json
git commit -m "chore: add vitest for unit testing"
```

---

### Task 2: Tag Parsing Module — Types, Palette, and `parseEventTags()`

**Files:**
- Create: `lib/events/tags.ts`
- Create: `lib/events/tags.test.ts`

- [ ] **Step 1: Write failing tests for `parseEventTags`**

Create `lib/events/tags.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { parseEventTags, type TagConfig } from "./tags"

describe("parseEventTags", () => {
  const configs: TagConfig[] = [
    { name: "sports", type: "category", color: "#22c55e" },
    { name: "medical", type: "category", color: "#ef4444" },
    { name: "emma", type: "who", color: "#3b82f6", initial: "E" },
    { name: "mom", type: "who", color: "#a855f7", initial: "M" },
  ]

  it("extracts category and who tags from description", () => {
    const result = parseEventTags("Basketball practice #sports #emma", configs)
    expect(result.categories).toEqual(["sports"])
    expect(result.who).toEqual(["emma"])
  })

  it("strips hashtags from cleanText", () => {
    const result = parseEventTags("Basketball practice #sports #emma", configs)
    expect(result.cleanText).toBe("Basketball practice")
  })

  it("normalizes tags to lowercase", () => {
    const result = parseEventTags("Doctor visit #Medical #MOM", configs)
    expect(result.categories).toEqual(["medical"])
    expect(result.who).toEqual(["mom"])
  })

  it("treats unknown tags as category", () => {
    const result = parseEventTags("Meeting #newTag", configs)
    expect(result.categories).toEqual(["newtag"])
    expect(result.who).toEqual([])
  })

  it("returns empty arrays when no hashtags", () => {
    const result = parseEventTags("Just a normal event", configs)
    expect(result.categories).toEqual([])
    expect(result.who).toEqual([])
  })

  it("handles undefined/empty description", () => {
    expect(parseEventTags("", configs)).toEqual({
      categories: [],
      who: [],
      cleanText: "",
    })
    expect(parseEventTags(undefined as unknown as string, configs)).toEqual({
      categories: [],
      who: [],
      cleanText: "",
    })
  })

  it("handles multiple category tags (all returned, first wins for color)", () => {
    const result = parseEventTags("Event #sports #medical", configs)
    expect(result.categories).toEqual(["sports", "medical"])
  })

  it("handles tags at start and middle of text", () => {
    const result = parseEventTags("#sports game at #emma school", configs)
    expect(result.categories).toEqual(["sports"])
    expect(result.who).toEqual(["emma"])
    expect(result.cleanText).toBe("game at school")
  })

  it("trims extra whitespace from cleanText", () => {
    const result = parseEventTags("  #sports  Basketball  #emma  ", configs)
    expect(result.cleanText).toBe("Basketball")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/events/tags.test.ts`
Expected: FAIL — cannot find module `./tags`

- [ ] **Step 3: Implement `lib/events/tags.ts`**

Create `lib/events/tags.ts`:

```ts
// lib/events/tags.ts

export interface TagConfig {
  name: string
  type: "category" | "who"
  color: string
  initial?: string
}

export interface ParsedTags {
  categories: string[]
  who: string[]
  cleanText: string
}

export const DEFAULT_PALETTE = [
  "#22c55e", "#ef4444", "#eab308", "#3b82f6", "#a855f7",
  "#f97316", "#06b6d4", "#ec4899", "#84cc16", "#6366f1",
]

const TAG_REGEX = /#(\w+)/g

export function parseEventTags(
  description: string | undefined | null,
  tagConfigs: TagConfig[]
): ParsedTags {
  if (!description) return { categories: [], who: [], cleanText: "" }

  const configMap = new Map(tagConfigs.map((c) => [c.name, c]))
  const categories: string[] = []
  const who: string[] = []

  const matches = [...description.matchAll(TAG_REGEX)]
  for (const match of matches) {
    const tag = match[1].toLowerCase()
    const config = configMap.get(tag)
    if (config?.type === "who") {
      who.push(tag)
    } else {
      categories.push(tag)
    }
  }

  const cleanText = description
    .replace(TAG_REGEX, "")
    .replace(/\s+/g, " ")
    .trim()

  return { categories, who, cleanText }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/events/tags.test.ts`
Expected: All 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/events/tags.ts lib/events/tags.test.ts
git commit -m "feat: add tag parsing module with parseEventTags"
```

---

### Task 3: Tag Discovery — `discoverNewTags()`

**Files:**
- Modify: `lib/events/tags.ts`
- Modify: `lib/events/tags.test.ts`

- [ ] **Step 1: Write failing tests for `discoverNewTags`**

Append to `lib/events/tags.test.ts`:

```ts
import { discoverNewTags } from "./tags"

describe("discoverNewTags", () => {
  it("returns new TagConfigs for unknown hashtags", () => {
    const existing: TagConfig[] = [
      { name: "sports", type: "category", color: "#22c55e" },
    ]
    const descriptions = [
      "Game #sports #emma",
      "Doctor visit #medical",
    ]
    const newTags = discoverNewTags(descriptions, existing)
    expect(newTags).toHaveLength(2)
    expect(newTags[0].name).toBe("emma")
    expect(newTags[0].type).toBe("category")
    expect(newTags[1].name).toBe("medical")
  })

  it("assigns colors from palette based on existing config length", () => {
    const existing: TagConfig[] = [
      { name: "sports", type: "category", color: "#22c55e" },
    ]
    const descriptions = ["Event #newtag"]
    const newTags = discoverNewTags(descriptions, existing)
    // existing has 1 tag, so next palette index is 1 → "#ef4444"
    expect(newTags[0].color).toBe("#ef4444")
  })

  it("does not duplicate already-known tags", () => {
    const existing: TagConfig[] = [
      { name: "sports", type: "category", color: "#22c55e" },
    ]
    const descriptions = ["Game #sports", "Another #sports"]
    const newTags = discoverNewTags(descriptions, existing)
    expect(newTags).toHaveLength(0)
  })

  it("deduplicates across multiple descriptions", () => {
    const descriptions = ["Event #newtag", "Another #newtag"]
    const newTags = discoverNewTags(descriptions, [])
    expect(newTags).toHaveLength(1)
  })

  it("wraps palette when more tags than colors", () => {
    const existing: TagConfig[] = Array.from({ length: 10 }, (_, i) => ({
      name: `tag${i}`,
      type: "category" as const,
      color: "#000",
    }))
    const descriptions = ["Event #overflow"]
    const newTags = discoverNewTags(descriptions, existing)
    // 10 existing → palette index 10 % 10 = 0 → "#22c55e"
    expect(newTags[0].color).toBe("#22c55e")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/events/tags.test.ts`
Expected: FAIL — `discoverNewTags` is not exported

- [ ] **Step 3: Implement `discoverNewTags`**

Add to the bottom of `lib/events/tags.ts`:

```ts
export function discoverNewTags(
  descriptions: (string | undefined | null)[],
  existing: TagConfig[]
): TagConfig[] {
  const known = new Set(existing.map((c) => c.name))
  const seen = new Set<string>()
  const newTags: TagConfig[] = []

  for (const desc of descriptions) {
    if (!desc) continue
    const matches = [...desc.matchAll(TAG_REGEX)]
    for (const match of matches) {
      const tag = match[1].toLowerCase()
      if (known.has(tag) || seen.has(tag)) continue
      seen.add(tag)
      newTags.push({
        name: tag,
        type: "category",
        color: DEFAULT_PALETTE[(existing.length + newTags.length) % DEFAULT_PALETTE.length],
      })
    }
  }

  return newTags
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/events/tags.test.ts`
Expected: All 14 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/events/tags.ts lib/events/tags.test.ts
git commit -m "feat: add discoverNewTags for auto-discovery of hashtags"
```

---

### Task 4: Wire Tag State Into `CalendarApp`

**Files:**
- Modify: `components/CalendarApp.tsx`

This task adds `tagConfigs` state to `CalendarApp`, loads/saves from localStorage, and passes it down to `Calendar` and `SettingsModal`. No rendering changes yet — just plumbing.

- [ ] **Step 1: Add tagConfigs state and localStorage persistence**

In `components/CalendarApp.tsx`, add the import at the top (after existing imports):

```ts
import type { TagConfig } from "@/lib/events/tags"
```

Add a new localStorage key constant near the existing ones (after `LS_IDLE_KEY`):

```ts
const LS_TAGS_KEY = "claw:tagConfigs"
```

Inside `CalendarApp`, add state after the `allOverrides` state line:

```ts
const [tagConfigs, setTagConfigs] = useState<TagConfig[]>([])
```

Inside the existing `useEffect` that reads localStorage (the one with `savedTheme`, `savedCycle`, `savedIdle`), add at the end before the closing `}, [themes])`:

```ts
    const savedTags = localStorage.getItem(LS_TAGS_KEY)
    if (savedTags) {
      try { setTagConfigs(JSON.parse(savedTags)) } catch { /* ignore corrupt data */ }
    }
```

Add a new `useEffect` to persist tagConfigs (after the `saveAllOverrides` effect):

```ts
  useEffect(() => {
    localStorage.setItem(LS_TAGS_KEY, JSON.stringify(tagConfigs))
  }, [tagConfigs])
```

- [ ] **Step 2: Add handler and pass tagConfigs to Calendar**

Add a handler function in `CalendarApp` (after `handleToggleConnector`):

```ts
  const handleTagConfigsChange = (configs: TagConfig[]) => {
    setTagConfigs(configs)
  }
```

Update the `<Calendar>` JSX to pass `tagConfigs`:

```tsx
      <Calendar
        theme={theme}
        hiddenConnectorIds={hiddenConnectorIds}
        onOpenSettings={() => setSettingsOpen(true)}
        onConnectorsLoaded={setConnectors}
        idleResetMs={idleResetMs}
        tagConfigs={tagConfigs}
        onTagConfigsChange={handleTagConfigsChange}
      />
```

Update the `<SettingsModal>` JSX to pass `tagConfigs`:

```tsx
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
        tagConfigs={tagConfigs}
        onTagConfigsChange={handleTagConfigsChange}
      />
```

- [ ] **Step 3: Update Calendar Props interface**

In `components/Calendar.tsx`, update the `Props` interface to accept tag configs:

```ts
import type { TagConfig } from "@/lib/events/tags"

interface Props {
  theme: CalendarTheme
  hiddenConnectorIds?: Set<string>
  onOpenSettings?: () => void
  onConnectorsLoaded?: (connectors: ConnectorMeta[]) => void
  idleResetMs?: number
  tagConfigs: TagConfig[]
  onTagConfigsChange: (configs: TagConfig[]) => void
}
```

Update the function signature to destructure the new props:

```ts
export function Calendar({ theme, hiddenConnectorIds, onOpenSettings, onConnectorsLoaded, idleResetMs, tagConfigs, onTagConfigsChange }: Props) {
```

- [ ] **Step 4: Update SettingsModal Props interface**

In `components/SettingsModal.tsx`, update the `Props` interface:

```ts
import type { TagConfig } from "@/lib/events/tags"
```

Add to the `Props` interface:

```ts
  tagConfigs: TagConfig[]
  onTagConfigsChange: (configs: TagConfig[]) => void
```

Update the destructuring in the function signature to include `tagConfigs` and `onTagConfigsChange`.

- [ ] **Step 5: Verify build compiles**

Run: `npx next build`
Expected: Build succeeds (no type errors). The new props are passed but not yet used in rendering.

- [ ] **Step 6: Commit**

```bash
git add components/CalendarApp.tsx components/Calendar.tsx components/SettingsModal.tsx
git commit -m "feat: wire tagConfigs state through CalendarApp to Calendar and SettingsModal"
```

---

### Task 5: Tag Auto-Discovery in Calendar

**Files:**
- Modify: `components/Calendar.tsx`

When FullCalendar loads events, scan their descriptions for new hashtags and auto-add them to the tag config.

- [ ] **Step 1: Add auto-discovery effect**

In `components/Calendar.tsx`, add the import:

```ts
import { discoverNewTags } from "@/lib/events/tags"
```

Add a new `useEffect` after the existing MutationObserver effect (the one for `c.allDayEventOpacity`). This uses a FullCalendar `eventsSet` callback to trigger discovery:

Actually, FullCalendar doesn't expose an `eventsSet` prop easily in the React adapter. Instead, add a `useEffect` that runs a periodic scan. A simpler approach: use the MutationObserver that already watches for `.fc-event` additions.

Replace the approach: add a callback ref pattern. When `datesSet` fires (view changes, events reload), scan all events via the calendar API:

Add a new callback after `handleDatesSet`:

```ts
  const handleEventsSet = useCallback(() => {
    const api = calendarRef.current?.getApi()
    if (!api) return
    const descriptions = api.getEvents().map((e) => e.extendedProps?.description as string | undefined)
    const newTags = discoverNewTags(descriptions, tagConfigs)
    if (newTags.length > 0) {
      onTagConfigsChange([...tagConfigs, ...newTags])
    }
  }, [tagConfigs, onTagConfigsChange])
```

Add `eventsSet={handleEventsSet}` to the `<FullCalendar>` props:

```tsx
          eventsSet={handleEventsSet}
```

The `eventsSet` callback fires whenever FullCalendar's internal event store changes (initial load, refetch, navigation).

- [ ] **Step 2: Verify in browser**

Run the dev server (`npm run dev`), open `http://localhost:4000`. Open browser DevTools console. Check localStorage:

```js
JSON.parse(localStorage.getItem("claw:tagConfigs"))
```

Expected: If any calendar events have `#hashtag` tokens in their descriptions, those tags should appear as auto-discovered `TagConfig` entries with `type: "category"` and palette colors.

- [ ] **Step 3: Commit**

```bash
git add components/Calendar.tsx
git commit -m "feat: auto-discover hashtags from event descriptions"
```

---

### Task 6: Render Category Colors and Who Badges

**Files:**
- Modify: `components/Calendar.tsx`

Update `renderEventContent` to use parsed tags for coloring and badges.

- [ ] **Step 1: Update renderEventContent to parse tags and render badges**

In `components/Calendar.tsx`, add the import:

```ts
import { parseEventTags } from "@/lib/events/tags"
```

Replace the existing `renderEventContent` callback (lines ~173-192) with:

```ts
  const renderEventContent = useCallback(
    (arg: EventContentArg) => {
      const icon = resolveEventIcon(arg.event, connectors)
      const description = arg.event.extendedProps?.description as string | undefined
      const parsed = parseEventTags(description, tagConfigs)

      // Find the first matching category config for background color
      const categoryConfig = parsed.categories
        .map((name) => tagConfigs.find((c) => c.name === name && c.type === "category"))
        .find((c) => c !== undefined)

      // Collect who badges
      const whoBadges = parsed.who
        .map((name) => tagConfigs.find((c) => c.name === name && c.type === "who"))
        .filter((c): c is NonNullable<typeof c> => c !== undefined)

      // Apply category color to the FullCalendar event element
      if (categoryConfig) {
        arg.event.setProp("backgroundColor", categoryConfig.color)
        arg.event.setProp("borderColor", categoryConfig.color)
      }

      const hasCustomContent = icon || whoBadges.length > 0
      if (!hasCustomContent) return true

      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            overflow: "hidden",
            padding: "0 2px",
            whiteSpace: "nowrap",
            width: "100%",
          }}
        >
          <div style={{ overflow: "hidden", textOverflow: "ellipsis", flex: 1, minWidth: 0 }}>
            {icon && <span style={{ marginRight: "0.2em" }}>{icon}</span>}
            <span style={{ fontWeight: 500 }}>{arg.event.title}</span>
          </div>
          {whoBadges.length > 0 && (
            <div style={{ display: "flex", gap: 2, marginLeft: 4, flexShrink: 0 }}>
              {whoBadges.map((badge) => (
                <span
                  key={badge.name}
                  title={badge.name}
                  style={{
                    background: "rgba(255,255,255,0.25)",
                    borderRadius: "50%",
                    width: 18,
                    height: 18,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.6rem",
                    fontWeight: 700,
                    flexShrink: 0,
                    lineHeight: 1,
                  }}
                >
                  {badge.initial ?? badge.name[0].toUpperCase()}
                </span>
              ))}
            </div>
          )}
        </div>
      )
    },
    [connectors, tagConfigs]
  )
```

- [ ] **Step 2: Verify in browser**

Open `http://localhost:4000`. Events with hashtags in their descriptions should now show:
- Category color overriding the connector color
- Who badges as small initial circles on the right side of the event chip

If no events have hashtags yet, add a test event in Apple Calendar with description `Test event #sports #emma` and wait for it to sync.

- [ ] **Step 3: Commit**

```bash
git add components/Calendar.tsx
git commit -m "feat: render category colors and who badges on event chips"
```

---

### Task 7: Tags Settings Tab UI

**Files:**
- Create: `components/TagSettingsForm.tsx`
- Modify: `components/SettingsModal.tsx`

- [ ] **Step 1: Create TagSettingsForm component**

Create `components/TagSettingsForm.tsx`:

```tsx
"use client"

import {
  NativeSelectRoot,
  NativeSelectField,
  NativeSelectIndicator,
} from "@chakra-ui/react"
import type { TagConfig } from "@/lib/events/tags"
import { ColorRow } from "./ColorRow"

interface Props {
  tagConfigs: TagConfig[]
  onTagConfigsChange: (configs: TagConfig[]) => void
}

export function TagSettingsForm({ tagConfigs, onTagConfigsChange }: Props) {
  const updateTag = (index: number, patch: Partial<TagConfig>) => {
    const next = tagConfigs.map((t, i) => (i === index ? { ...t, ...patch } : t))
    onTagConfigsChange(next)
  }

  const deleteTag = (index: number) => {
    onTagConfigsChange(tagConfigs.filter((_, i) => i !== index))
  }

  if (tagConfigs.length === 0) {
    return (
      <p style={{ margin: 0, opacity: 0.45, fontSize: "0.88rem", lineHeight: 1.6 }}>
        No tags discovered yet. Add hashtags like <code>#sports</code> or{" "}
        <code>#emma</code> to your calendar event descriptions.
      </p>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {tagConfigs.map((tag, i) => (
        <div
          key={tag.name}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 10px",
            background: "rgba(255,255,255,0.04)",
            borderRadius: 6,
          }}
        >
          {/* Tag name */}
          <span
            style={{
              fontSize: "0.82rem",
              fontWeight: 500,
              minWidth: 80,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            #{tag.name}
          </span>

          {/* Type dropdown */}
          <NativeSelectRoot size="xs" style={{ width: 100, flexShrink: 0 }}>
            <NativeSelectField
              value={tag.type}
              onChange={(e) => {
                const type = e.target.value as "category" | "who"
                const patch: Partial<TagConfig> = { type }
                if (type === "who" && !tag.initial) {
                  patch.initial = tag.name[0].toUpperCase()
                }
                updateTag(i, patch)
              }}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 4,
                color: "#fff",
                fontFamily: "inherit",
                fontSize: "0.72rem",
              }}
            >
              <option value="category" style={{ background: "#1e293b" }}>Category</option>
              <option value="who" style={{ background: "#1e293b" }}>Who</option>
            </NativeSelectField>
            <NativeSelectIndicator color="rgba(255,255,255,0.4)" />
          </NativeSelectRoot>

          {/* Color picker */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <ColorRow
              label=""
              value={tag.color}
              onChange={(css) => updateTag(i, { color: css })}
            />
          </div>

          {/* Initial field (who only) */}
          {tag.type === "who" && (
            <input
              value={tag.initial ?? tag.name[0].toUpperCase()}
              onChange={(e) => updateTag(i, { initial: e.target.value.slice(0, 2).toUpperCase() })}
              maxLength={2}
              style={{
                width: 32,
                textAlign: "center",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 4,
                color: "#fff",
                fontSize: "0.78rem",
                fontWeight: 700,
                padding: "3px 0",
                fontFamily: "inherit",
                flexShrink: 0,
              }}
            />
          )}

          {/* Delete button */}
          <button
            onClick={() => deleteTag(i)}
            title={`Remove #${tag.name}`}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.3)",
              cursor: "pointer",
              fontSize: "0.9rem",
              padding: "0 2px",
              flexShrink: 0,
              fontFamily: "inherit",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Add Tags tab to SettingsModal**

In `components/SettingsModal.tsx`:

Add the import at the top:

```ts
import { TagSettingsForm } from "./TagSettingsForm"
```

Update the `TABS` constant:

```ts
const TABS = ["Theme", "Calendars", "Tags", "Behavior"] as const
```

In the tab content area (inside the `<div style={{ padding: "20px", overflowY: "auto", flex: 1 }}>` block), add the Tags tab panel after the `Calendars` panel and before the closing `</div>`:

```tsx
          {activeTab === "Tags" && (
            <TagSettingsForm
              tagConfigs={tagConfigs}
              onTagConfigsChange={onTagConfigsChange}
            />
          )}
```

- [ ] **Step 3: Verify in browser**

Open `http://localhost:4000`, click Settings gear, click the "Tags" tab.

- If tags have been auto-discovered, they should appear as rows with type dropdown, color picker, and delete button
- Changing a tag from "Category" to "Who" should show the initial field
- Changing a color should immediately update the calendar events
- If no tags exist, the empty state message should appear

- [ ] **Step 4: Commit**

```bash
git add components/TagSettingsForm.tsx components/SettingsModal.tsx
git commit -m "feat: add Tags settings tab for managing tag types and colors"
```

---

### Task 8: Build Verification and Final Polish

**Files:**
- None new — verification only

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (14 tests across `tags.test.ts`)

- [ ] **Step 2: Run production build**

Run: `npx next build`
Expected: Build succeeds with no errors

- [ ] **Step 3: End-to-end browser verification**

Open `http://localhost:4000` and verify:

1. Events with `#category` tags show the configured category color instead of connector color
2. Events with `#who` tags show initial badge circles on the right
3. Events with both show color + badges
4. Events with no tags render normally (unchanged from before)
5. Settings > Tags tab shows all discovered tags
6. Changing tag type from Category to Who shows initial field, and badge appears on events
7. Changing tag color immediately updates event colors on the calendar
8. Deleting a tag removes it; it re-appears with a fresh color when events reload
9. Tag configs persist across page refresh (localStorage)

- [ ] **Step 4: Commit any polish fixes**

If any adjustments were needed during verification:

```bash
git add -A
git commit -m "fix: polish tag rendering and settings UI"
```
