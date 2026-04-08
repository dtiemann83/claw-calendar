import type { IcalUrlConnector } from "../types"

export async function fetchIcal(config: IcalUrlConnector): Promise<string> {
  const res = await fetch(config.url, { next: { revalidate: 300 } })

  if (!res.ok) {
    throw new Error(
      `ical-url connector "${config.id}": ${config.url} returned ${res.status} ${res.statusText}`
    )
  }

  return res.text()
}
