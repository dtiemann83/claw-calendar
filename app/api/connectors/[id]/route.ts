import { findConnectorById } from "@/lib/connectors/registry"
import { dispatchFetchIcal } from "@/lib/connectors/dispatch"
import { deduplicateIcal } from "@/lib/connectors/dedup"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const connector = findConnectorById(id)

  if (!connector) {
    return new Response(`Connector not found: "${id}"`, { status: 404 })
  }

  let ical: string
  try {
    ical = deduplicateIcal(await dispatchFetchIcal(connector))
  } catch (err) {
    console.error(`[GET /api/connectors/${id}] Provider error:`, err)
    return new Response(
      `Failed to fetch calendar data for connector "${id}"`,
      { status: 502 }
    )
  }

  return new Response(ical, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  })
}
