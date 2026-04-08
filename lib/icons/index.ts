import {
  ChevronLeft,
  ChevronRight,
  CalendarCheck,
  X,
  CalendarDays,
  CalendarRange,
  Calendar,
  List,
  type LucideIcon,
} from "lucide-react"
import type { CalendarTheme } from "@/themes/types"

// Default Lucide icons for each named UI element
const LUCIDE_SET: Record<string, LucideIcon> = {
  prev:      ChevronLeft,
  next:      ChevronRight,
  today:     CalendarCheck,
  close:     X,
  viewMonth: CalendarDays,
  viewWeek:  CalendarRange,
  viewDay:   Calendar,
  viewList:  List,
}

// Additional icons available as overrides by kebab-case name
const LUCIDE_ALL: Record<string, LucideIcon> = {
  ...LUCIDE_SET,
  "chevron-left":   ChevronLeft,
  "chevron-right":  ChevronRight,
  "calendar-check": CalendarCheck,
  "x":              X,
  "calendar-days":  CalendarDays,
  "calendar-range": CalendarRange,
  "calendar":       Calendar,
  "list":           List,
}

/**
 * Resolves the Lucide icon for a named UI element, respecting theme overrides.
 * Falls back to the default for that element, then to X if unknown.
 */
export function resolveIcon(
  elementKey: string,
  theme: Pick<CalendarTheme, "icons">
): LucideIcon {
  const overrideName = theme.icons.overrides[elementKey]
  if (overrideName && LUCIDE_ALL[overrideName]) {
    return LUCIDE_ALL[overrideName]
  }
  return LUCIDE_SET[elementKey] ?? X
}
