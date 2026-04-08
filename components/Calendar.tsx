// components/Calendar.tsx
"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import listPlugin from "@fullcalendar/list"
import iCalendarPlugin from "@fullcalendar/icalendar"
import interactionPlugin from "@fullcalendar/interaction"
import type { DateClickArg } from "@fullcalendar/interaction"
import type { EventApi, EventClickArg, EventContentArg, DatesSetArg } from "@fullcalendar/core"
import type { CalendarTheme } from "@/themes/types"
import type { ConnectorMeta } from "@/lib/connectors/types"
import { resolveEventIcon } from "@/lib/events/icons"
import { CalendarToolbar } from "./CalendarToolbar"
import { EventDrawer } from "./EventDrawer"

interface Props {
  theme: CalendarTheme
}

export function Calendar({ theme }: Props) {
  const { calendar: c } = theme
  const [connectors, setConnectors] = useState<ConnectorMeta[]>([])
  const [eventSources, setEventSources] = useState<object[]>([])
  const [selectedEvent, setSelectedEvent] = useState<EventApi | null>(null)
  const [calendarTitle, setCalendarTitle] = useState("")
  const [currentView, setCurrentView] = useState("dayGridMonth")
  const calendarRef = useRef<FullCalendar>(null)

  // Load connector list once on mount
  useEffect(() => {
    fetch("/api/connectors")
      .then((res) => {
        if (!res.ok) throw new Error(`/api/connectors returned ${res.status}`)
        return res.json() as Promise<ConnectorMeta[]>
      })
      .then((data) => {
        setConnectors(data)
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

  const handleDateClick = useCallback((arg: DateClickArg) => {
    const api = calendarRef.current?.getApi()
    if (!api) return
    api.changeView("timeGridDay", arg.date)
  }, [])

  const handleEventClick = useCallback((arg: EventClickArg) => {
    arg.jsEvent.preventDefault()
    setSelectedEvent(arg.event)
  }, [])

  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    setCalendarTitle(arg.view.title)
    setCurrentView(arg.view.type)
  }, [])

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
          color: c.textColor,
        } as React.CSSProperties
      }
      className="fc-theme-wrapper"
    >
      <CalendarToolbar
        title={calendarTitle}
        currentView={currentView}
        theme={theme}
        onPrev={() => calendarRef.current?.getApi().prev()}
        onNext={() => calendarRef.current?.getApi().next()}
        onToday={() => calendarRef.current?.getApi().today()}
        onChangeView={(view) => calendarRef.current?.getApi().changeView(view)}
      />

      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, iCalendarPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={false}
        height="calc(100vh - 60px)"
        eventSources={eventSources}
        eventDisplay="block"
        dateClick={handleDateClick}
        eventClick={handleEventClick}
        datesSet={handleDatesSet}
        eventContent={renderEventContent}
      />

      <EventDrawer
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        theme={theme}
      />
    </div>
  )
}
