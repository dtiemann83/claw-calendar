# Contextual Event Rendering Design

**Date:** 2026-04-12

**Goal:** Render calendar events with category-based background colors and "who" badges derived from hashtag metadata in Apple Calendar event descriptions, with a Settings UI for full customization.

**Chosen rendering treatments:**
- **Category Colors** — each category tag gets a distinct background color, overriding the connector color
- **Who Badges** — small initial circles showing which family members are involved

---

## 1. Tag Parsing & Data Model

### Parsing

A `parseEventTags()` function in `lib/events/tags.ts` extracts hashtags from the FullCalendar event's `extendedProps.description`. Tags are `#word` tokens — lowercase, no spaces, no special characters.

```ts
interface ParsedTags {
  categories: string[]  // e.g. ["sports", "medical"]
  who: string[]         // e.g. ["emma", "mom"]
  cleanText: string     // description with hashtags stripped
}

function parseEventTags(description: string, tagConfigs: TagConfig[]): ParsedTags
```

- Case-insensitive: `#Sports` normalizes to `sports`
- Only `#word` tokens matched (regex: `/#(\w+)/g`)
- Tag type (category vs who) determined by looking up the tag in `tagConfigs`
- Unknown tags default to category

### TagConfig Type

```ts
interface TagConfig {
  name: string        // "sports", "emma" (without #)
  type: "category" | "who"
  color: string       // CSS color — used for event bg (category) or badge bg (who)
  initial?: string    // for "who" tags — display letter(s), e.g. "E" for emma
}
```

### Storage

Tag configs persist in `localStorage` under key `claw:tagConfigs` as a `TagConfig[]` JSON array.

When the app encounters a hashtag not present in the config, it auto-adds it as:
- `type: "category"`
- `color`: next color from the default rotating palette
- `initial`: undefined (set by user when changing type to "who")

---

## 2. Event Rendering on the Grid

### Category Colors

In `renderEventContent`, when an event has a category tag with a configured color, that color replaces the connector color as the event chip background. If multiple category tags match, the **first one found** in the description wins.

### Who Badges

For each "who" tag on an event, a small circle renders at the right end of the event chip showing the configured initial(s). Badges stack horizontally.

### Rendering Layout

```
┌──────────────────────────────────────┐
│ icon Title text              [E]     │  ← category color bg, who badge
└──────────────────────────────────────┘
```

- Icons: unchanged, from existing `resolveEventIcon` system
- Category color: overrides connector `backgroundColor` on the event content wrapper
- Who badges: `flex-shrink: 0` circles, right-aligned, 18px diameter, white text on tag color background
- If no category tag matches: connector color preserved
- If only who tags: connector color preserved, badges shown

### Applying Category Color to the Event Element

`renderEventContent` controls the *inner* content of the event chip, not the `.fc-event` wrapper that holds the connector background color. To override the connector color with a category color:

Use `event.setProp('backgroundColor', categoryColor)` inside `renderEventContent`. FullCalendar applies this to the `.fc-event` element's inline style. The existing MutationObserver then picks up the new `rgb()` value and converts it to `rgba()` for opacity — no observer changes needed.

If `event.setProp` causes render loops, fall back to extending the MutationObserver to also check a `data-category-color` attribute set on the inner content wrapper, and apply it to the parent `.fc-event` element directly.

---

## 3. Settings UI — Tags Tab

### Location

A new **"Tags"** tab in the existing Settings modal, alongside Theme / Calendars / Behavior.

### Auto-Discovery

Tags are discovered via a `useEffect` that runs after events load or change — it scans all current FullCalendar events for hashtags, compares against the existing `tagConfigs`, and adds any new tags with default settings. This avoids mutating state during the render cycle. The effect runs in `CalendarApp` (or `Calendar`) and calls the parent's `onTagConfigsChange` to update state + localStorage.

### Tags Tab Layout

Each discovered tag shows as a row:

| Tag Name | Type Dropdown | Color Picker | Initial (who only) | Delete |
|----------|--------------|-------------|-------------------|--------|
| #sports  | Category v   | [green]     | —                 | X      |
| #medical | Category v   | [red]       | —                 | X      |
| #emma    | Who v        | [blue]      | E                 | X      |
| #mom     | Who v        | [purple]    | M                 | X      |

**Controls per row:**
- **Tag name**: read-only, discovered from events
- **Type dropdown**: "Category" or "Who" — uses Chakra `NativeSelect`
- **Color picker**: reuses existing `ColorRow` component from Theme settings
- **Initial field**: only visible when type is "who" — auto-populated from first letter of tag name (uppercase), editable
- **Delete button**: removes tag from config; if hashtag reappears in events, it gets re-discovered with fresh default color

**Empty state:** "No tags discovered yet. Add hashtags like #sports or #emma to your calendar event descriptions."

### Component

New file: `components/TagSettingsForm.tsx`

Props:
```ts
interface Props {
  tagConfigs: TagConfig[]
  onTagConfigsChange: (configs: TagConfig[]) => void
}
```

---

## 4. Integration & Data Flow

### End-to-End Flow

```
Apple Calendar description: "Basketball practice #sports #emma"
        |
        v
accli -> iCal DESCRIPTION property
        |
        v
FullCalendar extendedProps.description: "Basketball practice #sports #emma"
        |
        v
parseEventTags("Basketball practice #sports #emma", tagConfigs)
  -> { categories: ["sports"], who: ["emma"], cleanText: "Basketball practice" }
        |
        v
Look up tagConfigs from React state
  -> sports: { type: "category", color: "#22c55e" }
  -> emma: { type: "who", color: "#3b82f6", initial: "E" }
        |
        v
renderEventContent:
  - Background color: #22c55e (from #sports category)
  - Icon: (from existing resolveEventIcon, unchanged)
  - Title: "Basketball practice"
  - Who badge: [E] circle at right edge
```

### State Management

- `CalendarApp` owns `tagConfigs` state, loads from `localStorage` on mount
- `tagConfigs` passed down to `Calendar` (for rendering) and `SettingsModal` (for editing)
- When settings change, `CalendarApp` updates state + writes to `localStorage`
- FullCalendar re-renders event content automatically when `renderEventContent` dependencies change (tagConfigs added to dependency array)

### File Map

**New files:**
- `lib/events/tags.ts` — `parseEventTags()`, `TagConfig` type, default palette, auto-discovery logic
- `components/TagSettingsForm.tsx` — Tags tab UI

**Modified files:**
- `components/Calendar.tsx` — `renderEventContent` uses tag data for colors + badges
- `components/CalendarApp.tsx` — owns `tagConfigs` state, localStorage persistence, passes to children
- `components/SettingsModal.tsx` — adds Tags tab, receives/passes tagConfigs props

**Unchanged:**
- `lib/events/icons.ts` — icon resolution unchanged
- `themes/types.ts` — no theme type changes
- Server/API routes — no server changes, everything client-side

---

## 5. Default Palette & Edge Cases

### Default Palette

10-color rotating palette for auto-discovered tags:

| Index | Color   | Hex     |
|-------|---------|---------|
| 0     | Green   | #22c55e |
| 1     | Red     | #ef4444 |
| 2     | Yellow  | #eab308 |
| 3     | Blue    | #3b82f6 |
| 4     | Purple  | #a855f7 |
| 5     | Orange  | #f97316 |
| 6     | Cyan    | #06b6d4 |
| 7     | Pink    | #ec4899 |
| 8     | Lime    | #84cc16 |
| 9     | Indigo  | #6366f1 |

Each new tag gets the next color in sequence. Wraps after 10.

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| Multiple category tags on one event | First category tag in description wins for background color |
| Only who tags, no category | Connector color preserved, who badges shown |
| No tags at all | Current rendering unchanged |
| Unknown tag (not yet configured) | Auto-added as category with next palette color |
| Tag removed from all events | Stays in config until user deletes via Settings |
| Who tag with no initial set | Auto-populated from first letter of tag name, uppercased |
| Very long tag name | Displayed truncated in Settings, full match in parsing |
| Mixed case `#Sports` vs `#sports` | Normalized to lowercase, treated as same tag |
| Event chip too narrow for badges | Badges overflow hidden, title takes priority |
| Delete tag in Settings | Removed from config; re-discovered with fresh color if hashtag reappears |

---

## 6. Future Scope (Not in This Implementation)

These were discussed during brainstorming and deferred:

- **Category Icons** (option A) — emoji/icon per category tag on event chips
- **Category Border Accent** (option D) — colored left border strip per category
- **EventDrawer tag display** — show parsed tags in the event detail drawer
- **Tag-based filtering** — filter calendar view by tags
