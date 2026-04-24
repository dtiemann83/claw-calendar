import { CalendarClient, serializeCalendar } from "@claw/calendar-core"
import type { CaldavConnector } from "../types"

/** Fetch events from iCloud CalDAV and render them back as a VCALENDAR string
 *  so existing consumers (FullCalendar, dedup) don't need to change.
 *
 *  Window: 90 days back, 2 years forward — matches what the old accli provider used. */
export async function fetchIcal(config: CaldavConnector): Promise<string> {
  const now = new Date()
  const start = new Date(now)
  start.setDate(start.getDate() - 90)
  const end = new Date(now)
  end.setFullYear(end.getFullYear() + 2)

  const client = new CalendarClient({ calendarName: config.calendarName })
  try {
    const events = await client.list(start, end)
    return serializeCalendar(events, config.name)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`caldav connector "${config.id}": ${msg}`)
  }
}
