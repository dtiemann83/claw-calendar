import { describe, it, expect } from "vitest"
import { parseEventTags, discoverNewTags, type TagConfig } from "./tags"

describe("parseEventTags", () => {
  const configs: TagConfig[] = [
    { name: "sports", type: "category", color: "#22c55e" },
    { name: "medical", type: "category", color: "#ef4444" },
    { name: "emma", type: "who", color: "#3b82f6", initial: "E" },
    { name: "mom", type: "who", color: "#a855f7", initial: "M" },
  ]

  it("extracts category and who tags from description", () => {
    const result = parseEventTags("Basketball practice #sports #emma", configs)
    expect(result.categories).toEqual(["sports"])
    expect(result.who).toEqual(["emma"])
  })

  it("strips hashtags from cleanText", () => {
    const result = parseEventTags("Basketball practice #sports #emma", configs)
    expect(result.cleanText).toBe("Basketball practice")
  })

  it("normalizes tags to lowercase", () => {
    const result = parseEventTags("Doctor visit #Medical #MOM", configs)
    expect(result.categories).toEqual(["medical"])
    expect(result.who).toEqual(["mom"])
  })

  it("treats unknown tags as category", () => {
    const result = parseEventTags("Meeting #newTag", configs)
    expect(result.categories).toEqual(["newtag"])
    expect(result.who).toEqual([])
  })

  it("returns empty arrays when no hashtags", () => {
    const result = parseEventTags("Just a normal event", configs)
    expect(result.categories).toEqual([])
    expect(result.who).toEqual([])
  })

  it("handles undefined/empty description", () => {
    expect(parseEventTags("", configs)).toEqual({
      categories: [],
      who: [],
      cleanText: "",
    })
    expect(parseEventTags(undefined as unknown as string, configs)).toEqual({
      categories: [],
      who: [],
      cleanText: "",
    })
  })

  it("handles multiple category tags (all returned, first wins for color)", () => {
    const result = parseEventTags("Event #sports #medical", configs)
    expect(result.categories).toEqual(["sports", "medical"])
  })

  it("handles tags at start and middle of text", () => {
    const result = parseEventTags("#sports game at #emma school", configs)
    expect(result.categories).toEqual(["sports"])
    expect(result.who).toEqual(["emma"])
    expect(result.cleanText).toBe("game at school")
  })

  it("trims extra whitespace from cleanText", () => {
    const result = parseEventTags("  #sports  Basketball  #emma  ", configs)
    expect(result.cleanText).toBe("Basketball")
  })
})

describe("discoverNewTags", () => {
  it("returns new TagConfigs for unknown hashtags", () => {
    const existing: TagConfig[] = [
      { name: "sports", type: "category", color: "#22c55e" },
    ]
    const descriptions = [
      "Game #sports #emma",
      "Doctor visit #medical",
    ]
    const newTags = discoverNewTags(descriptions, existing)
    expect(newTags).toHaveLength(2)
    expect(newTags[0].name).toBe("emma")
    expect(newTags[0].type).toBe("category")
    expect(newTags[1].name).toBe("medical")
  })

  it("assigns colors from palette based on existing config length", () => {
    const existing: TagConfig[] = [
      { name: "sports", type: "category", color: "#22c55e" },
    ]
    const descriptions = ["Event #newtag"]
    const newTags = discoverNewTags(descriptions, existing)
    // existing has 1 tag, so next palette index is 1 → "#ef4444"
    expect(newTags[0].color).toBe("#ef4444")
  })

  it("does not duplicate already-known tags", () => {
    const existing: TagConfig[] = [
      { name: "sports", type: "category", color: "#22c55e" },
    ]
    const descriptions = ["Game #sports", "Another #sports"]
    const newTags = discoverNewTags(descriptions, existing)
    expect(newTags).toHaveLength(0)
  })

  it("deduplicates across multiple descriptions", () => {
    const descriptions = ["Event #newtag", "Another #newtag"]
    const newTags = discoverNewTags(descriptions, [])
    expect(newTags).toHaveLength(1)
  })

  it("wraps palette when more tags than colors", () => {
    const existing: TagConfig[] = Array.from({ length: 10 }, (_, i) => ({
      name: `tag${i}`,
      type: "category" as const,
      color: "#000",
    }))
    const descriptions = ["Event #overflow"]
    const newTags = discoverNewTags(descriptions, existing)
    // 10 existing → palette index 10 % 10 = 0 → "#22c55e"
    expect(newTags[0].color).toBe("#22c55e")
  })
})
