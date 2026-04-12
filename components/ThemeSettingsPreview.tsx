// components/ThemeSettingsPreview.tsx
import type { CalendarTheme } from "@/themes/types"

interface Props {
  theme: CalendarTheme
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

// 3 weeks × 7 cols of sample day data
const SAMPLE_DAYS = [
  { n: 30, otherMonth: true,  today: false, events: [] as string[] },
  { n: 31, otherMonth: true,  today: false, events: [] as string[] },
  { n:  1, otherMonth: false, today: false, events: [] as string[] },
  { n:  2, otherMonth: false, today: false, events: [] as string[] },
  { n:  3, otherMonth: false, today: false, events: [] as string[] },
  { n:  4, otherMonth: false, today: false, events: ["School pickup"] },
  { n:  5, otherMonth: false, today: false, events: [] as string[] },
  { n:  6, otherMonth: false, today: false, events: [] as string[] },
  { n:  7, otherMonth: false, today: false, events: ["Doctor appt"] },
  { n:  8, otherMonth: false, today: false, events: [] as string[] },
  { n:  9, otherMonth: false, today: true,  events: ["Family Meeting"] },
  { n: 10, otherMonth: false, today: false, events: [] as string[] },
  { n: 11, otherMonth: false, today: false, events: ["Date night"] },
  { n: 12, otherMonth: false, today: false, events: [] as string[] },
  { n: 13, otherMonth: false, today: false, events: [] as string[] },
  { n: 14, otherMonth: false, today: false, events: ["Pick up kids"] },
  { n: 15, otherMonth: false, today: false, events: [] as string[] },
  { n: 16, otherMonth: false, today: false, events: ["Dentist"] },
  { n: 17, otherMonth: false, today: false, events: [] as string[] },
  { n: 18, otherMonth: false, today: false, events: [] as string[] },
  { n: 19, otherMonth: false, today: false, events: [] as string[] },
]

export function ThemeSettingsPreview({ theme }: Props) {
  const c = theme.calendar

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          fontSize: "0.68rem",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          opacity: 0.35,
        }}
      >
        Preview
      </div>

      <div style={{ borderRadius: 6, overflow: "hidden" }}>
        {/* Day headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            background: c.headerBg,
          }}
        >
          {DAYS.map((d) => (
            <div
              key={d}
              style={{
                padding: "5px 4px",
                textAlign: "center",
                fontSize: "0.6rem",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: c.textColor,
                opacity: 0.5,
                fontWeight: 600,
              }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
          {SAMPLE_DAYS.map((day, i) => (
            <div
              key={i}
              style={{
                background: day.today ? c.todayBg : c.cellBg,
                borderRight: `1px solid ${c.cellBorder}`,
                borderBottom: `1px solid ${c.cellBorder}`,
                padding: "4px 5px",
                minHeight: 52,
                display: "flex",
                flexDirection: "column",
                gap: 3,
                ...(i % 7 === 6 ? { borderRight: "none" } : {}),
              }}
            >
              {day.today ? (
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: c.textColor,
                    color: "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.62rem",
                    fontWeight: 700,
                    flexShrink: 0,
                    filter: "invert(1)",
                  }}
                >
                  {day.n}
                </span>
              ) : (
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 500,
                    color: c.textColor,
                    opacity: day.otherMonth ? 0.2 : 1,
                    lineHeight: 1,
                  }}
                >
                  {day.n}
                </span>
              )}
              {day.events.map((ev) => (
                <div
                  key={ev}
                  style={{
                    background: c.eventBg,
                    borderLeft: `2px solid ${c.eventBorder}`,
                    borderRadius: 3,
                    padding: "2px 4px",
                    fontSize: "0.58rem",
                    color: "#fff",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    lineHeight: 1.3,
                  }}
                >
                  {ev}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {[
          { color: c.textColor, label: "Text color" },
          { color: c.todayBg, label: "Today highlight" },
          { color: c.cellBorder, label: "Cell border" },
          { color: c.eventBg, label: "Event color" },
          { color: c.headerBg, label: "Header background" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: color,
                border: "1px solid rgba(255,255,255,0.2)",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: "0.67rem", color: "rgba(255,255,255,0.4)", lineHeight: 1.3 }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
