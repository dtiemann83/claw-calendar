import { describe, it, expect, vi, beforeEach } from "vitest"
import type { DAVCalendar, DAVCalendarObject, DAVClient } from "tsdav"
import { CalendarClient } from "./caldav"

function makeResponse(ok: boolean, opts: { etag?: string; url?: string; status?: number } = {}): Response {
  const headers = new Headers()
  if (opts.etag) headers.set("etag", opts.etag)
  const res = new Response(null, {
    status: opts.status ?? (ok ? 201 : 500),
    statusText: ok ? "Created" : "Error",
    headers,
  })
  if (opts.url) Object.defineProperty(res, "url", { value: opts.url })
  return res
}

function makeCalendar(displayName: string, url = "https://caldav.icloud.com/1/calendars/fam/"): DAVCalendar {
  return { url, displayName, ctag: "ctag-1" } as DAVCalendar
}

function makeDavObject(ics: string, url: string, etag = "etag-1"): DAVCalendarObject {
  return { url, etag, data: ics } as DAVCalendarObject
}

function wrapVEvent(body: string): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//test//EN",
    body,
    "END:VCALENDAR",
    "",
  ].join("\r\n")
}

interface MockClient extends Partial<DAVClient> {
  login: ReturnType<typeof vi.fn>
  fetchCalendars: ReturnType<typeof vi.fn>
  fetchCalendarObjects: ReturnType<typeof vi.fn>
  createCalendarObject: ReturnType<typeof vi.fn>
  updateCalendarObject: ReturnType<typeof vi.fn>
  deleteCalendarObject: ReturnType<typeof vi.fn>
}

function makeMockClient(): MockClient {
  return {
    login: vi.fn().mockResolvedValue(undefined),
    fetchCalendars: vi.fn(),
    fetchCalendarObjects: vi.fn(),
    createCalendarObject: vi.fn(),
    updateCalendarObject: vi.fn(),
    deleteCalendarObject: vi.fn(),
  }
}

describe("CalendarClient", () => {
  let mock: MockClient

  beforeEach(() => {
    mock = makeMockClient()
  })

  function newClient(calendarName = "Family") {
    return new CalendarClient({
      calendarName,
      clientFactory: () => mock as unknown as DAVClient,
    })
  }

  describe("calendar discovery", () => {
    it("finds calendar by displayName and caches it", async () => {
      mock.fetchCalendars.mockResolvedValue([makeCalendar("Family"), makeCalendar("Work")])
      mock.fetchCalendarObjects.mockResolvedValue([])

      const c = newClient()
      await c.list()
      await c.list()

      expect(mock.login).toHaveBeenCalledTimes(1)
      expect(mock.fetchCalendars).toHaveBeenCalledTimes(1)
    })

    it("throws with available calendar names when not found", async () => {
      mock.fetchCalendars.mockResolvedValue([makeCalendar("Work"), makeCalendar("Personal")])

      await expect(newClient("Family").list()).rejects.toThrow(/Family.*Work.*Personal/)
    })
  })

  describe("list", () => {
    it("parses timed events from DAV objects", async () => {
      mock.fetchCalendars.mockResolvedValue([makeCalendar("Family")])
      mock.fetchCalendarObjects.mockResolvedValue([
        makeDavObject(
          wrapVEvent(
            [
              "BEGIN:VEVENT",
              "UID:timed-1",
              "SUMMARY:Soccer",
              "DTSTART:20260419T170000Z",
              "DTEND:20260419T180000Z",
              "END:VEVENT",
            ].join("\r\n")
          ),
          "https://caldav.icloud.com/1/calendars/fam/timed-1.ics"
        ),
      ])

      const events = await newClient().list()
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        uid: "timed-1",
        summary: "Soccer",
        allDay: false,
        href: "https://caldav.icloud.com/1/calendars/fam/timed-1.ics",
        etag: "etag-1",
      })
    })

    it("parses all-day events with date-only DTSTART", async () => {
      mock.fetchCalendars.mockResolvedValue([makeCalendar("Family")])
      mock.fetchCalendarObjects.mockResolvedValue([
        makeDavObject(
          wrapVEvent(
            [
              "BEGIN:VEVENT",
              "UID:allday-1",
              "SUMMARY:Teacher Work Day",
              "DTSTART;VALUE=DATE:20260420",
              "DTEND;VALUE=DATE:20260421",
              "END:VEVENT",
            ].join("\r\n")
          ),
          "https://caldav.icloud.com/1/calendars/fam/allday-1.ics"
        ),
      ])

      const events = await newClient().list()
      expect(events[0]).toMatchObject({
        uid: "allday-1",
        summary: "Teacher Work Day",
        allDay: true,
        start: "2026-04-20",
        end: "2026-04-21",
      })
    })
  })

  describe("add", () => {
    it("PUTs a serialized timed event and returns href + etag", async () => {
      mock.fetchCalendars.mockResolvedValue([makeCalendar("Family")])
      mock.createCalendarObject.mockResolvedValue(
        makeResponse(true, { etag: "etag-new", url: "https://caldav.icloud.com/1/calendars/fam/new-uid.ics" })
      )

      const result = await newClient().add({
        uid: "new-uid",
        summary: "Pickleball",
        start: "2026-04-19T17:00:00.000Z",
        end: "2026-04-19T18:00:00.000Z",
        allDay: false,
      })

      expect(mock.createCalendarObject).toHaveBeenCalledTimes(1)
      const call = mock.createCalendarObject.mock.calls[0][0]
      expect(call.filename).toBe("new-uid.ics")
      expect(call.iCalString).toMatch(/BEGIN:VCALENDAR/)
      expect(call.iCalString).toMatch(/UID:new-uid/)
      expect(call.iCalString).toMatch(/SUMMARY:Pickleball/)
      expect(result.href).toBe("https://caldav.icloud.com/1/calendars/fam/new-uid.ics")
      expect(result.etag).toBe("etag-new")
    })

    it("serializes all-day events with DTSTART;VALUE=DATE", async () => {
      mock.fetchCalendars.mockResolvedValue([makeCalendar("Family")])
      mock.createCalendarObject.mockResolvedValue(
        makeResponse(true, { etag: "e1", url: "https://caldav.icloud.com/1/calendars/fam/twd.ics" })
      )

      await newClient().add({
        uid: "twd",
        summary: "Teacher Work Day",
        start: "2026-04-20",
        end: "2026-04-21",
        allDay: true,
      })

      const call = mock.createCalendarObject.mock.calls[0][0]
      expect(call.iCalString).toMatch(/DTSTART;VALUE=DATE:20260420/)
      expect(call.iCalString).toMatch(/DTEND;VALUE=DATE:20260421/)
    })

    it("throws on non-ok response", async () => {
      mock.fetchCalendars.mockResolvedValue([makeCalendar("Family")])
      mock.createCalendarObject.mockResolvedValue(
        new Response(null, { status: 403, statusText: "Forbidden" })
      )

      await expect(
        newClient().add({
          uid: "x",
          summary: "x",
          start: "2026-04-19T17:00:00.000Z",
          end: "2026-04-19T18:00:00.000Z",
          allDay: false,
        })
      ).rejects.toThrow(/403 Forbidden/)
    })
  })

  describe("update", () => {
    it("finds by UID and PUTs merged event", async () => {
      mock.fetchCalendars.mockResolvedValue([makeCalendar("Family")])
      mock.fetchCalendarObjects.mockResolvedValue([
        makeDavObject(
          wrapVEvent(
            [
              "BEGIN:VEVENT",
              "UID:target-uid",
              "SUMMARY:Old Title",
              "DTSTART;VALUE=DATE:20260420",
              "DTEND;VALUE=DATE:20260421",
              "END:VEVENT",
            ].join("\r\n")
          ),
          "https://caldav.icloud.com/1/calendars/fam/target-uid.ics",
          "old-etag"
        ),
      ])
      mock.updateCalendarObject.mockResolvedValue(makeResponse(true, { etag: "new-etag", status: 204 }))

      const result = await newClient().update("target-uid", { summary: "New Title" })

      const call = mock.updateCalendarObject.mock.calls[0][0]
      expect(call.calendarObject.url).toBe("https://caldav.icloud.com/1/calendars/fam/target-uid.ics")
      expect(call.calendarObject.etag).toBe("old-etag")
      expect(call.calendarObject.data).toMatch(/SUMMARY:New Title/)
      expect(call.calendarObject.data).toMatch(/UID:target-uid/)
      expect(result.etag).toBe("new-etag")
    })

    it("converts timed event to all-day (Teacher Work Day regression)", async () => {
      mock.fetchCalendars.mockResolvedValue([makeCalendar("Family")])
      mock.fetchCalendarObjects.mockResolvedValue([
        makeDavObject(
          wrapVEvent(
            [
              "BEGIN:VEVENT",
              "UID:twd",
              "SUMMARY:Teacher Work Day",
              "DTSTART:20260420T000000Z",
              "DTEND:20260420T010000Z",
              "END:VEVENT",
            ].join("\r\n")
          ),
          "https://caldav.icloud.com/1/calendars/fam/twd.ics"
        ),
      ])
      mock.updateCalendarObject.mockResolvedValue(makeResponse(true, { etag: "e2", status: 204 }))

      await newClient().update("twd", {
        allDay: true,
        start: "2026-04-20",
        end: "2026-04-21",
      })

      const call = mock.updateCalendarObject.mock.calls[0][0]
      expect(call.calendarObject.data).toMatch(/DTSTART;VALUE=DATE:20260420/)
      expect(call.calendarObject.data).toMatch(/DTEND;VALUE=DATE:20260421/)
    })

    it("throws when event uid not found", async () => {
      mock.fetchCalendars.mockResolvedValue([makeCalendar("Family")])
      mock.fetchCalendarObjects.mockResolvedValue([])
      await expect(newClient().update("missing", { summary: "X" })).rejects.toThrow(/missing/)
    })
  })

  describe("delete", () => {
    it("finds by UID and DELETEs", async () => {
      mock.fetchCalendars.mockResolvedValue([makeCalendar("Family")])
      mock.fetchCalendarObjects.mockResolvedValue([
        makeDavObject(
          wrapVEvent(
            [
              "BEGIN:VEVENT",
              "UID:del-me",
              "SUMMARY:Gone",
              "DTSTART:20260419T170000Z",
              "DTEND:20260419T180000Z",
              "END:VEVENT",
            ].join("\r\n")
          ),
          "https://caldav.icloud.com/1/calendars/fam/del-me.ics",
          "e-del"
        ),
      ])
      mock.deleteCalendarObject.mockResolvedValue(makeResponse(true, { status: 204 }))

      await newClient().delete("del-me")

      const call = mock.deleteCalendarObject.mock.calls[0][0]
      expect(call.calendarObject.url).toBe("https://caldav.icloud.com/1/calendars/fam/del-me.ics")
      expect(call.calendarObject.etag).toBe("e-del")
    })

    it("does not throw when server returns 404", async () => {
      mock.fetchCalendars.mockResolvedValue([makeCalendar("Family")])
      mock.fetchCalendarObjects.mockResolvedValue([
        makeDavObject(
          wrapVEvent(
            [
              "BEGIN:VEVENT",
              "UID:gone",
              "SUMMARY:Gone",
              "DTSTART:20260419T170000Z",
              "DTEND:20260419T180000Z",
              "END:VEVENT",
            ].join("\r\n")
          ),
          "https://caldav.icloud.com/1/calendars/fam/gone.ics"
        ),
      ])
      mock.deleteCalendarObject.mockResolvedValue(new Response(null, { status: 404, statusText: "Not Found" }))

      await expect(newClient().delete("gone")).resolves.toBeUndefined()
    })
  })

  describe("ctag", () => {
    it("returns ctag from discovered calendar", async () => {
      const cal = makeCalendar("Family")
      ;(cal as DAVCalendar & { ctag?: string }).ctag = "ctag-xyz"
      mock.fetchCalendars.mockResolvedValue([cal])
      expect(await newClient().ctag()).toBe("ctag-xyz")
    })
  })
})
