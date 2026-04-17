#!/usr/bin/env node
import { parseArgs } from "node:util"
import { parseRecipient } from "../parser.js"
import { loadEmailDomainsConfig } from "../config.js"

const USAGE = `Usage:
  claw-email domain "<to-string>" [--json]

Reads emailDomains config from \$OPENCLAW_CONFIG or ~/.openclaw/openclaw.json.

Text output (default):
  Domain: <tag>
  SubTag: <sub>       (omitted when null)
  SubTagKnown: true|false   (only when SubTag present)
  MatchedAddress: <address> (or "none")

JSON output (--json):
  { "domainTag": "...", "subTag": "... | null", "subTagKnown": bool, "matchedAddress": "... | null" }
`

function die(msg: string, code = 1): never {
  process.stderr.write(`ERROR: ${msg}\n`)
  process.exit(code)
}

function main(argv: string[]): void {
  const cmd = argv[0]
  if (!cmd || cmd === "--help" || cmd === "-h") {
    process.stdout.write(USAGE)
    return
  }
  if (cmd !== "domain") die(`unknown command: ${cmd}\n${USAGE}`)

  const { values, positionals } = parseArgs({
    args: argv.slice(1),
    options: { json: { type: "boolean", default: false } },
    allowPositionals: true,
  })
  const to = positionals.join(" ").trim()
  if (!to) die("domain requires the To-string as a positional argument")

  const config = loadEmailDomainsConfig()
  const r = parseRecipient(to, config)

  if (values.json) {
    process.stdout.write(JSON.stringify(r) + "\n")
    return
  }
  process.stdout.write(`Domain: ${r.domainTag}\n`)
  if (r.subTag !== null) {
    process.stdout.write(`SubTag: ${r.subTag}\n`)
    process.stdout.write(`SubTagKnown: ${r.subTagKnown}\n`)
  }
  process.stdout.write(`MatchedAddress: ${r.matchedAddress ?? "none"}\n`)
}

main(process.argv.slice(2))
