# Email Pipeline Redesign Design

## Goal

Replace the fragile LLM-orchestrated email processing pipeline with an event-driven, Postgres-backed system that supports dynamic addressee routing, automatic retries, and Zoidberg-mediated human-in-the-loop decisions for unknown addresses.

## Background & Motivation

The current pipeline has several failure modes discovered in production:

- **Two-file config mess** — `emailDomains.json` + `email-core.json` wrapper, no sync between them
- **Postie HEARTBEAT unreliability** — LLM-driven orchestration can hallucinate steps (e.g., skip the sqlite3 exec and fabricate an empty result)
- **Silent failures** — unknown addressees are dropped with no notification
- **No retry** — a single failure loses the email permanently
- **`travel@tiemannfamily.us` missing** from domain config entirely
- **No observability** — no way to see pipeline health without reading raw SQLite

## Architecture Overview

Postgres is the central nervous system. The LLM is invoked exactly once per email — for structured event extraction — and nowhere else. All orchestration is deterministic code reacting to DB state changes via LISTEN/NOTIFY.

```
Resend webhook
    ↓
Next.js API route  →  INSERT into postgres `emails` table
                              ↓ (trigger fires)
                       NOTIFY 'email_pipeline'
                              ↓
Email Processor Daemon  ←  LISTEN 'email_pipeline'
    │
    ├─ routing rule found → extract event (LLM) → claw-cal add → status: added
    │
    ├─ unknown address → status: routing_unknown → NOTIFY
    │                           ↓
    │                    Zoidberg subscriber → Telegram to user
    │                           ↓ (user answers)
    │                    rule saved → UPDATE status='pending' → reprocess
    │
    └─ parse failed → retry with backoff → dead_letter after 3 → Zoidberg alert
```

**What goes away:** `emailDomains.json`, `email-core.json`, `email-domain.sh` OPENCLAW_CONFIG wrapper, Postie HEARTBEAT.md

**What stays:** Next.js webhook receiver, `claw-cal` for calendar writes, Zoidberg for human-in-the-loop, pm2 for process management

**New processes:**
- `postgres` — MacPorts postgresql16-server, managed by LaunchDaemon (always on, not pm2)
- `email-processor` — Python async daemon, pm2-managed, handles LISTEN/NOTIFY pipeline

## Database Schema

### `allowed_domains`
Top-level domains that are "ours" — CLI-managed, rarely changes.

```sql
CREATE TABLE allowed_domains (
    domain      TEXT PRIMARY KEY,
    created_at  TIMESTAMPTZ DEFAULT now()
);
```

### `routing_rules`
Per-address routing config — Zoidberg writes these after user confirmation.

```sql
CREATE TABLE routing_rules (
    address     TEXT PRIMARY KEY,          -- e.g. school@tiemannfamily.us
    action      TEXT NOT NULL,             -- 'calendar' | 'ignore'
    tag         TEXT,                      -- e.g. 'school', 'sports' (for calendar action)
    calendar_id TEXT,                      -- override target calendar (null = default family calendar)
    created_by  TEXT DEFAULT 'zoidberg',
    created_at  TIMESTAMPTZ DEFAULT now()
);
```

### `emails`
Every inbound email with full lifecycle state.

```sql
CREATE TABLE emails (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    received_at  TIMESTAMPTZ DEFAULT now(),
    email_id     TEXT UNIQUE,              -- Resend's dedup key
    from_addr    TEXT,
    to_addr      TEXT,
    subject      TEXT,
    full_content TEXT,
    status       TEXT NOT NULL DEFAULT 'pending',
    retry_count  INT DEFAULT 0,
    last_error   TEXT,
    processed_at TIMESTAMPTZ,
    event_uid    TEXT                      -- iCloud event UID after successful add
);
```

**Status values:**
- `pending` — received, awaiting processing
- `routing_unknown` — no rule for this address, waiting for user decision
- `processing` — currently being processed
- `added` — event added to calendar
- `duplicate` — event already exists, skipped
- `ignored` — address action is 'ignore'
- `no_event` — no calendar event found in email content
- `parse_failed` — extraction failed, will retry
- `dead_letter` — failed 3 times, requires manual intervention

### Trigger

Single trigger fires on INSERT and status UPDATE, carrying full row as JSON payload on the `email_pipeline` channel.

```sql
CREATE OR REPLACE FUNCTION notify_email_change() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('email_pipeline', row_to_json(NEW)::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_pipeline_trigger
AFTER INSERT OR UPDATE ON emails
FOR EACH ROW EXECUTE FUNCTION notify_email_change();
```

## Email Processor Daemon

Python async daemon at `packages/email-processor/`. Uses `asyncpg` for LISTEN/NOTIFY — no polling loop.

**Location:** `packages/email-processor/`
**Runtime:** Python 3.12, asyncpg, anthropic SDK, subprocess for claw-cal
**pm2 name:** `email-processor`

### Processing pipeline (per email)

```
receive NOTIFY (status = pending)
    ↓
lookup routing_rules WHERE address = to_addr
    ├─ no rule
    │   ├─ domain not in allowed_domains → UPDATE status='ignored'
    │   └─ domain allowed → UPDATE status='routing_unknown'
    │                        (trigger fires → Zoidberg notified)
    └─ rule found
        ├─ action='ignore' → UPDATE status='ignored'
        └─ action='calendar'
            ↓
            UPDATE status='processing'
            ↓
            extract_event(full_content, tag)  ← only LLM call
            ↓
            None returned → UPDATE status='no_event'
            Event returned
            ↓
            claw-cal list --grep <title> --from <date>  ← dedup check
            ↓
            duplicate found → UPDATE status='duplicate'
            not duplicate
            ↓
            claw-cal add ...
            ↓
            UPDATE status='added', event_uid=<uid>
```

### Retry coroutine

Runs every 5 minutes. Picks up `parse_failed` emails where `retry_count < 3`, resets to `pending`. After 3 failures, sets `dead_letter` — trigger fires, Zoidberg alerts user.

### LLM extraction

Structured prompt only — returns typed `Event` dataclass or `None`. Never used for orchestration.

```python
@dataclass
class Event:
    title: str
    date: str        # ISO 8601
    time: str | None
    location: str | None
    description: str | None
```

## Zoidberg Integration

A new openclaw skill (`email-routing`) with a persistent `asyncpg` LISTEN connection. Runs as a coroutine in Zoidberg's process (or separate pm2 process if Zoidberg's runtime doesn't support it).

### Unknown addressee flow

Zoidberg receives NOTIFY with `status='routing_unknown'`, sends Telegram:

```
New email to newaddress@tiemannfamily.us
From: sender@example.com
Subject: Whatever

How should I handle this address?
1. Add to calendar — what tag? (school / sports / general / other)
2. Add to a specific calendar (not the default family calendar)
3. Ignore all future emails to this address
```

User replies → Zoidberg INSERTs into `routing_rules` → updates email `status='pending'` → trigger fires → processor reprocesses.

### Dead letter flow

Zoidberg receives NOTIFY with `status='dead_letter'`, sends Telegram:

```
Email processing failed 3 times — needs manual review.
To: school@tiemannfamily.us
Subject: Whatever
Last error: <last_error>
Email ID: <id>
```

## CLI — Domain Management

Thin shell scripts wrapping `psql`. No new binary.

```bash
# Top-level domains (rare)
openclaw email domains add tiemannfamily.us
openclaw email domains list
openclaw email domains remove tiemannfamily.us

# Addressee routing rules (manual management — Zoidberg handles these automatically)
openclaw email domains rules list
openclaw email domains rules add school@tiemannfamily.us --action calendar --tag school
openclaw email domains rules remove school@tiemannfamily.us

# One-time migration
openclaw email domains migrate --from ~/.openclaw/emailDomains.json
```

## Migration Plan

### Step 1: Install Postgres on danas
```bash
sudo port install postgresql16-server
sudo port load postgresql16-server
createdb openclaw
createuser openclaw
```

### Step 2: Run schema migrations
Create all three tables and install trigger.

### Step 3: Seed from existing config
```bash
openclaw email domains migrate --from ~/.openclaw/emailDomains.json
```
Seeds: `school@`, `sports@`, `general@`, `travel@tiemannfamily.us` + `tiemannfamily.us` as allowed domain. (`travel@` is currently missing from config — added here.)

### Step 4: Migrate historical emails from SQLite
Export `resend_webhooks` rows → INSERT into `emails`. Map `postie_status` to new status enum (`done` → `added`, `pending` → `pending`).

### Step 5: Cutover
- Update Next.js webhook receiver to write to Postgres
- Start `email-processor` via pm2
- Wire Zoidberg `email-routing` skill to Postgres LISTEN
- Retire Postie HEARTBEAT.md

### Step 6: Verify and clean up
- Send test email → confirm end-to-end
- Archive SQLite file
- Remove `emailDomains.json`, `email-core.json`, `email-domain.sh`

## Error Handling Policy

| Failure | Behavior |
|---|---|
| Unknown addressee (domain allowed) | `routing_unknown` → Zoidberg asks user → user decides |
| Unknown domain | `ignored`, warning logged |
| LLM extraction fails | `parse_failed`, retry up to 3× with 5-min backoff |
| No event in email | `no_event`, no retry (expected) |
| Calendar duplicate | `duplicate`, no retry |
| `claw-cal add` fails | `parse_failed`, retried |
| 3 failures | `dead_letter` → Zoidberg Telegram alert |
| Postgres down | Webhook receiver logs error, Resend retries delivery automatically |

## Observability

No dashboards. Queryable Postgres + pm2 logs.

```bash
# Pipeline health
psql openclaw -c "SELECT status, count(*) FROM emails GROUP BY status;"

# Stuck emails
psql openclaw -c "SELECT to_addr, subject, status, retry_count, last_error
                  FROM emails WHERE status NOT IN ('added','ignored','duplicate','no_event')
                  ORDER BY received_at DESC;"

# Recent activity
psql openclaw -c "SELECT to_addr, subject, status, processed_at
                  FROM emails ORDER BY received_at DESC LIMIT 20;"
```

Processor logs structured JSON to stdout, captured by pm2:
```json
{"ts":"...","email_id":"...","to":"school@tiemannfamily.us","status":"added","event":"Music Field Trip","duration_ms":1243}
```
