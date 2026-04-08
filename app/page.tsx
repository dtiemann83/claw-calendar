import { defaultTheme } from "@/themes"
import { ThemeBackground } from "@/components/ThemeBackground"
import { CalendarLoader } from "@/components/CalendarLoader"

export default function Home() {
  return (
    <main style={{ position: "relative", height: "100vh", overflow: "hidden" }}>
      <ThemeBackground theme={defaultTheme} />
      <CalendarLoader theme={defaultTheme} />
    </main>
  )
}
