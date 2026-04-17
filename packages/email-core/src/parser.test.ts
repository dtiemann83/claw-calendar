import { describe, it, expect } from "vitest"
import { parseRecipient } from "./parser.js"
import type { EmailDomainsConfig } from "./types.js"

const CONFIG: EmailDomainsConfig = {
  fallback: "general",
  routes: [
    {
      address: "school@tiemannfamily.us",
      domainTag: "school",
      subAddressing: { enabled: true, schema: "person", allowed: ["james", "sean", "eleanor"] },
    },
    {
      address: "sports@tiemannfamily.us",
      domainTag: "sports",
      subAddressing: { enabled: true, schema: "person", allowed: ["james", "sean", "eleanor"] },
    },
    {
      address: "general@tiemannfamily.us",
      domainTag: "general",
      subAddressing: { enabled: true, schema: "free" },
    },
  ],
}

describe("parseRecipient", () => {
  it("matches a bare configured address", () => {
    expect(parseRecipient("school@tiemannfamily.us", CONFIG)).toEqual({
      domainTag: "school",
      subTag: null,
      subTagKnown: true,
      matchedAddress: "school@tiemannfamily.us",
    })
  })

  it("captures a known person subTag", () => {
    expect(parseRecipient("school+james@tiemannfamily.us", CONFIG)).toEqual({
      domainTag: "school",
      subTag: "james",
      subTagKnown: true,
      matchedAddress: "school@tiemannfamily.us",
    })
  })

  it("flags an unknown person subTag as subTagKnown=false", () => {
    expect(parseRecipient("school+aunt-lisa@tiemannfamily.us", CONFIG)).toEqual({
      domainTag: "school",
      subTag: "aunt-lisa",
      subTagKnown: false,
      matchedAddress: "school@tiemannfamily.us",
    })
  })

  it("accepts any subTag on a free-schema route", () => {
    expect(parseRecipient("general+field-trip@tiemannfamily.us", CONFIG)).toEqual({
      domainTag: "general",
      subTag: "field-trip",
      subTagKnown: true,
      matchedAddress: "general@tiemannfamily.us",
    })
  })

  it("treats an empty sub (trailing +) as no sub", () => {
    expect(parseRecipient("school+@tiemannfamily.us", CONFIG)).toEqual({
      domainTag: "school",
      subTag: null,
      subTagKnown: true,
      matchedAddress: "school@tiemannfamily.us",
    })
  })

  it("lowercases the subTag when comparing against allowed", () => {
    expect(parseRecipient("SCHOOL+James@tiemannfamily.us", CONFIG)).toEqual({
      domainTag: "school",
      subTag: "james",
      subTagKnown: true,
      matchedAddress: "school@tiemannfamily.us",
    })
  })
})
