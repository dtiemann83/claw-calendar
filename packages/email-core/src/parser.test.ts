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
})
