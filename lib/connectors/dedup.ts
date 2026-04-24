/**
 * Deduplicate iCalendar data by removing timed events that are fully covered
 * by an all-day event with the same SUMMARY.
 *
 * This handles the common case where a calendar source emits both an all-day
 * VEVENT (e.g. DTSTART;VALUE=DATE:20260330) and a redundant midnight-timed
 * VEVENT (e.g. DTSTART:20260330T000000) for the same span.  The all-day
 * version is kept (rendered as a background highlight); the timed duplicate
 * is dropped so it does not appear as a solid event bar on top.
 */

import * as ical from "node-ical"

/** Convert a node-ical Date (possibly with .tz) to a YYYY-MM-DD string in the
 *  event's local timezone, falling back to UTC parts when no TZID is set. */
function toISODate(d: ical.DateWithTimeZone): string {
  if (d.tz) {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: d.tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d)
    } catch {
      // Fall through to UTC if tz isn't a valid IANA name
    }
  }
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function summaryString(s: ical.VEvent["summary"]): string {
  if (s == null) return ""
  return typeof s === "string" ? s : s.val ?? ""
}

function isAllDay(ev: ical.VEvent): boolean {
  if (ev.datetype === "date") return true
  if (ev.start && (ev.start as ical.DateWithTimeZone).dateOnly === true) return true
  return false
}

export function deduplicateIcal(icsText: string): string {
  let parsed: ical.CalendarResponse
  try {
    parsed = ical.sync.parseICS(icsText)
  } catch {
    // If the feed is unparseable, return it unchanged rather than dropping data.
    return icsText
  }

  const events: Array<{
    uid: string
    summary: string
    isAllDay: boolean
    startDate: string
    /** For all-day events: exclusive end date.  For timed: same as startDate. */
    endDate: string
  }> = []

  for (const [uid, comp] of Object.entries(parsed)) {
    if (!comp || comp.type !== "VEVENT") continue
    const ev = comp as ical.VEvent
    if (!ev.start) continue
    const allDay = isAllDay(ev)
    const startDate = toISODate(ev.start)
    const endDate = ev.end ? toISODate(ev.end) : startDate
    events.push({ uid, summary: summaryString(ev.summary), isAllDay: allDay, startDate, endDate })
  }

  const allDayEvents = events.filter((e) => e.isAllDay)
  const uidsToRemove = new Set<string>()

  for (const ev of events) {
    if (ev.isAllDay) continue
    for (const ad of allDayEvents) {
      if (ad.summary !== ev.summary) continue
      // All-day DTEND is exclusive: span is [startDate, endDate).
      if (ad.startDate <= ev.startDate && ev.startDate < ad.endDate) {
        uidsToRemove.add(ev.uid)
        break
      }
    }
  }

  if (uidsToRemove.size === 0) return icsText

  // Walk the raw ICS text, dropping VEVENT blocks whose UID is in uidsToRemove.
  // Split keeps VEVENT blocks intact as odd-indexed parts.
  const parts = icsText.split(/(BEGIN:VEVENT[\s\S]*?END:VEVENT\r?\n?)/)

  return parts
    .map((part) => {
      if (!part.startsWith("BEGIN:VEVENT")) return part
      // Unfold line-continuations so UID matching is reliable.
      const unfolded = part.replace(/\r?\n[ \t]/g, "")
      const uidMatch = unfolded.match(/^UID:(.+?)\r?$/m)
      if (uidMatch && uidsToRemove.has(uidMatch[1].trim())) return ""
      return part
    })
    .join("")
}
