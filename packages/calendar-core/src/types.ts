import { z } from "zod"

export const CalendarEventSchema = z.object({
  uid: z.string().min(1),
  summary: z.string(),
  description: z.string().optional(),
  location: z.string().optional(),
  /** ISO datetime (with offset) for timed; "YYYY-MM-DD" for allDay */
  start: z.string(),
  /** Same format as start. For allDay, DTEND is exclusive per RFC 5545. */
  end: z.string(),
  allDay: z.boolean().default(false),
  /** CalDAV resource URL — populated after add/list; required for update/delete */
  href: z.string().optional(),
  /** CalDAV etag — used for If-Match on update */
  etag: z.string().optional(),
})

export type CalendarEvent = z.infer<typeof CalendarEventSchema>

export const EventPatchSchema = CalendarEventSchema.partial().omit({ uid: true, href: true, etag: true })
export type EventPatch = z.infer<typeof EventPatchSchema>
