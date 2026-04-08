import fs from "fs"
import path from "path"
import type { CalendarConfig, ConnectorConfig } from "./types"

const CONFIG_PATH = path.join(process.cwd(), "config", "calendar.config.json")
const EXAMPLE_PATH = path.join(process.cwd(), "config", "calendar.config.example.json")

function ensureConfigExists(): void {
  if (fs.existsSync(CONFIG_PATH)) return

  if (!fs.existsSync(EXAMPLE_PATH)) {
    throw new Error(
      `No calendar config found at ${CONFIG_PATH} and no example at ${EXAMPLE_PATH}.`
    )
  }

  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true })
  fs.copyFileSync(EXAMPLE_PATH, CONFIG_PATH)
  console.log(`[connectors] Created ${CONFIG_PATH} from example.`)
}

export function loadConnectors(): ConnectorConfig[] {
  ensureConfigExists()

  let raw: string
  try {
    raw = fs.readFileSync(CONFIG_PATH, "utf-8")
  } catch (err) {
    throw new Error(`Failed to read calendar config at ${CONFIG_PATH}: ${err}`)
  }

  let parsed: CalendarConfig
  try {
    parsed = JSON.parse(raw) as CalendarConfig
  } catch (err) {
    throw new Error(`Invalid JSON in ${CONFIG_PATH}: ${err}`)
  }

  if (!Array.isArray(parsed.connectors)) {
    throw new Error(`${CONFIG_PATH} must have a "connectors" array.`)
  }

  return parsed.connectors
}

export function findConnectorById(id: string): ConnectorConfig | undefined {
  return loadConnectors().find((c) => c.id === id)
}

export function loadFont(): string | undefined {
  ensureConfigExists()
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8")
    const parsed = JSON.parse(raw) as { font?: string }
    return parsed.font
  } catch {
    return undefined
  }
}
