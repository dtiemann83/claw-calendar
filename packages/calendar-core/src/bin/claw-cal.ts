#!/usr/bin/env node
import { parseArgs } from "node:util"
import { readFileSync } from "node:fs"
import { randomUUID } from "node:crypto"
import { CalendarClient } from "../caldav.js"
import { stashCredentials, getCredentials } from "../credentials.js"
import type { CalendarEvent, EventPatch } from "../types.js"

const USAGE = `Usage:
  claw-cal setup [--apple-id <email>] [--password <pass> | --password-file <path>]
  claw-cal list [--calendar Family] [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--grep <s>] [--json]
  claw-cal add --title <s> --start <s> --end <s> [--desc <s>] [--location <s>] [--allday] [--calendar Family] [--json]
  claw-cal update <uid> [--title <s>] [--start <s>] [--end <s>] [--desc <s>] [--location <s>] [--allday] [--calendar Family]
  claw-cal delete <uid> [--calendar Family]
  claw-cal whoami

Dates:
  Timed:   ISO (2026-04-19T17:00:00Z) or "April 19, 2026 at 5:00:00 PM"
  All-day: YYYY-MM-DD or "April 19, 2026"
`

const DEFAULT_CALENDAR = "Family"

function die(msg: string, code = 1): never {
  process.stderr.write(`ERROR: ${msg}\n`)
  process.exit(code)
}

function parseDateInput(s: string, allDay: boolean): string {
  if (allDay) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
    const d = new Date(s)
    if (isNaN(d.getTime())) die(`invalid date: ${s}`)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
  }
  const cleaned = s.replace(/\s+at\s+/i, " ")
  const d = new Date(cleaned)
  if (isNaN(d.getTime())) die(`invalid date: ${s}`)
  return d.toISOString()
}

async function cmdSetup(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: {
      "apple-id": { type: "string" },
      password: { type: "string" },
      "password-file": { type: "string" },
    },
    allowPositionals: false,
  })
  const appleId = values["apple-id"]
  let password = values.password
  if (!password && values["password-file"]) {
    password = readFileSync(values["password-file"], "utf-8").trim()
  }
  if (!appleId || !password) die("setup requires --apple-id and --password (or --password-file)")
  stashCredentials(appleId, password)
  process.stdout.write(`OK stashed credentials for ${appleId}\n`)
}

async function cmdWhoami(): Promise<void> {
  const { appleId } = getCredentials()
  process.stdout.write(`${appleId}\n`)
}

async function cmdList(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: {
      calendar: { type: "string", default: DEFAULT_CALENDAR },
      from: { type: "string" },
      to: { type: "string" },
      grep: { type: "string" },
      json: { type: "boolean", default: false },
    },
    allowPositionals: false,
  })
  const client = new CalendarClient({ calendarName: values.calendar! })
  const rangeStart = values.from ? new Date(values.from) : undefined
  const rangeEnd = values.to ? new Date(values.to) : undefined
  let events = await client.list(rangeStart, rangeEnd)
  if (values.grep) {
    const needle = values.grep.toLowerCase()
    events = events.filter((e) => {
      const hay = `${e.summary}\n${e.description ?? ""}\n${e.location ?? ""}`.toLowerCase()
      return hay.includes(needle)
    })
  }
  if (values.json) {
    process.stdout.write(JSON.stringify(events, null, 2) + "\n")
  } else {
    for (const e of events) {
      const when = e.allDay ? `${e.start}..${e.end}` : `${e.start}`
      process.stdout.write(`• ${e.summary}  [${when}]  uid=${e.uid}\n`)
      if (e.location) process.stdout.write(`    location: ${e.location}\n`)
      if (e.description) process.stdout.write(`    notes: ${e.description.replace(/\n+/g, " ")}\n`)
    }
  }
}

async function cmdAdd(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: {
      calendar: { type: "string", default: DEFAULT_CALENDAR },
      title: { type: "string" },
      start: { type: "string" },
      end: { type: "string" },
      desc: { type: "string" },
      location: { type: "string" },
      allday: { type: "boolean", default: false },
      uid: { type: "string" },
      json: { type: "boolean", default: false },
    },
    allowPositionals: false,
  })
  if (!values.title || !values.start || !values.end) {
    die("add requires --title, --start, --end")
  }
  const allDay = values.allday!
  const event: CalendarEvent = {
    uid: values.uid || randomUUID().toUpperCase(),
    summary: values.title!,
    start: parseDateInput(values.start!, allDay),
    end: parseDateInput(values.end!, allDay),
    allDay,
    description: values.desc,
    location: values.location,
  }
  const client = new CalendarClient({ calendarName: values.calendar! })
  const result = await client.add(event)
  if (values.json) {
    process.stdout.write(JSON.stringify(result) + "\n")
  } else {
    process.stdout.write(`OK uid=${result.uid}\n`)
  }
}

async function cmdUpdate(argv: string[]): Promise<void> {
  if (argv.length < 1) die("update requires <uid>")
  const uid = argv[0]
  const rest = argv.slice(1)
  const { values } = parseArgs({
    args: rest,
    options: {
      calendar: { type: "string", default: DEFAULT_CALENDAR },
      title: { type: "string" },
      start: { type: "string" },
      end: { type: "string" },
      desc: { type: "string" },
      location: { type: "string" },
      allday: { type: "boolean" },
    },
    allowPositionals: false,
  })
  const patch: EventPatch = {}
  if (values.title !== undefined) patch.summary = values.title
  if (values.desc !== undefined) patch.description = values.desc
  if (values.location !== undefined) patch.location = values.location
  if (values.allday !== undefined) patch.allDay = values.allday

  // Dates must be parsed against the resulting allDay mode.
  // If --allday is supplied, honor it; else we defer to the existing event (handled inside CalendarClient.update merge).
  if (values.start !== undefined) {
    const allDay = values.allday ?? false
    patch.start = parseDateInput(values.start, allDay)
  }
  if (values.end !== undefined) {
    const allDay = values.allday ?? false
    patch.end = parseDateInput(values.end, allDay)
  }

  if (Object.keys(patch).length === 0) die("update requires at least one of --title, --start, --end, --desc, --location, --allday")

  const client = new CalendarClient({ calendarName: values.calendar! })
  await client.update(uid, patch)
  process.stdout.write(`OK\n`)
}

async function cmdDelete(argv: string[]): Promise<void> {
  if (argv.length < 1) die("delete requires <uid>")
  const uid = argv[0]
  const rest = argv.slice(1)
  const { values } = parseArgs({
    args: rest,
    options: {
      calendar: { type: "string", default: DEFAULT_CALENDAR },
    },
    allowPositionals: false,
  })
  const client = new CalendarClient({ calendarName: values.calendar! })
  await client.delete(uid)
  process.stdout.write(`OK deleted uid=${uid}\n`)
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2)
  if (!cmd || cmd === "-h" || cmd === "--help" || cmd === "help") {
    process.stdout.write(USAGE)
    return
  }
  try {
    switch (cmd) {
      case "setup":
        await cmdSetup(rest)
        break
      case "whoami":
        await cmdWhoami()
        break
      case "list":
        await cmdList(rest)
        break
      case "add":
        await cmdAdd(rest)
        break
      case "update":
        await cmdUpdate(rest)
        break
      case "delete":
        await cmdDelete(rest)
        break
      default:
        die(`unknown command: ${cmd}\n${USAGE}`)
    }
  } catch (err) {
    die(err instanceof Error ? err.message : String(err))
  }
}

main()
