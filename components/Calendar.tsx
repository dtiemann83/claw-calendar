"use client"

import { useState, useEffect, useRef } from "react"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import listPlugin from "@fullcalendar/list"
import iCalendarPlugin from "@fullcalendar/icalendar"
import type { CalendarTheme } from "@/themes/types"
import type { ConnectorMeta } from "@/lib/connectors/types"

interface Props {
  theme: CalendarTheme
}

export function Calendar({ theme }: Props) {
  const { calendar: c } = theme
  const [eventSources, setEventSources] = useState<object[]>([])
  const calendarRef = useRef<FullCalendar>(null)

  // Load connector list once on mount
  useEffect(() => {
    fetch("/api/connectors")
      .then((res) => {
        if (!res.ok) throw new Error(`/api/connectors returned ${res.status}`)
        return res.json() as Promise<ConnectorMeta[]>
      })
      .then((connectors) => {
        setEventSources(
          connectors.map((conn) => ({
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
      // EventSource will automatically reconnect on error
      console.warn("[calendar] SSE connection lost, will reconnect automatically")
    }

    return () => es.close()
  }, [])

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
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, iCalendarPlugin]}
        initialView="dayGridMonth"
        height="100vh"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay,listMonth",
        }}
        eventSources={eventSources}
        eventDisplay="block"
      />
    </div>
  )
}
