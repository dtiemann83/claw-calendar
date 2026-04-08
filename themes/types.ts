export interface CalendarTheme {
  name: string
  backgrounds: string[]
  cycleIntervalMs: number
  calendar: {
    cellBg: string
    cellBorder: string
    textColor: string
    todayBg: string
    headerBg: string
    eventBg: string
    eventBorder: string
  }
}
