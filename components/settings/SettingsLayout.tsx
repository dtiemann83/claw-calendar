"use client"

import { useState } from "react"
import { Users, Mic, CalendarDays, Palette } from "lucide-react"
import type { CalendarTheme, ThemeOverrides } from "@/themes/types"
import type { TagConfig } from "@/lib/events/tags"
import type { ConnectorMeta } from "@/lib/connectors/types"
import { ProfilesSection } from "./ProfilesSection"
import { VoiceSection } from "./VoiceSection"
import { CalendarSection } from "./CalendarSection"
import { AppearanceSection } from "./AppearanceSection"

type Section = "profiles" | "voice" | "calendar" | "appearance"

const SECTIONS: { id: Section; label: string; Icon: React.FC<{ size?: number }> }[] = [
  { id: "profiles",   label: "Profiles",   Icon: Users },
  { id: "voice",      label: "Voice",      Icon: Mic },
  { id: "calendar",   label: "Calendar",   Icon: CalendarDays },
  { id: "appearance", label: "Appearance", Icon: Palette },
]

export interface SettingsLayoutProps {
  theme: CalendarTheme
  themes: Record<string, CalendarTheme>
  currentThemeName: string
  onThemeChange: (name: string) => void
  themeOverrides: ThemeOverrides
  onOverrideChange: (patch: ThemeOverrides) => void
  onResetOverrides: () => void
  cycleIntervalMs: number
  onCycleIntervalChange: (ms: number) => void
  idleResetMs: number
  onIdleResetChange: (ms: number) => void
  tagConfigs: TagConfig[]
  onTagConfigsChange: (configs: TagConfig[]) => void
  connectors: ConnectorMeta[]
  hiddenConnectorIds: Set<string>
  onToggleConnector: (id: string) => void
}

export function SettingsLayout({
  theme,
  themes,
  currentThemeName,
  onThemeChange,
  themeOverrides,
  onOverrideChange,
  onResetOverrides,
  cycleIntervalMs,
  onCycleIntervalChange,
  idleResetMs,
  onIdleResetChange,
  tagConfigs,
  onTagConfigsChange,
  connectors,
  hiddenConnectorIds,
  onToggleConnector,
}: SettingsLayoutProps) {
  const [section, setSection] = useState<Section>("profiles")

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", paddingTop: 48 }}>
      {/* Left rail */}
      <div
        style={{
          width: 220,
          flexShrink: 0,
          background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(12px)",
          borderRight: "1px solid rgba(255,255,255,0.08)",
          padding: "16px 0",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {SECTIONS.map(({ id, label, Icon }) => {
          const isActive = section === id
          return (
            <button
              key={id}
              onClick={() => setSection(id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 16px",
                background: isActive ? "rgba(255,255,255,0.1)" : "transparent",
                border: "none",
                borderLeft: `3px solid ${isActive ? "rgba(255,255,255,0.6)" : "transparent"}`,
                color: isActive ? "#fff" : "rgba(255,255,255,0.45)",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "0.88rem",
                textAlign: "left",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              <Icon size={15} />
              {label}
            </button>
          )
        })}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 36px", color: "#fff" }}>
        {section === "profiles" && <ProfilesSection />}
        {section === "voice" && <VoiceSection />}
        {section === "calendar" && (
          <CalendarSection
            tagConfigs={tagConfigs}
            onTagConfigsChange={onTagConfigsChange}
            connectors={connectors}
            hiddenConnectorIds={hiddenConnectorIds}
            onToggleConnector={onToggleConnector}
            idleResetMs={idleResetMs}
            onIdleResetChange={onIdleResetChange}
          />
        )}
        {section === "appearance" && (
          <AppearanceSection
            theme={theme}
            themes={themes}
            currentThemeName={currentThemeName}
            onThemeChange={onThemeChange}
            themeOverrides={themeOverrides}
            onOverrideChange={onOverrideChange}
            onResetOverrides={onResetOverrides}
            cycleIntervalMs={cycleIntervalMs}
            onCycleIntervalChange={onCycleIntervalChange}
          />
        )}
      </div>
    </div>
  )
}
