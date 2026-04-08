import type { EventApi } from "@fullcalendar/core"
import type { ConnectorMeta } from "@/lib/connectors/types"

/** Returns true if the string starts with an emoji character. */
function startsWithEmoji(str: string): boolean {
  return /^\p{Emoji_Presentation}/u.test(str.trimStart())
}

/** Extracts the leading emoji cluster from a string, or undefined. */
function extractLeadingEmoji(str: string): string | undefined {
  const match = str.trimStart().match(/^(\p{Emoji_Presentation}+)/u)
  return match?.[1]
}

/**
 * Resolves the display icon for a calendar event.
 *
 * Resolution order (highest priority first):
 * 1. X-EVENT-ICON custom iCal property (arrives in event.extendedProps)
 * 2. DESCRIPTION starting with an emoji
 * 3. First matching keyword rule in the connector's iconRules
 * 4. __default rule for the connector
 * 5. undefined — no icon, render event as plain text
 *
 * Requires event sources to have been created with `id: conn.id` so that
 * event.source?.id matches the connector id.
 */
export function resolveEventIcon(
  event: EventApi,
  connectors: ConnectorMeta[]
): string | undefined {
  // 1. X-EVENT-ICON custom property
  const xIcon = event.extendedProps?.["x-event-icon"] as string | undefined
  if (xIcon) return xIcon

  // 2. DESCRIPTION starting with emoji
  const description = event.extendedProps?.description as string | undefined
  if (description && startsWithEmoji(description)) {
    const emoji = extractLeadingEmoji(description)
    if (emoji) return emoji
  }

  // 3 & 4. iconRules on the matching connector (matched by event source id)
  const connector = connectors.find((c) => c.id === event.source?.id)
  if (!connector?.iconRules) return undefined

  const rules = connector.iconRules
  const title = event.title.toLowerCase()

  for (const [keyword, icon] of Object.entries(rules)) {
    if (keyword === "__default") continue
    if (title.includes(keyword.toLowerCase())) return icon
  }

  return rules["__default"]
}
