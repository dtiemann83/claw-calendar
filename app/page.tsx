import { loadThemes } from "@/themes"
import { CalendarApp } from "@/components/CalendarApp"

export default function Home() {
  const themes = loadThemes()
  return <CalendarApp themes={themes} />
}
