#!/usr/bin/env node
import { parseArgs } from "node:util"
import { KitchenClient } from "../kitchen.js"

const USAGE = `Usage:
  claw-kitchen add <text> [--by <name>] [--via <channel>] [--qty <note>]
  claw-kitchen bought <text> [--by <name>] [--source <src>]
  claw-kitchen out <text> [--by <name>]
  claw-kitchen low <text> [--by <name>]
  claw-kitchen list [--json]
  claw-kitchen staples [--asof YYYY-MM-DD] [--json]
  claw-kitchen history [--since YYYY-MM-DD] [--json]
  claw-kitchen digest [--asof YYYY-MM-DD]

Environment:
  CHEF_DB  Path to SQLite file (default: ~/.openclaw/workspace/data/chef.sqlite)
`

function die(msg: string, code = 1): never {
  process.stderr.write(`ERROR: ${msg}\n`)
  process.exit(code)
}

function parseDate(s: string | undefined, fallback: Date): Date {
  if (!s) return fallback
  const d = new Date(s)
  if (isNaN(d.getTime())) die(`invalid date: ${s}`)
  return d
}

function cmdAdd(argv: string[]): void {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      by: { type: "string" },
      via: { type: "string" },
      qty: { type: "string" },
    },
    allowPositionals: true,
  })
  const text = positionals.join(" ").trim()
  if (!text) die("add requires the item text as a positional argument")
  const kc = KitchenClient.open()
  const r = kc.addItem({
    text,
    by: values.by ?? "Unknown",
    via: values.via ?? "cli",
    quantityNote: values.qty,
  })
  if (r.created) {
    process.stdout.write(`OK added "${text}" (item=${r.itemId} list=${r.listId})\n`)
  } else {
    process.stdout.write(`OK already on list: "${text}" (item=${r.itemId} list=${r.listId})\n`)
  }
}

function cmdBought(argv: string[]): void {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      by: { type: "string" },
      source: { type: "string" },
    },
    allowPositionals: true,
  })
  const text = positionals.join(" ").trim()
  if (!text) die("bought requires the item text as a positional argument")
  const kc = KitchenClient.open()
  const r = kc.markBought({ text, by: values.by, source: values.source })
  process.stdout.write(`OK bought "${text}" (item=${r.itemId} purchase=${r.purchaseId})\n`)
}

function cmdOut(argv: string[]): void {
  const { values, positionals } = parseArgs({
    args: argv,
    options: { by: { type: "string" } },
    allowPositionals: true,
  })
  const text = positionals.join(" ").trim()
  if (!text) die("out requires the item text as a positional argument")
  const kc = KitchenClient.open()
  kc.markOut({ text, by: values.by })
  process.stdout.write(`OK out "${text}"\n`)
}

function cmdLow(argv: string[]): void {
  const { values, positionals } = parseArgs({
    args: argv,
    options: { by: { type: "string" } },
    allowPositionals: true,
  })
  const text = positionals.join(" ").trim()
  if (!text) die("low requires the item text as a positional argument")
  const kc = KitchenClient.open()
  kc.markLow({ text, by: values.by })
  process.stdout.write(`OK low "${text}"\n`)
}

function cmdList(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: { json: { type: "boolean", default: false } },
    allowPositionals: false,
  })
  const kc = KitchenClient.open()
  const entries = kc.list()
  if (values.json) {
    process.stdout.write(JSON.stringify(entries, null, 2) + "\n")
    return
  }
  if (entries.length === 0) {
    process.stdout.write("Shopping list is empty.\n")
    return
  }
  for (const e of entries) {
    const qty = e.quantityNote ? ` (${e.quantityNote})` : ""
    process.stdout.write(`• ${e.canonicalName}${qty}  [by ${e.addedBy} via ${e.addedVia}]\n`)
  }
}

function cmdStaples(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: {
      asof: { type: "string" },
      json: { type: "boolean", default: false },
    },
    allowPositionals: false,
  })
  const asOf = parseDate(values.asof, new Date())
  const kc = KitchenClient.open()
  const due = kc.staplesDue(asOf)
  if (values.json) {
    process.stdout.write(JSON.stringify(due, null, 2) + "\n")
    return
  }
  if (due.length === 0) {
    process.stdout.write("No staples due.\n")
    return
  }
  for (const d of due) {
    const since =
      d.daysSinceLastPurchase == null
        ? "never bought"
        : `${d.daysSinceLastPurchase}d since last`
    process.stdout.write(`• ${d.canonicalName}  [cadence ${d.cadenceDays}d, ${since}]\n`)
  }
}

function cmdHistory(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: {
      since: { type: "string" },
      json: { type: "boolean", default: false },
    },
    allowPositionals: false,
  })
  const since = parseDate(values.since, new Date(0))
  const kc = KitchenClient.open()
  const rows = kc.history({ since })
  if (values.json) {
    process.stdout.write(JSON.stringify(rows, null, 2) + "\n")
    return
  }
  if (rows.length === 0) {
    process.stdout.write("No purchase history in range.\n")
    return
  }
  for (const r of rows) {
    const by = r.boughtBy ? ` by ${r.boughtBy}` : ""
    process.stdout.write(`• ${r.canonicalName}  [${r.boughtAt}${by}]\n`)
  }
}

function cmdDigest(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: { asof: { type: "string" } },
    allowPositionals: false,
  })
  const asOf = parseDate(values.asof, new Date())
  const kc = KitchenClient.open()
  process.stdout.write(kc.digest(asOf) + "\n")
}

function main(): void {
  const [cmd, ...rest] = process.argv.slice(2)
  if (!cmd || cmd === "-h" || cmd === "--help" || cmd === "help") {
    process.stdout.write(USAGE)
    return
  }
  try {
    switch (cmd) {
      case "add": cmdAdd(rest); break
      case "bought": cmdBought(rest); break
      case "out": cmdOut(rest); break
      case "low": cmdLow(rest); break
      case "list": cmdList(rest); break
      case "staples": cmdStaples(rest); break
      case "history": cmdHistory(rest); break
      case "digest": cmdDigest(rest); break
      default:
        die(`unknown command: ${cmd}\n${USAGE}`)
    }
  } catch (err) {
    die(err instanceof Error ? err.message : String(err))
  }
}

main()
