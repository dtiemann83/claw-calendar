"use client"

import type { CalendarTheme, ThemeOverrides } from "@/themes/types"
import { CollapsibleThemeSettings } from "@/components/CollapsibleThemeSettings"

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

interface Props {
  theme: CalendarTheme
  themes: Record<string, CalendarTheme>
  currentThemeName: string
  onThemeChange: (name: string) => void
  themeOverrides: ThemeOverrides
  onOverrideChange: (patch: ThemeOverrides) => void
  onResetOverrides: () => void
  cycleIntervalMs: number
  onCycleIntervalChange: (ms: number) => void
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.4, marginBottom: 12 }}>
      {children}
    </div>
  )
}

export function AppearanceSection({
  theme, themes, currentThemeName, onThemeChange,
  themeOverrides, onOverrideChange, onResetOverrides,
  cycleIntervalMs, onCycleIntervalChange,
}: Props) {
  const { calendar: c } = theme
  const activeIdx = CYCLE_PRESETS.findIndex((p) => p.ms === cycleIntervalMs)
  const idx = activeIdx === -1 ? 4 : activeIdx

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <div>
        <SectionLabel>Theme</SectionLabel>
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
      </div>

      <CollapsibleThemeSettings
        theme={theme}
        overrides={themeOverrides}
        onOverrideChange={onOverrideChange}
        onReset={onResetOverrides}
        drawerBorder={c.drawerBorder}
      />

      {theme.backgrounds.length > 0 && (
        <div>
          <SectionLabel>Photo Rotation</SectionLabel>
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
        </div>
      )}
    </div>
  )
}
