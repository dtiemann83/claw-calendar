# UI Redesign — Claw Calendar

**Date:** 2026-04-24

## Overview

Redesign the claw-calendar UI around three goals:
1. Make the voice interaction discoverable and visually compelling
2. Replace the settings modal with a full Settings tab that includes profile management
3. Keep the calendar as the dominant full-screen experience with minimal chrome

---

## 1. Navigation: Corner Pill Toggle

A two-segment pill sits in the **top-right corner**, replacing the existing gear icon in `CalendarToolbar`.

- **Left segment**: calendar icon — active on the Calendar tab
- **Right segment**: gear icon — active on the Settings tab
- Active segment is highlighted (white/semi-opaque); inactive is dim
- Switching tabs slides content in from the right
- On the Calendar tab the pill uses a glassy/frosted style so it doesn't compete with the animated background
- `CalendarToolbar` (prev/next/today, view switcher) remains unchanged; the pill replaces only the gear icon at the far right

---

## 2. Floating Mic Button

A circular glassy button anchored to the **bottom-right corner**, always visible regardless of active tab.

### Idle state
- Small, dim, semi-transparent circle with a mic icon
- Does not distract from calendar or settings content

### Activation (tap or wake word)
- Button animates: grows and floats to the **vertical and horizontal center of the screen**
- A semi-opaque dark backdrop fades in over the rest of the UI
- A frosted-glass conversation card appears **above** the button showing:
  - Current state label (Listening / Thinking / Speaking)
  - Transcript of what was said
  - Agent response text
  - Speaker name if identified (with "Not you?" correction affordance)
- `WakeWordIndicator` status moves into the conversation card (no longer a separate element)

### Dismissal
- Tapping the backdrop dismisses and animates the button back to the corner
- Auto-dismisses after the interaction completes (agent response played)

### Implementation notes
- The existing `VoiceSession` component moves out of `/voice/page.tsx` and into a new `FloatingVoiceButton` component rendered in the root layout so it is present on every page/tab
- The `/voice` route can be removed once the floating button is in place
- `useAudioServerWS` and `useWakeWordStream` hooks remain unchanged

---

## 3. Settings Tab

Activated by the pill toggle. Replaces `SettingsModal` entirely — the modal is removed.

### Layout
- **Left rail** (~220px): vertical list of section labels with icons
- **Content area** (remainder): swaps when a section is selected
- Same dark/glassy aesthetic as the rest of the app

### Sections

#### Profiles
- List of existing family members: color dot, name, creation date
- "Add member" button → navigates to existing `/profiles/new` enrollment flow
- Delete button per profile (with confirmation)
- Edit button per profile → inline name/color editing (no separate page needed)

#### Voice
- STT provider selector (`faster_whisper_local` | `openai_whisper_api` | `stub`)
- TTS provider selector (`apple_say` | `piper` | `stub`)
- Wake word provider selector (`open_wake_word` | `stub`)
- Wake word model name (text input)
- Wake word threshold slider (0–1)
- Speaker ID provider selector (`resemblyzer` | `stub`)
- Speaker ID threshold slider (0–1)
- Values read from a new `GET /api/settings/voice` endpoint; saved via `PATCH /api/settings/voice`
- Settings persist to `~/.config/claw-calendar/voice-settings.json`; env vars remain the fallback defaults when the file is absent
- Changing provider settings requires a manual pm2 restart (the UI shows a "Restart required" banner after saving)

#### Calendar
- Tag settings (moved from `TagSettingsForm` in `SettingsModal`)
- List of configured calendar connectors with enable/disable toggles (moved from `SettingsModal`)

#### Appearance
- Theme selector, font picker, brightness/saturation/hue sliders (moved from `ThemeSettingsForm` + `CollapsibleThemeSettings` in `SettingsModal`)

---

## 4. Removed / Retired

| Item | Action |
|------|--------|
| `SettingsModal` component | Removed — content moved to Settings tab |
| `app/voice/page.tsx` | Removed — voice UI moved to floating button |
| Gear icon in `CalendarToolbar` that opens modal | Replaced by pill toggle |

---

## 5. Component Map

| New / Changed | Description |
|---------------|-------------|
| `components/TabPill.tsx` | Two-segment pill toggle, top-right |
| `components/FloatingVoiceButton.tsx` | Persistent mic button + animated overlay + conversation card |
| `components/settings/SettingsLayout.tsx` | Left rail + content area shell |
| `components/settings/ProfilesSection.tsx` | Profile list with add/edit/delete |
| `components/settings/VoiceSection.tsx` | Voice provider settings form |
| `components/settings/CalendarSection.tsx` | Tags + connector toggles (from SettingsModal) |
| `components/settings/AppearanceSection.tsx` | Theme/font/overrides (from SettingsModal) |
| `app/api/settings/voice/route.ts` | GET/PATCH voice settings |
| `CalendarApp.tsx` | Add tab state, render TabPill, conditionally render calendar vs settings |

---

## 6. Out of Scope

- Per-user personality system (Phase 4) — separate spec
- PWA/kiosk mode (Phase 6) — separate spec
- Any new voice features beyond surfacing the existing ones
