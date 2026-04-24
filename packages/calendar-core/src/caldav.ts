import { DAVClient, type DAVCalendar, type DAVObject } from "tsdav"
import nodeIcalPkg from "node-ical"
import type * as nodeIcal from "node-ical"
import { getCredentials } from "./credentials.js"

const { sync: nodeIcalSync } = nodeIcalPkg
import { serializeEvent } from "./serialize.js"
import type { CalendarEvent, EventPatch } from "./types.js"

const ICLOUD_URL = "https://caldav.icloud.com/"

export interface CalendarClientOptions {
  calendarName: string
  /** Override server URL (for tests) */
  serverUrl?: string
  /** Override credentials resolver (for tests) */
  credentials?: { username: string; password: string }
  /** Override DAVClient factory (for tests) */
  clientFactory?: () => DAVClient
}

export class CalendarClient {
  private client: DAVClient
  private calendar: DAVCalendar | null = null
  private loggedIn = false

  constructor(private opts: CalendarClientOptions) {
    if (opts.clientFactory) {
      this.client = opts.clientFactory()
      return
    }
    const creds = opts.credentials ?? (() => {
      const { appleId, password } = getCredentials()
      return { username: appleId, password }
    })()
    this.client = new DAVClient({
      serverUrl: opts.serverUrl ?? ICLOUD_URL,
      credentials: creds,
      authMethod: "Basic",
      defaultAccountType: "caldav",
    })
  }

  private async ensureCalendar(): Promise<DAVCalendar> {
    if (this.calendar) return this.calendar
    if (!this.loggedIn) {
      await this.client.login()
      this.loggedIn = true
    }
    const calendars = await this.client.fetchCalendars()
    const target = this.opts.calendarName
    const found = calendars.find((c) => displayName(c) === target)
    if (!found) {
      const names = calendars.map((c) => displayName(c) || "(unnamed)").join(", ")
      throw new Error(`Calendar "${target}" not found. Available: ${names}`)
    }
    this.calendar = found
    return found
  }

  async list(rangeStart?: Date, rangeEnd?: Date): Promise<CalendarEvent[]> {
    const cal = await this.ensureCalendar()
    const objects = await this.client.fetchCalendarObjects({
      calendar: cal,
      ...(rangeStart && rangeEnd
        ? {
            timeRange: {
              start: rangeStart.toISOString(),
              end: rangeEnd.toISOString(),
            },
          }
        : {}),
    })
    return objects.flatMap((obj) => parseDavObject(obj))
  }

  async add(event: CalendarEvent): Promise<CalendarEvent> {
    const cal = await this.ensureCalendar()
    const iCalString = serializeEvent(event)
    const filename = `${event.uid}.ics`
    const res = await this.client.createCalendarObject({
      calendar: cal,
      filename,
      iCalString,
    })
    if (!res.ok) {
      throw new Error(`createCalendarObject failed: ${res.status} ${res.statusText}`)
    }
    const objectUrl = res.url || joinUrl(cal.url, filename)
    return {
      ...event,
      href: objectUrl,
      etag: res.headers.get("etag") ?? event.etag,
    }
  }

  async update(uid: string, patch: EventPatch): Promise<CalendarEvent> {
    const existing = await this.findByUid(uid)
    if (!existing) throw new Error(`Event not found: uid=${uid}`)
    if (!existing.href) throw new Error(`Event uid=${uid} missing href`)
    const merged: CalendarEvent = { ...existing, ...patch, uid }
    const iCalString = serializeEvent(merged)
    const res = await this.client.updateCalendarObject({
      calendarObject: {
        url: existing.href,
        etag: existing.etag ?? "",
        data: iCalString,
      },
    })
    if (!res.ok) {
      throw new Error(`updateCalendarObject failed: ${res.status} ${res.statusText}`)
    }
    return { ...merged, etag: res.headers.get("etag") ?? merged.etag }
  }

  async delete(uid: string): Promise<void> {
    const existing = await this.findByUid(uid)
    if (!existing) throw new Error(`Event not found: uid=${uid}`)
    if (!existing.href) throw new Error(`Event uid=${uid} missing href`)
    const res = await this.client.deleteCalendarObject({
      calendarObject: {
        url: existing.href,
        etag: existing.etag ?? "",
      },
    })
    if (!res.ok && res.status !== 404) {
      throw new Error(`deleteCalendarObject failed: ${res.status} ${res.statusText}`)
    }
  }

  async ctag(): Promise<string> {
    const cal = await this.ensureCalendar()
    return (cal as DAVCalendar & { ctag?: string }).ctag ?? ""
  }

  private async findByUid(uid: string): Promise<CalendarEvent | null> {
    const all = await this.list()
    return all.find((e) => e.uid === uid) ?? null
  }
}

function displayName(c: DAVCalendar): string {
  const dn = (c as DAVCalendar & { displayName?: string | { _text?: string } }).displayName
  if (typeof dn === "string") return dn
  if (dn && typeof dn === "object" && "_text" in dn) return dn._text ?? ""
  return ""
}

function joinUrl(base: string, suffix: string): string {
  if (base.endsWith("/")) return base + suffix
  return base + "/" + suffix
}

function parseDavObject(obj: DAVObject): CalendarEvent[] {
  const data = typeof obj.data === "string" ? obj.data : ""
  if (!data) return []
  const parsed = nodeIcalSync.parseICS(data)
  const events: CalendarEvent[] = []
  for (const comp of Object.values(parsed)) {
    if (!comp || (comp as { type?: string }).type !== "VEVENT") continue
    const ev = comp as nodeIcal.VEvent
    if (!ev.start) continue
    const allDay =
      ev.datetype === "date" ||
      (ev.start as nodeIcal.DateWithTimeZone & { dateOnly?: boolean }).dateOnly === true
    events.push({
      uid: typeof ev.uid === "string" ? ev.uid : String(ev.uid ?? ""),
      summary: typeof ev.summary === "string" ? ev.summary : (ev.summary as { val?: string })?.val ?? "",
      description:
        typeof ev.description === "string"
          ? ev.description
          : (ev.description as { val?: string } | undefined)?.val,
      location: typeof ev.location === "string" ? ev.location : undefined,
      start: formatDate(ev.start, allDay),
      end: ev.end ? formatDate(ev.end, allDay) : formatDate(ev.start, allDay),
      allDay,
      href: obj.url,
      etag: obj.etag,
    })
  }
  return events
}

function formatDate(d: nodeIcal.DateWithTimeZone, allDay: boolean): string {
  if (allDay) {
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, "0")
    const day = String(d.getUTCDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
  }
  return d.toISOString()
}
