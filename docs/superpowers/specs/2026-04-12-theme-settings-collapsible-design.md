# Theme Settings Collapsible — Design Spec
**Date:** 2026-04-12

## Overview

Add a Chakra `Collapsible` section called "Theme Settings" to the Theme tab of the Settings dialog. It sits between the Themes grid and the Photo Rotation section, and exposes per-theme overrides for font, background overlay opacity, and all calendar colors. A live calendar cell preview on the right side of the collapsible updates as settings change.

---

## 1. Structure & Layout

- The Settings dialog widens from `min(500px, 92vw)` to `min(760px, 94vw)`.
- A new `CollapsibleThemeSettings` component is rendered inside the Theme tab, between the Themes grid and Photo Rotation.
- It uses Chakra `Collapsible.Root / Collapsible.Trigger / Collapsible.Content`. Starts collapsed by default.
- The collapsible body is a two-column CSS grid (`1fr 1fr`):
  - **Left**: form controls (font, overlay, color rows)
  - **Right**: live calendar cell preview + annotations

---

## 2. State & Persistence

### Shape
```ts
type ThemeOverrides = {
  font?: string
  backgroundOverlay?: string        // e.g. "rgba(0,0,0,0.6)"
  calendar?: Partial<CalendarTheme["calendar"]>
}

type AllThemeOverrides = Record<string, ThemeOverrides>  // keyed by theme name
```

### Storage
- `localStorage` key: `claw:themeOverrides`
- Serialized as JSON. Read once on mount in `CalendarApp`, stored in `allOverrides` state.

### Merging
- The resolved theme passed throughout the app is `deepMerge(baseTheme, overrides[themeName] ?? {})`.
- This is the same pattern `cycleIntervalMs` already uses — a `useMemo` in `CalendarApp` produces the final `theme` object.
- Font is a top-level key on the resolved theme (currently comes from server config; overrides take precedence).

### Reset
- "Reset to theme defaults" removes `allOverrides[currentThemeName]` from state and from localStorage.

### Props added to `SettingsModal`
```ts
themeOverrides: ThemeOverrides          // overrides for the current theme
onOverrideChange: (patch: ThemeOverrides) => void
```

`CalendarApp` handles merging the patch into `allOverrides`, persisting to localStorage, and re-computing the merged theme.

---

## 3. Controls

### Font
- Chakra `NativeSelect.Root / Field / Select` (or equivalent in Chakra v3 API).
- Options: `nunito`, `noto-serif`, `geist`, `noto-sans`, `arvo`, `lato` — matching the font packages already loaded.
- On change: calls `onOverrideChange({ font: value })`. The font is applied client-side by calling `document.documentElement.style.setProperty('--font-family', fonts[id].family)` — the same CSS variable that `app/layout.tsx` sets server-side. All font families are already loaded in the bundle via `lib/fonts/index.ts`; no additional imports needed.

### Background Overlay
- Chakra `Slider` from 0–100 (integer steps).
- Swatch preview (22×22px div) shows `rgba(0,0,0, value/100)`.
- Overlay color is always black; only opacity is adjustable.
- On change: calls `onOverrideChange({ backgroundOverlay: \`rgba(0,0,0,${value/100})\` })`.

### Calendar Colors
Eight rows, one per `CalendarTheme["calendar"]` key:

| Label | Key |
|---|---|
| Cell Background | `cellBg` |
| Cell Border | `cellBorder` |
| Text Color | `textColor` |
| Today Highlight | `todayBg` |
| Header Background | `headerBg` |
| Event Color | `eventBg` |
| Drawer Background | `drawerBg` |
| Toolbar Buttons | `toolbarButtonBg` |

Each row: colored swatch + label + edit icon. Clicking the row opens a Chakra `Popover` containing a `ColorPicker` with:
- Saturation/brightness gradient picker
- Hue slider
- Alpha slider
- Hex/rgba text input

The swatch in the row updates live as the picker changes (controlled via local state; `onOverrideChange` is called on every picker change for live preview).

### Reset Link
- Text link at bottom-right of the form column.
- Calls `onOverrideChange({})` with an empty object, which causes `CalendarApp` to delete the entry for the current theme.

---

## 4. Live Preview

A static HTML replica of a calendar month grid (no FullCalendar dependency), rendered entirely with inline styles derived from the current merged theme values. Sits in the right column of the collapsible.

**Elements shown:**
- Day-of-week header row — styled with `headerBg`
- 3 rows × 7 cells — styled with `cellBg`, `cellBorder`
- "Today" cell — styled with `todayBg`, `textColor`
- 4–5 sample event chips — styled with `eventBg`
- Day number text — styled with `textColor`

**Annotations** below the grid: small legend dots labeling which color each element uses.

The preview re-renders on every change — all styles are inline, so no CSS classes need updating.

---

## 5. Files Affected

| File | Change |
|---|---|
| `components/SettingsModal.tsx` | Widen dialog; add `CollapsibleThemeSettings` in Theme tab; new props |
| `components/CollapsibleThemeSettings.tsx` | New component: collapsible shell + two-column layout |
| `components/ThemeSettingsForm.tsx` | New component: font dropdown, overlay slider, color rows |
| `components/ThemeSettingsPreview.tsx` | New component: static calendar cell preview |
| `components/CalendarApp.tsx` | Add `allOverrides` state, persist to localStorage, deep-merge into theme, pass new props to `SettingsModal` |
| `themes/types.ts` | Add `font?: string` to `CalendarTheme` if not already present |

---

## 6. Out of Scope

- Color picker for `drawerBorder`, `eventBorder`, `toolbarButtonBorder` — not shown in the UI; can be added later.
- Exporting/importing theme overrides.
- Overlay color (non-black) — opacity only for now.
