"use client"

import { CalendarDays, Settings } from "lucide-react"

export type Tab = "calendar" | "settings"

interface Props {
  tab: Tab
  onChange: (tab: Tab) => void
}

export function TabPill({ tab, onChange }: Props) {
  return (
    <div
      style={{
        position: "fixed",
        top: 12,
        right: 12,
        zIndex: 50,
        display: "flex",
        background: "rgba(0,0,0,0.35)",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: 20,
        padding: 3,
        gap: 2,
      }}
    >
      {(["calendar", "settings"] as Tab[]).map((t) => {
        const isActive = tab === t
        const Icon = t === "calendar" ? CalendarDays : Settings
        const label = t === "calendar" ? "Calendar" : "Settings"
        return (
          <button
            key={t}
            onClick={() => onChange(t)}
            style={{
              background: isActive ? "rgba(255,255,255,0.2)" : "transparent",
              border: "none",
              borderRadius: 16,
              color: isActive ? "#fff" : "rgba(255,255,255,0.45)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 10px",
              fontSize: "0.8rem",
              fontFamily: "inherit",
              transition: "background 0.15s, color 0.15s",
            }}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
