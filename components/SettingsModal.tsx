"use client"

import { useState } from "react"
import { SwitchRoot, SwitchHiddenInput, SwitchControl, SwitchThumb } from "@chakra-ui/react"
import type { CalendarTheme, ThemeOverrides } from "@/themes/types"
import type { ConnectorMeta } from "@/lib/connectors/types"
import { resolveIcon } from "@/lib/icons"

interface Props {
  open: boolean
  onClose: () => void
  theme: CalendarTheme
  themes: Record<string, CalendarTheme>
  currentThemeName: string
  onThemeChange: (name: string) => void
  connectors: ConnectorMeta[]
  hiddenConnectorIds: Set<string>
  onToggleConnector: (id: string) => void
  cycleIntervalMs: number
  onCycleIntervalChange: (ms: number) => void
  idleResetMs: number
  onIdleResetChange: (ms: number) => void
  themeOverrides: ThemeOverrides
  onOverrideChange: (patch: ThemeOverrides) => void
  onResetOverrides: () => void
}

const TABS = ["Theme", "Calendars", "Behavior"] as const
type Tab = typeof TABS[number]

export function SettingsModal({
  open,
  onClose,
  theme,
  themes,
  currentThemeName,
  onThemeChange,
  connectors,
  hiddenConnectorIds,
  onToggleConnector,
  cycleIntervalMs,
  onCycleIntervalChange,
  idleResetMs,
  onIdleResetChange,
  themeOverrides: _themeOverrides,
  onOverrideChange: _onOverrideChange,
  onResetOverrides: _onResetOverrides,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("Theme")

  if (!open) return null

  const { calendar: c } = theme
  const CloseIcon = resolveIcon("close", theme)

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(6px)",
          zIndex: 100,
        }}
      />

      {/* Panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(500px, 92vw)",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          background: c.drawerBg,
          backdropFilter: "blur(20px)",
          border: `1px solid ${c.drawerBorder}`,
          borderRadius: 12,
          color: "#fff",
          zIndex: 101,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 20px 0",
            flexShrink: 0,
          }}
        >
          <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>Settings</h2>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.6)",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
              borderRadius: 4,
            }}
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Tab bar */}
        <div
          style={{
            display: "flex",
            gap: 0,
            padding: "12px 20px 0",
            borderBottom: `1px solid ${c.drawerBorder}`,
            flexShrink: 0,
          }}
        >
          {TABS.map((tab) => {
            const isActive = tab === activeTab
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: "transparent",
                  border: "none",
                  borderBottom: `2px solid ${isActive ? "#fff" : "transparent"}`,
                  color: isActive ? "#fff" : "rgba(255,255,255,0.45)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: "0.88rem",
                  fontWeight: isActive ? 600 : 400,
                  padding: "6px 14px 10px",
                  marginBottom: -1,
                  transition: "color 0.15s, border-color 0.15s",
                  letterSpacing: "0.01em",
                }}
              >
                {tab}
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        <div style={{ padding: "20px", overflowY: "auto", flex: 1 }}>

          {activeTab === "Theme" && (
            <>
              <Section label="Theme">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                    gap: 8,
                  }}
                >
                  {Object.entries(themes).map(([name, t]) => {
                    const isActive = name === currentThemeName
                    return (
                      <button
                        key={name}
                        onClick={() => onThemeChange(name)}
                        style={{
                          border: `2px solid ${isActive ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.12)"}`,
                          borderRadius: 8,
                          overflow: "hidden",
                          cursor: "pointer",
                          padding: 0,
                          background: "none",
                          textAlign: "left",
                          transition: "border-color 0.15s",
                        }}
                      >
                        <div
                          style={{
                            height: 52,
                            background: t.fallbackBackground,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }}
                        />
                        <div
                          style={{
                            padding: "5px 8px",
                            background: isActive ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.45)",
                            color: "#fff",
                            fontSize: "0.78rem",
                            fontWeight: isActive ? 600 : 400,
                            textTransform: "capitalize",
                            fontFamily: "inherit",
                          }}
                        >
                          {name.replace(/-/g, " ")}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </Section>

              {theme.backgrounds.length > 0 && (() => {
                const activeIdx = CYCLE_PRESETS.findIndex((p) => p.ms === cycleIntervalMs)
                const idx = activeIdx === -1 ? 4 : activeIdx
                return (
                  <Section label="Photo Rotation">
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <input
                        type="range"
                        min={0}
                        max={CYCLE_PRESETS.length - 1}
                        step={1}
                        value={idx}
                        onChange={(e) => onCycleIntervalChange(CYCLE_PRESETS[parseInt(e.target.value, 10)].ms)}
                        className="claw-range"
                        style={{ width: "100%" }}
                      />
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        {CYCLE_PRESETS.map((p, i) => (
                          <span
                            key={p.ms}
                            onClick={() => onCycleIntervalChange(p.ms)}
                            style={{
                              fontSize: "0.65rem",
                              letterSpacing: "0.02em",
                              color: "#fff",
                              opacity: i === idx ? 1 : 0.3,
                              fontWeight: i === idx ? 700 : 400,
                              cursor: "pointer",
                              userSelect: "none",
                              transition: "opacity 0.15s",
                            }}
                          >
                            {p.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </Section>
                )
              })()}
            </>
          )}

          {activeTab === "Behavior" && (() => {
            const enabled = idleResetMs > 0
            const activeIdx = IDLE_PRESETS.findIndex((p) => p.ms === idleResetMs)
            const idx = activeIdx === -1 ? 3 : activeIdx
            return (
              <Section label="Idle View Reset">
                <p style={{ margin: "0 0 14px", fontSize: "0.82rem", opacity: 0.55, lineHeight: 1.5 }}>
                  Return to Month view after a period of inactivity.
                </p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: enabled ? 20 : 0 }}>
                  <span style={{ fontSize: "0.88rem", opacity: 0.85 }}>Enable</span>
                  <SwitchRoot
                    checked={enabled}
                    onCheckedChange={(e) => onIdleResetChange(e.checked ? IDLE_PRESETS[3].ms : 0)}
                    colorPalette="blue"
                    size="md"
                  >
                    <SwitchHiddenInput />
                    <SwitchControl>
                      <SwitchThumb />
                    </SwitchControl>
                  </SwitchRoot>
                </div>
                {enabled && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <input
                      type="range"
                      min={0}
                      max={IDLE_PRESETS.length - 1}
                      step={1}
                      value={idx}
                      onChange={(e) => onIdleResetChange(IDLE_PRESETS[parseInt(e.target.value, 10)].ms)}
                      className="claw-range"
                      style={{ width: "100%" }}
                    />
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      {IDLE_PRESETS.map((p, i) => (
                        <span
                          key={p.ms}
                          onClick={() => onIdleResetChange(p.ms)}
                          style={{
                            fontSize: "0.65rem",
                            letterSpacing: "0.02em",
                            color: "#fff",
                            opacity: i === idx ? 1 : 0.3,
                            fontWeight: i === idx ? 700 : 400,
                            cursor: "pointer",
                            userSelect: "none",
                            transition: "opacity 0.15s",
                          }}
                        >
                          {p.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </Section>
            )
          })()}

          {activeTab === "Calendars" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {connectors.length === 0 ? (
                <p style={{ margin: 0, opacity: 0.45, fontSize: "0.88rem" }}>No calendars connected.</p>
              ) : connectors.map((conn) => {
                const hidden = hiddenConnectorIds.has(conn.id)
                return (
                  <div
                    key={conn.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "9px 12px",
                      background: "rgba(255,255,255,0.06)",
                      borderRadius: 6,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: conn.color,
                          flexShrink: 0,
                          opacity: hidden ? 0.25 : 1,
                        }}
                      />
                      <span style={{ fontSize: "0.9rem", opacity: hidden ? 0.4 : 1, transition: "opacity 0.15s" }}>
                        {conn.name}
                      </span>
                    </div>
                    <button
                      onClick={() => onToggleConnector(conn.id)}
                      style={{
                        background: hidden ? "rgba(255,255,255,0.08)" : conn.color,
                        border: `1px solid ${hidden ? "rgba(255,255,255,0.18)" : conn.color}`,
                        borderRadius: 12,
                        padding: "3px 12px",
                        color: "#fff",
                        fontSize: "0.75rem",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        transition: "background 0.15s",
                      }}
                    >
                      {hidden ? "Show" : "Hide"}
                    </button>
                  </div>
                )
              })}
            </div>
          )}

        </div>
      </div>
    </>
  )
}

const IDLE_PRESETS = [
  { ms:       5_000, label:   "5s" },
  { ms:      10_000, label:  "10s" },
  { ms:      30_000, label:  "30s" },
  { ms:      60_000, label:   "1m" },
  { ms:     300_000, label:   "5m" },
  { ms:     600_000, label:  "10m" },
  { ms:     900_000, label:  "15m" },
  { ms:   1_800_000, label:  "30m" },
  { ms:   3_600_000, label:   "1h" },
]

const CYCLE_PRESETS = [
  { ms:       60_000, label:  "1m" },
  { ms:      300_000, label:  "5m" },
  { ms:      900_000, label: "15m" },
  { ms:    1_800_000, label: "30m" },
  { ms:    3_600_000, label:  "1h" },
  { ms:   10_800_000, label:  "3h" },
  { ms:   21_600_000, label:  "6h" },
  { ms:   43_200_000, label: "12h" },
  { ms:   86_400_000, label: "24h" },
]

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          fontSize: "0.68rem",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          opacity: 0.45,
          marginBottom: 10,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  )
}
