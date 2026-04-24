import { describe, it, expect } from "vitest"
import { serializeEvent } from "./serialize"

describe("serializeEvent", () => {
  it("emits DTSTART;VALUE=DATE for all-day events", () => {
    const ics = serializeEvent({
      uid: "twd",
      summary: "Teacher Work Day",
      start: "2026-04-20",
      end: "2026-04-21",
      allDay: true,
    })

    expect(ics).toMatch(/BEGIN:VCALENDAR/)
    expect(ics).toMatch(/UID:twd/)
    expect(ics).toMatch(/SUMMARY:Teacher Work Day/)
    expect(ics).toMatch(/DTSTART;VALUE=DATE:20260420/)
    expect(ics).toMatch(/DTEND;VALUE=DATE:20260421/)
  })

  it("emits timed DTSTART/DTEND for timed events", () => {
    const ics = serializeEvent({
      uid: "p1",
      summary: "Pickleball",
      start: "2026-04-19T17:00:00.000Z",
      end: "2026-04-19T18:00:00.000Z",
      allDay: false,
    })

    expect(ics).toMatch(/UID:p1/)
    expect(ics).toMatch(/DTSTART:20260419T170000Z/)
    expect(ics).toMatch(/DTEND:20260419T180000Z/)
    expect(ics).not.toMatch(/VALUE=DATE/)
  })

  it("includes description and location when provided", () => {
    const ics = serializeEvent({
      uid: "u1",
      summary: "Dinner",
      start: "2026-04-19T19:00:00.000Z",
      end: "2026-04-19T21:00:00.000Z",
      allDay: false,
      description: "#social #family",
      location: "Home",
    })

    expect(ics).toMatch(/DESCRIPTION:#social #family/)
    expect(ics).toMatch(/LOCATION:Home/)
  })
})
