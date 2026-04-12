"use client"

import dynamic from "next/dynamic"
import type { CalendarTheme } from "@/themes/types"

const Calendar = dynamic(
  () => import("@/components/Calendar").then((m) => m.Calendar),
  { ssr: false, loading: () => null }
)

export function CalendarLoader({ theme }: { theme: CalendarTheme }) {
  return <Calendar theme={theme} tagConfigs={[]} onTagConfigsChange={() => {}} />
}
