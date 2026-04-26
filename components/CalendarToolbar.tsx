"use client"

import { resolveIcon } from "@/lib/icons"
import type { CalendarTheme } from "@/themes/types"

interface Props {
  title: string
  currentView: string
  theme: CalendarTheme
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onChangeView: (view: string) => void
}

const VIEW_BUTTONS = [
  { key: "viewMonth", view: "dayGridMonth", label: "Month" },
  { key: "viewWeek",  view: "timeGridWeek", label: "Week"  },
  { key: "viewDay",   view: "timeGridDay",  label: "Day"   },
  { key: "viewList",  view: "listMonth",    label: "List"  },
]

export function CalendarToolbar({
  title,
  currentView,
  theme,
  onPrev,
  onNext,
  onToday,
  onChangeView,
}: Props) {
  const { calendar: c } = theme

  const btnBase: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 12px",
    background: c.toolbarButtonBg,
    border: `1px solid ${c.toolbarButtonBorder}`,
    borderRadius: 6,
    color: "#fff",
    cursor: "pointer",
    fontSize: "0.85rem",
    backdropFilter: "blur(4px)",
    transition: "background 0.15s",
    fontFamily: "inherit",
  }

  const btnActive: React.CSSProperties = {
    ...btnBase,
    background: "rgba(255,255,255,0.32)",
    borderColor: "rgba(255,255,255,0.5)",
  }

  const PrevIcon  = resolveIcon("prev",  theme)
  const NextIcon  = resolveIcon("next",  theme)
  const TodayIcon = resolveIcon("today", theme)

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: c.headerBg,
        backdropFilter: "blur(8px)",
        borderRadius: 8,
        padding: "8px 12px",
        marginBottom: 8,
      }}
    >
      {/* Left: today */}
      <div style={{ display: "flex", gap: 4 }}>
        <button style={btnBase} onClick={onToday} aria-label="Today">
          <TodayIcon size={16} />
          <span>Today</span>
        </button>
      </div>

      {/* Center: prev · title · next */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button style={btnBase} onClick={onPrev} aria-label="Previous">
          <PrevIcon size={16} />
        </button>
        <div
          style={{
            color: "#fff",
            fontSize: "1.4rem",
            fontWeight: 600,
            textShadow: "0 1px 4px rgba(0,0,0,0.6)",
            minWidth: "16rem",
            textAlign: "center",
          }}
        >
          {title}
        </div>
        <button style={btnBase} onClick={onNext} aria-label="Next">
          <NextIcon size={16} />
        </button>
      </div>

      {/* Right: view switcher */}
      <div style={{ display: "flex", gap: 4 }}>
        {VIEW_BUTTONS.map(({ key, view, label }) => {
          const Icon = resolveIcon(key, theme)
          const isActive = currentView === view
          return (
            <button
              key={key}
              style={isActive ? btnActive : btnBase}
              onClick={() => onChangeView(view)}
              aria-label={label}
              aria-pressed={isActive}
            >
              <Icon size={14} />
              <span>{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
