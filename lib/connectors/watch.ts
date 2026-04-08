import fs from "fs"
import type { ConnectorConfig, AgentApiConnector, IcalUrlConnector, LocalFileConnector } from "./types"

async function fingerprintAgentApi(config: AgentApiConnector): Promise<string> {
  const base = config.baseUrl.replace(/\/$/, "")
  const res = await fetch(`${base}/api/v1/calendars`, { cache: "no-store" })
  if (!res.ok) return ""
  const calendars = (await res.json()) as { slug: string; updatedAt: string }[]
  const cal = calendars.find((c) => c.slug === config.calendarSlug)
  return cal?.updatedAt ?? ""
}

async function fingerprintIcalUrl(config: IcalUrlConnector): Promise<string> {
  // Prefer HEAD + ETag/Last-Modified to avoid downloading the whole file
  try {
    const head = await fetch(config.url, { method: "HEAD", cache: "no-store" })
    const etag = head.headers.get("etag")
    const modified = head.headers.get("last-modified")
    if (etag || modified) return `${etag ?? ""}|${modified ?? ""}`
  } catch {
    // HEAD not supported — fall through to GET
  }
  const get = await fetch(config.url, { cache: "no-store" })
  if (!get.ok) return ""
  const text = await get.text()
  // Simple djb2 hash — good enough for change detection
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) & 0xffffffff
  return h.toString()
}

function fingerprintLocalFile(config: LocalFileConnector): string {
  try {
    const resolved = require("path").resolve(config.path)
    return fs.statSync(resolved).mtimeMs.toString()
  } catch {
    return ""
  }
}

export async function getFingerprint(config: ConnectorConfig): Promise<string> {
  switch (config.type) {
    case "agent-api":
      return fingerprintAgentApi(config)
    case "ical-url":
      return fingerprintIcalUrl(config)
    case "local-file":
      return fingerprintLocalFile(config)
    default: {
      const _exhaustive: never = config
      return ""
    }
  }
}
