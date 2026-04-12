import { loadThemes } from "@/themes"
import { loadFont } from "@/lib/connectors/registry"
import { CalendarApp } from "@/components/CalendarApp"

export default function Home() {
  const themes = loadThemes()
  const configuredFont = loadFont()
  return <CalendarApp themes={themes} configuredFont={configuredFont} />
}
