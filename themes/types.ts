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
