import { describe, it, expect } from "vitest"
import { deduplicateIcal } from "./dedup"

function wrap(vevents: string): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//test//EN",
    vevents,
    "END:VCALENDAR",
    "",
  ].join("\r\n")
}

function vevent(opts: {
  uid: string
  summary: string
  start: string
  end?: string
  allDay?: boolean
}): string {
  const dt = opts.allDay ? "DTSTART;VALUE=DATE:" : "DTSTART:"
  const de = opts.allDay ? "DTEND;VALUE=DATE:" : "DTEND:"
  const lines = [
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    `SUMMARY:${opts.summary}`,
    `${dt}${opts.start}`,
  ]
  if (opts.end) lines.push(`${de}${opts.end}`)
  lines.push("END:VEVENT")
  return lines.join("\r\n")
}

describe("deduplicateIcal", () => {
  it("removes timed event fully covered by all-day event with same summary", () => {
    const ics = wrap(
      [
        vevent({
          uid: "all-day-1",
          summary: "Spring Break",
          start: "20260330",
          end: "20260404",
          allDay: true,
        }),
        vevent({
          uid: "timed-1",
          summary: "Spring Break",
          start: "20260330T000000",
          end: "20260330T010000",
        }),
      ].join("\r\n")
    )

    const result = deduplicateIcal(ics)
    expect(result).toContain("UID:all-day-1")
    expect(result).not.toContain("UID:timed-1")
  })

  it("keeps timed event when summary differs from all-day event", () => {
    const ics = wrap(
      [
        vevent({
          uid: "all-day-1",
          summary: "Spring Break",
          start: "20260330",
          end: "20260404",
          allDay: true,
        }),
        vevent({
          uid: "timed-1",
          summary: "Pickleball",
          start: "20260330T060000",
          end: "20260330T070000",
        }),
      ].join("\r\n")
    )

    const result = deduplicateIcal(ics)
    expect(result).toContain("UID:timed-1")
    expect(result).toContain("UID:all-day-1")
  })

  it("keeps timed event outside the all-day exclusive end boundary", () => {
    // All-day ends 20260404 (exclusive) — a timed event on the 4th must be kept
    const ics = wrap(
      [
        vevent({
          uid: "all-day-1",
          summary: "Spring Break",
          start: "20260330",
          end: "20260404",
          allDay: true,
        }),
        vevent({
          uid: "timed-1",
          summary: "Spring Break",
          start: "20260404T100000",
          end: "20260404T110000",
        }),
      ].join("\r\n")
    )

    const result = deduplicateIcal(ics)
    expect(result).toContain("UID:timed-1")
  })

  it("returns input unchanged when nothing is removed", () => {
    const ics = wrap(
      vevent({
        uid: "only-1",
        summary: "Lone Event",
        start: "20260330T100000",
        end: "20260330T110000",
      })
    )

    expect(deduplicateIcal(ics)).toBe(ics)
  })

  it("handles multiple timed duplicates of the same all-day event", () => {
    const ics = wrap(
      [
        vevent({
          uid: "all-day-1",
          summary: "Winter Break",
          start: "20251222",
          end: "20260103",
          allDay: true,
        }),
        vevent({
          uid: "timed-1",
          summary: "Winter Break",
          start: "20251222T000000",
        }),
        vevent({
          uid: "timed-2",
          summary: "Winter Break",
          start: "20251226T120000",
        }),
        vevent({
          uid: "timed-3",
          summary: "Winter Break",
          start: "20260102T000000",
        }),
      ].join("\r\n")
    )

    const result = deduplicateIcal(ics)
    expect(result).toContain("UID:all-day-1")
    expect(result).not.toContain("UID:timed-1")
    expect(result).not.toContain("UID:timed-2")
    expect(result).not.toContain("UID:timed-3")
  })

  it("returns input unchanged when ICS is unparseable", () => {
    const garbage = "this is not a calendar"
    expect(deduplicateIcal(garbage)).toBe(garbage)
  })

  it("preserves VCALENDAR wrapper and non-VEVENT content", () => {
    const ics = wrap(
      [
        vevent({
          uid: "all-day-1",
          summary: "Spring Break",
          start: "20260330",
          end: "20260404",
          allDay: true,
        }),
        vevent({
          uid: "timed-1",
          summary: "Spring Break",
          start: "20260330T000000",
        }),
      ].join("\r\n")
    )

    const result = deduplicateIcal(ics)
    expect(result).toMatch(/^BEGIN:VCALENDAR/)
    expect(result).toMatch(/END:VCALENDAR\r\n$/)
    expect(result).toContain("VERSION:2.0")
  })
})
