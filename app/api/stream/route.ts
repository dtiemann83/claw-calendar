import { loadConnectors } from "@/lib/connectors/registry"
import { getFingerprint } from "@/lib/connectors/watch"

const POLL_INTERVAL_MS = 10_000  // check for changes every 10s
const HEARTBEAT_MS     = 30_000  // keep-alive ping every 30s

export async function GET(request: Request) {
  const { signal } = request
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      // Seed initial fingerprints without triggering updates
      const fingerprints = new Map<string, string>()
      try {
        const connectors = loadConnectors()
        await Promise.all(
          connectors.map(async (c) => {
            fingerprints.set(c.id, await getFingerprint(c))
          })
        )
      } catch (err) {
        console.error("[stream] Failed to initialize fingerprints:", err)
      }

      send({ type: "connected" })

      const pollTimer = setInterval(async () => {
        let connectors
        try {
          connectors = loadConnectors()
        } catch {
          return // config temporarily unreadable — skip this tick
        }

        const changed: string[] = []

        await Promise.all(
          connectors.map(async (c) => {
            try {
              const fp = await getFingerprint(c)
              if (fp && fp !== fingerprints.get(c.id)) {
                fingerprints.set(c.id, fp)
                changed.push(c.id)
              }
            } catch {
              // Transient error — skip this connector this tick
            }
          })
        )

        if (changed.length > 0) {
          send({ type: "update", connectors: changed })
        }
      }, POLL_INTERVAL_MS)

      const heartbeatTimer = setInterval(() => {
        send({ type: "heartbeat" })
      }, HEARTBEAT_MS)

      signal.addEventListener("abort", () => {
        clearInterval(pollTimer)
        clearInterval(heartbeatTimer)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection":    "keep-alive",
      "X-Accel-Buffering": "no", // disable nginx buffering if proxied
    },
  })
}
