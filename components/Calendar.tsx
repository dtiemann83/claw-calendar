// components/Calendar.tsx
"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import listPlugin from "@fullcalendar/list"
import iCalendarPlugin from "@fullcalendar/icalendar"
import interactionPlugin from "@fullcalendar/interaction"
import type { EventApi, EventClickArg, EventContentArg, DatesSetArg, DayHeaderContentArg } from "@fullcalendar/core"
import type { CalendarTheme } from "@/themes/types"
import type { ConnectorMeta } from "@/lib/connectors/types"
import { resolveEventIcon } from "@/lib/events/icons"
import { CalendarToolbar } from "./CalendarToolbar"
import { EventDrawer } from "./EventDrawer"

interface Props {
  theme: CalendarTheme
  hiddenConnectorIds?: Set<string>
  onOpenSettings?: () => void
  onConnectorsLoaded?: (connectors: ConnectorMeta[]) => void
  idleResetMs?: number
}

const FADE_MS = 160

export function Calendar({ theme, hiddenConnectorIds, onOpenSettings, onConnectorsLoaded, idleResetMs }: Props) {
  const { calendar: c } = theme
  const [connectors, setConnectors] = useState<ConnectorMeta[]>([])
  const [eventSources, setEventSources] = useState<object[]>([])
  const [selectedEvent, setSelectedEvent] = useState<EventApi | null>(null)
  const [calendarTitle, setCalendarTitle] = useState("")
  const [currentView, setCurrentView] = useState("dayGridMonth")
  const [viewOpacity, setViewOpacity] = useState(1)
  const calendarRef = useRef<FullCalendar>(null)

  // Wrap any navigation action in a fade-out → act → fade-in sequence
  const navigate = useCallback((action: () => void) => {
    setViewOpacity(0)
    setTimeout(() => {
      action()
      // Double rAF: wait for FullCalendar to paint new content before fading in
      requestAnimationFrame(() => requestAnimationFrame(() => setViewOpacity(1)))
    }, FADE_MS)
  }, [])

  // Load connector list once on mount
  useEffect(() => {
    fetch("/api/connectors")
      .then((res) => {
        if (!res.ok) throw new Error(`/api/connectors returned ${res.status}`)
        return res.json() as Promise<ConnectorMeta[]>
      })
      .then((data) => {
        setConnectors(data)
        onConnectorsLoaded?.(data)
        setEventSources(
          data.map((conn) => ({
            id: conn.id,
            url: conn.proxyUrl,
            format: "ics",
            backgroundColor: conn.color,
            borderColor: conn.color,
          }))
        )
      })
      .catch((err) => {
        console.error("Failed to load calendar connectors:", err)
      })
  }, [])

  // Stream updates — refetch events when the server detects a change
  useEffect(() => {
    const es = new EventSource("/api/stream")

    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as { type: string }
        if (msg.type === "update") {
          calendarRef.current?.getApi().refetchEvents()
        }
      } catch {
        // malformed message — ignore
      }
    }

    es.onerror = () => {
      console.warn("[calendar] SSE connection lost, will reconnect automatically")
    }

    return () => es.close()
  }, [])

  // Idle view reset — navigate back to month view after inactivity
  useEffect(() => {
    if (!idleResetMs) return
    let timer: ReturnType<typeof setTimeout>
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        const api = calendarRef.current?.getApi()
        if (api) {
          navigate(() => {
            api.changeView("dayGridMonth")
            api.today()
          })
        }
      }, idleResetMs)
    }
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const
    events.forEach((e) => document.addEventListener(e, reset, { passive: true }))
    reset()
    return () => {
      clearTimeout(timer)
      events.forEach((e) => document.removeEventListener(e, reset))
    }
  }, [idleResetMs, navigate])

  const handleNavLinkDayClick = useCallback((date: Date) => {
    navigate(() => calendarRef.current?.getApi().changeView("timeGridDay", date))
  }, [navigate])

  const handleEventClick = useCallback((arg: EventClickArg) => {
    arg.jsEvent.preventDefault()
    setSelectedEvent(arg.event)
  }, [])

  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    setCalendarTitle(arg.view.title)
    setCurrentView(arg.view.type)
  }, [])

  const renderDayHeader = useCallback((arg: DayHeaderContentArg) => {
    if (!arg.view.type.startsWith("timeGrid")) return true
    const dayAbbr = arg.date.toLocaleDateString([], { weekday: "short" }).toUpperCase()
    const dayNum  = arg.date.getDate()
    const isDay   = arg.view.type === "timeGridDay"
    const canNav  = !isDay
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "6px 0", gap: 3 }}>
        <span style={{
          fontSize: "0.6rem",
          fontWeight: 700,
          letterSpacing: "0.1em",
          opacity: arg.isToday ? 0.9 : 0.45,
        }}>
          {isDay ? arg.date.toLocaleDateString([], { weekday: "long" }).toUpperCase() : dayAbbr}
        </span>
        <span
          onClick={canNav ? () => navigate(() => calendarRef.current?.getApi().changeView("timeGridDay", arg.date)) : undefined}
          style={{
            fontSize: isDay ? "1.6rem" : "1.25rem",
            fontWeight: 700,
            lineHeight: 1,
            width: "2rem",
            height: "2rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "50%",
            background: arg.isToday ? "rgba(255,255,255,0.22)" : "transparent",
            cursor: canNav ? "pointer" : "default",
          }}
        >
          {dayNum}
        </span>
      </div>
    )
  }, [navigate])

  const renderEventContent = useCallback(
    (arg: EventContentArg) => {
      const icon = resolveEventIcon(arg.event, connectors)
      if (!icon) return true // use FullCalendar's default rendering
      return (
        <div
          style={{
            overflow: "hidden",
            padding: "0 2px",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
          }}
        >
          <span style={{ marginRight: "0.2em" }}>{icon}</span>
          <span style={{ fontWeight: 500 }}>{arg.event.title}</span>
        </div>
      )
    },
    [connectors]
  )

  return (
    <div
      style={
        {
          "--fc-border-color": c.cellBorder,
          "--fc-today-bg-color": c.todayBg,
          "--fc-page-bg-color": "transparent",
          "--fc-neutral-bg-color": "transparent",
          "--fc-list-event-hover-bg-color": "rgba(255,255,255,0.1)",
          "--fc-event-bg-color": c.eventBg,
          "--fc-event-border-color": c.eventBorder,
          "--fc-event-text-color": "#fff",
          "--fc-now-indicator-color": "rgba(255,255,255,0.85)",
          color: c.textColor,
        } as React.CSSProperties
      }
      className="fc-theme-wrapper"
    >
      <CalendarToolbar
        title={calendarTitle}
        currentView={currentView}
        theme={theme}
        onPrev={() => navigate(() => calendarRef.current?.getApi().prev())}
        onNext={() => navigate(() => calendarRef.current?.getApi().next())}
        onToday={() => navigate(() => calendarRef.current?.getApi().today())}
        onChangeView={(view) => navigate(() => calendarRef.current?.getApi().changeView(view))}
        onOpenSettings={onOpenSettings ?? (() => {})}
      />

      <div style={{
        opacity: viewOpacity,
        transition: `opacity ${FADE_MS}ms ease`,
      }}>
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, iCalendarPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={false}
          height="calc(100vh - 60px)"
          eventSources={
            hiddenConnectorIds?.size
              ? eventSources.filter((s: any) => !hiddenConnectorIds.has(s.id))
              : eventSources
          }
          allDayText="Day"
          eventDisplay="block"
          navLinks={true}
          navLinkDayClick={handleNavLinkDayClick}
          eventClick={handleEventClick}
          datesSet={handleDatesSet}
          dayHeaderContent={renderDayHeader}
          eventContent={renderEventContent}
        />
      </div>

      <EventDrawer
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        theme={theme}
        connectors={connectors}
      />
    </div>
  )
}
