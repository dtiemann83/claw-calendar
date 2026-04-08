import { loadDefaultTheme } from "@/themes"
import { ThemeBackground } from "@/components/ThemeBackground"
import { CalendarLoader } from "@/components/CalendarLoader"

export default function Home() {
  const theme = loadDefaultTheme()

  return (
    <main style={{ position: "relative", height: "100vh", overflow: "hidden" }}>
      <ThemeBackground theme={theme} />
      <CalendarLoader theme={theme} />
    </main>
  )
}
