import * as ical from "node-ical"
import type { IcalUrlConnector } from "../types"

/** Convert webcal://… to https://… — Node's fetch rejects the webcal scheme. */
export function toHttpUrl(url: string): string {
  if (url.startsWith("webcal://")) return "https://" + url.slice("webcal://".length)
  if (url.startsWith("webcals://")) return "https://" + url.slice("webcals://".length)
  return url
}

export async function fetchIcal(config: IcalUrlConnector): Promise<string> {
  const url = toHttpUrl(config.url)
  const res = await fetch(url, { next: { revalidate: 300 } })

  if (!res.ok) {
    throw new Error(
      `ical-url connector "${config.id}": ${url} returned ${res.status} ${res.statusText}`
    )
  }

  const text = await res.text()

  // Validate the feed by parsing it; surface parse errors early with connector context.
  try {
    await ical.async.parseICS(text)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`ical-url connector "${config.id}": failed to parse iCalendar from ${url} — ${msg}`)
  }

  return text
}
