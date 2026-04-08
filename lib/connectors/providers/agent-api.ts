import type { AgentApiConnector } from "../types"

export async function fetchIcal(config: AgentApiConnector): Promise<string> {
  const base = config.baseUrl.replace(/\/$/, "")
  const url = `${base}/ical/${config.calendarSlug}.ics`

  const res = await fetch(url, { next: { revalidate: 300 } })

  if (!res.ok) {
    throw new Error(
      `agent-api connector "${config.id}": ${url} returned ${res.status} ${res.statusText}`
    )
  }

  return res.text()
}
