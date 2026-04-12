// lib/events/tags.ts

export interface TagConfig {
  name: string
  type: "category" | "who"
  color: string
  initial?: string
}

export interface ParsedTags {
  categories: string[]
  who: string[]
  cleanText: string
}

export const DEFAULT_PALETTE = [
  "#22c55e", "#ef4444", "#eab308", "#3b82f6", "#a855f7",
  "#f97316", "#06b6d4", "#ec4899", "#84cc16", "#6366f1",
]

const TAG_REGEX = /#(\w+)/g

export function parseEventTags(
  description: string | undefined | null,
  tagConfigs: TagConfig[]
): ParsedTags {
  if (!description) return { categories: [], who: [], cleanText: "" }

  const configMap = new Map(tagConfigs.map((c) => [c.name, c]))
  const categories: string[] = []
  const who: string[] = []

  const matches = [...description.matchAll(TAG_REGEX)]
  for (const match of matches) {
    const tag = match[1].toLowerCase()
    const config = configMap.get(tag)
    if (config?.type === "who") {
      who.push(tag)
    } else {
      categories.push(tag)
    }
  }

  const cleanText = description
    .replace(TAG_REGEX, "")
    .replace(/\s+/g, " ")
    .trim()

  return { categories, who, cleanText }
}

export function discoverNewTags(
  descriptions: (string | undefined | null)[],
  existing: TagConfig[]
): TagConfig[] {
  const known = new Set(existing.map((c) => c.name))
  const seen = new Set<string>()
  const newTags: TagConfig[] = []

  for (const desc of descriptions) {
    if (!desc) continue
    const matches = [...desc.matchAll(TAG_REGEX)]
    for (const match of matches) {
      const tag = match[1].toLowerCase()
      if (known.has(tag) || seen.has(tag)) continue
      seen.add(tag)
      newTags.push({
        name: tag,
        type: "category",
        color: DEFAULT_PALETTE[(existing.length + newTags.length) % DEFAULT_PALETTE.length],
      })
    }
  }

  return newTags
}
