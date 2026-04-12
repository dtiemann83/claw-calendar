"use client"

import { useState, useEffect, useMemo } from "react"
import dynamic from "next/dynamic"
import type { CalendarTheme } from "@/themes/types"
import type { AllThemeOverrides, ThemeOverrides } from "@/themes/types"
import type { ConnectorMeta } from "@/lib/connectors/types"
import type { TagConfig } from "@/lib/events/tags"
import { ThemeBackground } from "./ThemeBackground"
import { SettingsModal } from "./SettingsModal"
import { loadAllOverrides, saveAllOverrides, mergeThemeOverrides } from "@/lib/themeOverrides"
import { fonts } from "@/lib/fonts"
import type { FontId } from "@/lib/fonts"

const Calendar = dynamic(
  () => import("@/components/Calendar").then((m) => m.Calendar),
  { ssr: false, loading: () => null }
)

const DEFAULT_THEME = "yosemite"
const LS_THEME_KEY = "claw:theme"
const LS_CYCLE_KEY = "claw:cycleInterval"
const LS_IDLE_KEY  = "claw:idleReset"
const LS_TAGS_KEY = "claw:tagConfigs"

interface Props {
  themes: Record<string, CalendarTheme>
  configuredFont?: string
}

export function CalendarApp({ themes, configuredFont }: Props) {
  const themeNames = Object.keys(themes)
  const [themeName, setThemeName] = useState(DEFAULT_THEME)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [connectors, setConnectors] = useState<ConnectorMeta[]>([])
  const [hiddenConnectorIds, setHiddenConnectorIds] = useState<Set<string>>(new Set())
  const [cycleIntervalMs, setCycleIntervalMs] = useState<number>(3_600_000)
  const [idleResetMs, setIdleResetMs] = useState<number>(0)
  const [allOverrides, setAllOverrides] = useState<AllThemeOverrides>({})
  const [tagConfigs, setTagConfigs] = useState<TagConfig[]>([])

  // Read saved preferences from localStorage after mount
  useEffect(() => {
    const savedTheme = localStorage.getItem(LS_THEME_KEY)
    if (savedTheme && themes[savedTheme]) setThemeName(savedTheme)

    const savedCycle = localStorage.getItem(LS_CYCLE_KEY)
    if (savedCycle) {
      setCycleIntervalMs(parseInt(savedCycle, 10))
    } else {
      const t = savedTheme && themes[savedTheme] ? themes[savedTheme] : themes[DEFAULT_THEME] ?? Object.values(themes)[0]
      setCycleIntervalMs(t.cycleIntervalMs)
    }

    const savedIdle = localStorage.getItem(LS_IDLE_KEY)
    if (savedIdle) setIdleResetMs(parseInt(savedIdle, 10))

    setAllOverrides(loadAllOverrides())

    const savedTags = localStorage.getItem(LS_TAGS_KEY)
    if (savedTags) {
      try { setTagConfigs(JSON.parse(savedTags)) } catch { /* ignore corrupt data */ }
    }
  }, [themes])

  const baseTheme = themes[themeName] ?? themes[themeNames[0]]

  const theme = useMemo(() => {
    const withCycle = { ...baseTheme, cycleIntervalMs }
    return mergeThemeOverrides(withCycle, allOverrides[themeName] ?? {})
  }, [baseTheme, cycleIntervalMs, allOverrides, themeName])

  // Apply font override to CSS variable whenever it changes
  useEffect(() => {
    if (theme.font && theme.font in fonts) {
      document.documentElement.style.setProperty(
        "--font-family",
        fonts[theme.font as FontId].family
      )
    } else if (configuredFont && configuredFont in fonts) {
      document.documentElement.style.setProperty(
        "--font-family",
        fonts[configuredFont as FontId].family
      )
    }
  }, [theme.font, configuredFont])

  const handleThemeChange = (name: string) => {
    setThemeName(name)
    localStorage.setItem(LS_THEME_KEY, name)
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

  const handleOverrideChange = (patch: ThemeOverrides) => {
    setAllOverrides((prev) => {
      const current = prev[themeName] ?? {}
      return {
        ...prev,
        [themeName]: {
          ...current,
          ...patch,
          calendar: patch.calendar
            ? { ...(current.calendar ?? {}), ...patch.calendar }
            : current.calendar,
        },
      }
    })
  }

  const handleResetOverrides = () => {
    setAllOverrides((prev) => {
      const next = { ...prev }
      delete next[themeName]
      return next
    })
  }

  // Persist overrides whenever they change (outside updater to avoid Strict Mode double-fire)
  useEffect(() => {
    saveAllOverrides(allOverrides)
  }, [allOverrides])

  useEffect(() => {
    localStorage.setItem(LS_TAGS_KEY, JSON.stringify(tagConfigs))
  }, [tagConfigs])

  const handleTagConfigsChange = (configs: TagConfig[]) => {
    setTagConfigs(configs)
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
        tagConfigs={tagConfigs}
        onTagConfigsChange={handleTagConfigsChange}
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
        themeOverrides={allOverrides[themeName] ?? {}}
        onOverrideChange={handleOverrideChange}
        onResetOverrides={handleResetOverrides}
        tagConfigs={tagConfigs}
        onTagConfigsChange={handleTagConfigsChange}
      />
    </main>
  )
}
