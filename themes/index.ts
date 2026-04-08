import type { CalendarTheme } from "./types"
import { yosemiteTheme } from "./yosemite"

export const themes: Record<string, CalendarTheme> = {
  yosemite: yosemiteTheme,
}

export const defaultTheme = yosemiteTheme

export type { CalendarTheme }
