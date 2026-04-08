import { NextResponse } from "next/server"

const ICAL_URL = process.env.ICAL_URL ?? "http://localhost:4200/ical/family.ics"

export async function GET() {
  const res = await fetch(ICAL_URL, { next: { revalidate: 300 } })

  if (!res.ok) {
    return new NextResponse("Failed to fetch calendar", { status: 502 })
  }

  const ical = await res.text()

  return new NextResponse(ical, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  })
}
