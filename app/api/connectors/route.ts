import { loadConnectors } from "@/lib/connectors/registry"
import type { ConnectorMeta } from "@/lib/connectors/types"

export async function GET() {
  let connectors
  try {
    connectors = loadConnectors()
  } catch (err) {
    console.error("[GET /api/connectors] Failed to load config:", err)
    return Response.json(
      { error: "Failed to load calendar configuration" },
      { status: 500 }
    )
  }

  const meta: ConnectorMeta[] = connectors.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    proxyUrl: `/api/connectors/${c.id}`,
    ...(c.iconRules ? { iconRules: c.iconRules } : {}),
  }))

  return Response.json(meta)
}
