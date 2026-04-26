"use client"

import { TagSettingsForm } from "@/components/TagSettingsForm"
import type { TagConfig } from "@/lib/events/tags"
import type { ConnectorMeta } from "@/lib/connectors/types"
import { SwitchRoot, SwitchHiddenInput, SwitchControl, SwitchThumb } from "@chakra-ui/react"

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

interface Props {
  tagConfigs: TagConfig[]
  onTagConfigsChange: (configs: TagConfig[]) => void
  connectors: ConnectorMeta[]
  hiddenConnectorIds: Set<string>
  onToggleConnector: (id: string) => void
  idleResetMs: number
  onIdleResetChange: (ms: number) => void
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.4, marginBottom: 12 }}>
      {children}
    </div>
  )
}

export function CalendarSection({
  tagConfigs, onTagConfigsChange, connectors, hiddenConnectorIds, onToggleConnector,
  idleResetMs, onIdleResetChange,
}: Props) {
  const enabled = idleResetMs > 0
  const activeIdx = IDLE_PRESETS.findIndex((p) => p.ms === idleResetMs)
  const idx = activeIdx === -1 ? 3 : activeIdx

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {/* Calendars */}
      <div>
        <SectionLabel>Calendars</SectionLabel>
        {connectors.length === 0 ? (
          <p style={{ margin: 0, opacity: 0.45, fontSize: "0.88rem" }}>No calendars connected.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {connectors.map((conn) => {
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
                        width: 10, height: 10, borderRadius: "50%",
                        background: conn.color, flexShrink: 0,
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

      {/* Tags */}
      <div>
        <SectionLabel>Event Tags</SectionLabel>
        <TagSettingsForm tagConfigs={tagConfigs} onTagConfigsChange={onTagConfigsChange} />
      </div>

      {/* Idle reset */}
      <div>
        <SectionLabel>Idle View Reset</SectionLabel>
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
            <SwitchControl><SwitchThumb /></SwitchControl>
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
      </div>
    </div>
  )
}
