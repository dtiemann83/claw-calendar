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
  if (typeof window === "undefined") return
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
