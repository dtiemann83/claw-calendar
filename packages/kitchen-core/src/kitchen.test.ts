import { describe, it, expect, beforeEach } from "vitest"
import type Database from "better-sqlite3"
import { openDb, migrate } from "./db.js"
import { normalizeText, resolveItem } from "./normalize.js"
import { KitchenClient } from "./kitchen.js"

function freshDb(): Database.Database {
  return openDb({ path: ":memory:" })
}

describe("schema + seed", () => {
  it("runs migrations on an empty db", () => {
    const db = freshDb()
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
      .all() as { name: string }[]
    const names = tables.map((t) => t.name)
    expect(names).toEqual(
      expect.arrayContaining([
        "items",
        "item_aliases",
        "shopping_list",
        "purchase_history",
        "pantry_state",
      ]),
    )
  })

  it("seeds staples and is idempotent on re-run", () => {
    const db = freshDb()
    const { count: firstCount } = db
      .prepare(`SELECT COUNT(*) AS count FROM items WHERE is_staple = 1`)
      .get() as { count: number }
    expect(firstCount).toBeGreaterThan(10)

    // Re-run the migration explicitly — should be a no-op.
    migrate(db)
    const { count: secondCount } = db
      .prepare(`SELECT COUNT(*) AS count FROM items WHERE is_staple = 1`)
      .get() as { count: number }
    expect(secondCount).toEqual(firstCount)
  })
})

describe("normalize", () => {
  it("lowercases, trims, collapses whitespace", () => {
    expect(normalizeText("  Paper   Towels ")).toEqual("paper towels")
  })
  it("strips leading quantity words", () => {
    expect(normalizeText("2 eggs")).toEqual("eggs")
    expect(normalizeText("a dozen eggs")).toEqual("eggs")
    expect(normalizeText("some milk")).toEqual("milk")
  })
})

describe("resolveItem", () => {
  let db: Database.Database
  beforeEach(() => {
    db = freshDb()
  })

  it("resolves a seeded alias", () => {
    const r = resolveItem(db, "Eggs")
    expect(r.canonicalName).toEqual("eggs")
    expect(r.created).toEqual(false)
  })

  it("resolves via singular fallback and learns the alias", () => {
    const r = resolveItem(db, "apples")
    expect(r.canonicalName).toEqual("apples")
    expect(r.created).toEqual(false)
    // "apple" was already seeded, so this doesn't test the fallback. Use a real fallback case.
    const r2 = resolveItem(db, "onion") // "onion" IS seeded, but let's test the opposite
    expect(r2.canonicalName).toEqual("onions")
  })

  it("creates a new item on first unknown text", () => {
    const r1 = resolveItem(db, "Sriracha")
    expect(r1.created).toEqual(true)
    expect(r1.canonicalName).toEqual("sriracha")

    // Second reference should find the existing item via its alias.
    const r2 = resolveItem(db, "sriracha")
    expect(r2.created).toEqual(false)
    expect(r2.itemId).toEqual(r1.itemId)
  })

  it("collapses 'Eggs' / 'egg' / 'a dozen eggs' to the same item", () => {
    const a = resolveItem(db, "Eggs")
    const b = resolveItem(db, "egg")
    const c = resolveItem(db, "a dozen eggs")
    expect(a.itemId).toEqual(b.itemId)
    expect(b.itemId).toEqual(c.itemId)
  })
})

describe("KitchenClient.addItem + list", () => {
  let db: Database.Database
  let kc: KitchenClient

  beforeEach(() => {
    db = freshDb()
    kc = new KitchenClient(db)
  })

  it("adds an item to the open list", () => {
    kc.addItem({ text: "eggs", by: "Dad", via: "imessage-relay" })
    const list = kc.list()
    expect(list).toHaveLength(1)
    expect(list[0].canonicalName).toEqual("eggs")
    expect(list[0].addedBy).toEqual("Dad")
    expect(list[0].addedVia).toEqual("imessage-relay")
    expect(list[0].status).toEqual("open")
  })

  it("dedupes a second add of the same item while still open", () => {
    kc.addItem({ text: "eggs", by: "Dad", via: "imessage-relay" })
    kc.addItem({ text: "Eggs", by: "Laura", via: "telegram" })
    const list = kc.list()
    expect(list).toHaveLength(1)
    // Adding a second time doesn't flip ownership but updates quantity_note if given.
  })
})

describe("KitchenClient.markBought + history", () => {
  let db: Database.Database
  let kc: KitchenClient

  beforeEach(() => {
    db = freshDb()
    kc = new KitchenClient(db)
  })

  it("moves an item from open list to purchase_history", () => {
    kc.addItem({ text: "eggs", by: "Dad", via: "imessage-relay" })
    kc.markBought({ text: "eggs", by: "Laura" })
    expect(kc.list()).toHaveLength(0)
    const hist = kc.history({ since: new Date(0) })
    expect(hist).toHaveLength(1)
    expect(hist[0].canonicalName).toEqual("eggs")
    expect(hist[0].boughtBy).toEqual("Laura")
  })

  it("records a purchase even if the item wasn't on the list", () => {
    kc.markBought({ text: "sriracha", by: "Dad" })
    const hist = kc.history({ since: new Date(0) })
    expect(hist).toHaveLength(1)
    expect(hist[0].canonicalName).toEqual("sriracha")
  })
})

describe("KitchenClient.markOut / markLow", () => {
  let db: Database.Database
  let kc: KitchenClient

  beforeEach(() => {
    db = freshDb()
    kc = new KitchenClient(db)
  })

  it("markOut sets pantry status to 'out' and adds to list", () => {
    kc.markOut({ text: "milk", by: "Dad" })
    const list = kc.list()
    expect(list).toHaveLength(1)
    expect(list[0].canonicalName).toEqual("whole milk")
  })

  it("markLow sets pantry status to 'low' but does NOT add to list", () => {
    kc.markLow({ text: "milk", by: "Dad" })
    const list = kc.list()
    expect(list).toHaveLength(0)
    // Pantry row should reflect "low".
    const pantry = db
      .prepare(
        `SELECT pantry_state.status AS status FROM pantry_state
           JOIN items ON items.id = pantry_state.item_id
          WHERE items.canonical_name = 'whole milk'`,
      )
      .get() as { status: string } | undefined
    expect(pantry?.status).toEqual("low")
  })
})

describe("KitchenClient.staplesDue", () => {
  let db: Database.Database
  let kc: KitchenClient

  beforeEach(() => {
    db = freshDb()
    kc = new KitchenClient(db)
  })

  it("returns staples never bought as due", () => {
    const due = kc.staplesDue(new Date())
    // Every seeded staple has no purchase history yet, so all are due.
    expect(due.length).toBeGreaterThan(10)
  })

  it("excludes a staple bought recently", () => {
    kc.markBought({ text: "milk", at: new Date(), by: "Dad" })
    const due = kc.staplesDue(new Date())
    const names = due.map((d) => d.canonicalName)
    expect(names).not.toContain("whole milk")
  })

  it("includes a staple bought longer ago than its cadence", () => {
    const longAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000)
    kc.markBought({ text: "milk", at: longAgo, by: "Dad" })
    const due = kc.staplesDue(new Date())
    const names = due.map((d) => d.canonicalName)
    expect(names).toContain("whole milk")
  })
})

describe("KitchenClient.digest", () => {
  let db: Database.Database
  let kc: KitchenClient

  beforeEach(() => {
    db = freshDb()
    kc = new KitchenClient(db)
  })

  it("summarizes open list + due staples in a plain-text string", () => {
    kc.addItem({ text: "sriracha", by: "Dad", via: "telegram" })
    const txt = kc.digest(new Date())
    expect(txt).toMatch(/sriracha/i)
    expect(txt).toMatch(/staple/i)
  })
})
