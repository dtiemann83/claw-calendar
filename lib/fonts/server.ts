import { loadFont } from "@/lib/connectors/registry"
import { fonts } from "./index"
import type { FontId } from "./index"

const DEFAULT_FONT: FontId = "nunito"

/** Resolves the active font from calendar.config.json, falling back to the default. Server-only. */
export function getActiveFont(): FontId {
  const configured = loadFont()
  if (configured && configured in fonts) return configured as FontId
  return DEFAULT_FONT
}
