import ical, { type ICalCalendar, type ICalEventData } from "ical-generator"
import type { CalendarEvent } from "./types.js"

const PROD_ID = { company: "claw", product: "calendar-core", language: "EN" }

export function serializeEvent(event: CalendarEvent): string {
  const cal = ical({ prodId: PROD_ID })
  addEvent(cal, event)
  return cal.toString()
}

export function serializeCalendar(events: CalendarEvent[], name?: string): string {
  const cal = ical({ prodId: PROD_ID, name })
  for (const ev of events) addEvent(cal, ev)
  return cal.toString()
}

function addEvent(cal: ICalCalendar, ev: CalendarEvent): void {
  const data: ICalEventData = {
    id: ev.uid,
    summary: ev.summary,
    start: ev.allDay ? parseDateOnly(ev.start) : new Date(ev.start),
    end: ev.allDay ? parseDateOnly(ev.end) : new Date(ev.end),
    allDay: ev.allDay,
  }
  if (ev.description) data.description = ev.description
  if (ev.location) data.location = ev.location
  cal.createEvent(data)
}

function parseDateOnly(s: string): Date {
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return new Date(s)
  const [, y, m, d] = match
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)))
}
