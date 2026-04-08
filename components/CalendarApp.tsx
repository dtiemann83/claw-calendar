"use client"

import { useState, useEffect, useMemo } from "react"
import dynamic from "next/dynamic"
import type { CalendarTheme } from "@/themes/types"
import type { ConnectorMeta } from "@/lib/connectors/types"
import { ThemeBackground } from "./ThemeBackground"
import { SettingsModal } from "./SettingsModal"

const Calendar = dynamic(
  () => import("@/components/Calendar").then((m) => m.Calendar),
  { ssr: false, loading: () => null }
)

const DEFAULT_THEME = "yosemite"
const LS_THEME_KEY = "claw:theme"
const LS_CYCLE_KEY = "claw:cycleInterval"
const LS_IDLE_KEY  = "claw:idleReset"

interface Props {
  themes: Record<string, CalendarTheme>
}

export function CalendarApp({ themes }: Props) {
  const themeNames = Object.keys(themes)
  const [themeName, setThemeName] = useState(DEFAULT_THEME)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [connectors, setConnectors] = useState<ConnectorMeta[]>([])
  const [hiddenConnectorIds, setHiddenConnectorIds] = useState<Set<string>>(new Set())
  const [cycleIntervalMs, setCycleIntervalMs] = useState<number>(3_600_000)
  const [idleResetMs, setIdleResetMs] = useState<number>(0)

  // Read saved preferences from localStorage after mount
  useEffect(() => {
    const savedTheme = localStorage.getItem(LS_THEME_KEY)
    if (savedTheme && themes[savedTheme]) setThemeName(savedTheme)

    const savedCycle = localStorage.getItem(LS_CYCLE_KEY)
    if (savedCycle) {
      setCycleIntervalMs(parseInt(savedCycle, 10))
    } else {
      // Fall back to whatever the active theme specifies
      const t = savedTheme && themes[savedTheme] ? themes[savedTheme] : themes[DEFAULT_THEME] ?? Object.values(themes)[0]
      setCycleIntervalMs(t.cycleIntervalMs)
    }

    const savedIdle = localStorage.getItem(LS_IDLE_KEY)
    if (savedIdle) setIdleResetMs(parseInt(savedIdle, 10))
  }, [themes])

  const baseTheme = themes[themeName] ?? themes[themeNames[0]]

  // Apply the user's cycle interval preference on top of the resolved theme
  const theme = useMemo(
    () => ({ ...baseTheme, cycleIntervalMs }),
    [baseTheme, cycleIntervalMs]
  )

  const handleThemeChange = (name: string) => {
    setThemeName(name)
    localStorage.setItem(LS_THEME_KEY, name)
    // When switching themes, reset cycle interval to that theme's default
    const newTheme = themes[name]
    if (newTheme) {
      setCycleIntervalMs(newTheme.cycleIntervalMs)
      localStorage.removeItem(LS_CYCLE_KEY)
    }
  }

  const handleCycleIntervalChange = (ms: number) => {
    setCycleIntervalMs(ms)
    localStorage.setItem(LS_CYCLE_KEY, String(ms))
  }

  const handleIdleResetChange = (ms: number) => {
    setIdleResetMs(ms)
    if (ms === 0) localStorage.removeItem(LS_IDLE_KEY)
    else localStorage.setItem(LS_IDLE_KEY, String(ms))
  }

  const handleToggleConnector = (id: string) => {
    setHiddenConnectorIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <main style={{ position: "relative", height: "100vh", overflow: "hidden" }}>
      <ThemeBackground theme={theme} />
      <Calendar
        theme={theme}
        hiddenConnectorIds={hiddenConnectorIds}
        onOpenSettings={() => setSettingsOpen(true)}
        onConnectorsLoaded={setConnectors}
        idleResetMs={idleResetMs}
      />
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        themes={themes}
        currentThemeName={themeName}
        onThemeChange={handleThemeChange}
        connectors={connectors}
        hiddenConnectorIds={hiddenConnectorIds}
        onToggleConnector={handleToggleConnector}
        cycleIntervalMs={cycleIntervalMs}
        onCycleIntervalChange={handleCycleIntervalChange}
        idleResetMs={idleResetMs}
        onIdleResetChange={handleIdleResetChange}
      />
    </main>
  )
}
