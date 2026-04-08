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
    backgroundOverlay: override.backgroundOverlay ?? base.backgroundOverlay,
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
