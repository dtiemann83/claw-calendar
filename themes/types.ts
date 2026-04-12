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
  font?: string
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
