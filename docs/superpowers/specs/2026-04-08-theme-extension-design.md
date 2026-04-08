# Theme Extension Design

**Date:** 2026-04-08
**Status:** Approved

## Overview

Extends the claw-calendar theme system with fallback backgrounds, additional color controls, UI icon sets, and per-connector event icon rules. Visual configuration stays in theme JSON files; event icon rules live in `calendar.config.json` alongside the connectors they describe.

---

## Schema Changes

### `CalendarTheme` — resolved (fully required, used at runtime)

```ts
interface CalendarTheme {
  name: string
  backgrounds: string[]
  fallbackBackground: string      // any valid CSS background value
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
    set: string                   // built-in icon set name, e.g. "lucide"
    overrides: Record<string, string>  // UI element name → icon name
  }
}
```

All color fields remain plain CSS strings (`rgba`, `#rrggbbaa`, `hsl`, etc.). No separate opacity fields.

### `ThemeInput` — raw JSON (all fields optional except `name`)

Same shape as `CalendarTheme` but every field except `name` is `Partial` / deeply optional. This is what `.theme.json` files are parsed into before merging.

### `CalendarConfig` — `calendar.config.json`

Each connector gains an optional `iconRules` field:

```ts
interface ConnectorConfig {
  // ...existing fields...
  iconRules?: Record<string, string>
}
```

The `__default` key is a reserved name within `iconRules` — it applies to all events on that connector. All other keys are matched case-insensitively against the event title.

---

## Theme File Conventions

### `default.theme.json`

Committed to the repo. Contains every field with sensible defaults. This is the base all other themes merge on top of. It must always be complete — the TypeScript compiler enforces this via the `CalendarTheme` type at load time.

### `*.theme.json` (individual themes)

Only need to specify overrides. A minimal theme file is valid:

```json
{
  "name": "dark",
  "calendar": {
    "eventBg": "rgba(120, 40, 200, 0.85)"
  }
}
```

### Example: `yosemite.theme.json` after migration

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

---

## Merge Architecture

```
themes/default.theme.json   ← base, all fields present
themes/yosemite.theme.json  ← overrides only
           │
           ▼
     loadThemes()
  1. Parse default.theme.json → base (CalendarTheme)
  2. For each other *.theme.json:
       deepMerge(base, input) → resolved CalendarTheme
  3. Validate resolved theme has all required fields
  4. Return Record<string, CalendarTheme>
```

### Merge rules

- **Plain objects** (`calendar`, `icons.overrides`): merged key-by-key one level deep — the theme only needs to supply the keys it wants to change
- **Arrays** (`backgrounds`): replace entirely — a theme that sets `backgrounds` replaces the default's array, it does not append
- **Primitives**: always replace

### Validation

Validation runs after merging (not on the raw JSON), so error messages are actionable: "missing field `calendar.cellBg` after merging with default" rather than "field required."

---

## Event Icon Rules

Icon rules live in `calendar.config.json` per connector:

```json
{
  "id": "family",
  "name": "Family",
  "color": "#3b82f6",
  "type": "agent-api",
  "baseUrl": "http://localhost:4200",
  "calendarSlug": "family",
  "iconRules": {
    "__default": "🏠",
    "doctor": "🏥",
    "dentist": "🦷",
    "birthday": "🎂",
    "gym": "💪",
    "flight": "✈️"
  }
}
```

### Resolution order (highest wins)

1. **iCal metadata** — `DESCRIPTION` starting with an emoji, or a custom `X-EVENT-ICON` property on the event
2. **First matching keyword** in `iconRules` — case-insensitive substring match against the event title
3. **`__default`** for that connector
4. **No icon** — event renders as plain text, same as today

The resolved icon is prepended to the event title in the calendar cell and shown in the event drawer.

`iconRules` is optional — connectors without it behave exactly as before.

---

## UI Icon Sets

The theme `icons` block selects a named built-in icon set and allows per-element overrides:

```json
"icons": {
  "set": "lucide",
  "overrides": {
    "prev": "chevron-left",
    "next": "chevron-right",
    "close": "x",
    "today": "calendar-check"
  }
}
```

**Named UI elements** (the keys valid in `overrides`):
`prev`, `next`, `today`, `close`, `viewMonth`, `viewWeek`, `viewDay`, `viewList`

**Supported icon sets** (initial): `lucide`

Additional sets can be added to the registry without changing the theme schema.

---

## Files Changed

| File | Change |
|------|--------|
| `themes/types.ts` | Add `ThemeInput` (partial), update `CalendarTheme` with new fields |
| `themes/index.ts` | Add `deepMerge`, load `default.theme.json` as base before resolving themes |
| `themes/default.theme.json` | New — complete baseline theme with all fields |
| `themes/yosemite.theme.json` | Slim down to only its overrides |
| `lib/connectors/types.ts` | Add `iconRules?: Record<string, string>` to `ConnectorConfig` base |
| `components/ThemeBackground.tsx` | Set `fallbackBackground` as `background` CSS on the wrapper div — visible through transparent image layers when images haven't loaded or fail |
| `components/Calendar.tsx` | Apply new CSS variables from expanded `calendar.*` fields; pass `theme` down to `EventDrawer` |
| `components/EventDrawer.tsx` | Accept `theme: CalendarTheme` prop; use `calendar.drawerBg` / `calendar.drawerBorder` instead of hardcoded values |
| `lib/icons/` | New — icon set registry + resolution logic |
| `lib/events/icons.ts` | New — event icon resolution from `iconRules` + iCal metadata |

---

## Out of Scope

- Runtime theme switching (no UI to pick a theme — change requires editing config + restart)
- Theme validation schema (JSON Schema / Zod) — can be added later
- More than one supported icon set at launch (Lucide only)
- Animated or per-event-category color overrides
