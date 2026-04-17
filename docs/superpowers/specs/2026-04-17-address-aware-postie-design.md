# Address-aware Postie

## Context

Postie (the `resend-inbox` agent) triages inbound family email and hands off to Zoidberg (main) for any email that warrants action. Today everything routes through a single inbox; Postie classifies each message against a flat list of intents (`personal`, `bill`, `calendar`, `account`, `marketing`, `suspicious`, …) using the body.

We are about to use multiple receiving addresses on `tiemannfamily.us` — at minimum `school@`, `sports@`, and `general@`, with more (`medical@`, `finance@`, `travel@`, …) likely to follow. The receiving address is a strong, deterministic categorization signal the family chooses at the moment of sending: a school email is sent to `school@`, a sports schedule to `sports@`. Asking the LLM to re-derive that signal from the body is wasteful and error-prone.

Additionally, subaddressing (plus-addressing) will be used: `school+james@tiemannfamily.us` flags "this school email is about James." The same structure applies across domains.

This spec adds deterministic address → domain/subTag parsing as a step *before* Postie's LLM turn, threads those two fields through the handoff to Zoidberg, and makes the domain list data-driven in `openclaw.json`.

## Goals

- Every inbound email gets a `Domain` and optional `SubTag` field attached before Postie classifies intent.
- The domain set is data-driven in `openclaw.json`; adding `medical@` later is a config edit + a Resend route, no code change.
- Postie's existing intent-classification stays intact (`bill`, `calendar`, `personal`, `account`, …). Domain and Intent are independent fields on the handoff.
- Zoidberg gets a richer handoff and composes domain + subTag into calendar hashtags (e.g. `#school #James`).

## Non-goals (V1)

- **Per-domain confidence thresholds.** Uniform in V1; revisit after real traffic.
- **Per-domain sender allowlists.** `allowFrom` stays global until we see spam on a specific address.
- **Domain-specific downstream workflows.** V1 just tags; V2 could introduce domain-specific Postie personas or auto-action rules.

## Architecture

One Postie, one skill, one webhook route. Address-awareness is a cheap deterministic envelope-parsing step that fires before Postie's LLM turn.

```
Resend inbound webhook
         │
         ▼
┌────────────────────────┐
│ Envelope parser        │   Parse `To:` → (domainTag, subTag)
│  (cheap, deterministic)│   Look up domainTag in emailDomains config
└──────────┬─────────────┘   Unknown domain → fallback (general)
           │
           ▼
┌────────────────────────┐
│  Postie (LLM turn)     │   Sees domain/subTag pre-filled in envelope
│                        │   Only classifies Intent from content
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│  Handoff to Zoidberg   │   Three fields: Domain, SubTag, Intent
│  (sessions_send)       │
└────────────────────────┘
```

## Config shape

New top-level `emailDomains` block in `openclaw.json`:

```json
"emailDomains": {
  "fallback": "general",
  "routes": [
    {
      "address": "school@tiemannfamily.us",
      "domainTag": "school",
      "description": "Raleigh Oak Charter, PTA, teachers, report cards",
      "subAddressing": {
        "enabled": true,
        "schema": "person",
        "allowed": ["james", "sean", "eleanor"]
      }
    },
    {
      "address": "sports@tiemannfamily.us",
      "domainTag": "sports",
      "description": "Schedules, practices, coach communications",
      "subAddressing": {
        "enabled": true,
        "schema": "person",
        "allowed": ["james", "sean", "eleanor"]
      }
    },
    {
      "address": "general@tiemannfamily.us",
      "domainTag": "general",
      "description": "Catch-all family mail",
      "subAddressing": { "enabled": true, "schema": "free" }
    }
  ]
}
```

`subAddressing.schema` semantics:

- `"person"` — subTag must match one of `allowed`; unknown values are kept as raw strings but flagged to Zoidberg as `subTagKnown=false`.
- `"free"` — any non-empty string is accepted; no validation.
- Omit or set `enabled: false` — subTag is ignored.

Adding `medical@`, `finance@` later = append a route block. No code change.

## Envelope parsing

Pure function, called deterministically before Postie's LLM turn. No LLM, no I/O beyond the injected config.

```ts
type ParsedRecipient = {
  domainTag: string;          // from matched route, or config.fallback
  subTag: string | null;      // lowercased; null if none or disabled
  subTagKnown: boolean;       // true unless schema:"person" and subTag ∉ allowed
  matchedAddress: string | null; // which configured route matched; null means fallback
};

function parseRecipient(to: string, config: EmailDomainConfig): ParsedRecipient;
```

Rules:

1. **Strip display name.** `"School <school+james@tiemannfamily.us>"` → `school+james@tiemannfamily.us`.
2. **Split local/domain on `@`.** Split local on first `+` → `(base, sub)`. `sub === ""` is treated as no sub.
3. **Match.** Compare `base@domain` (case-insensitive) against each route's `address`.
   - Match → use that route's `domainTag`. If route has `subAddressing.schema === "person"` and `sub` is present, check membership in `allowed`.
   - No match → `domainTag = config.fallback`, `subTag = null`, `matchedAddress = null`.
4. **Normalize.** Lowercase `subTag` before comparison.

Edge cases:

- Multiple `To:` / CC addresses: use the first address that matches a configured route. If none match, use the first address overall and apply fallback. Log a warning when more than one configured route matches in a single envelope.
- `school+@tiemannfamily.us` (empty sub): treated as no sub.
- Header spoofing: ignored. Use Resend's envelope `to`, not the `To:` header content, as the source of truth.

## Handoff to Zoidberg

Postie's handoff block (current shape in `agents/resend-inbox/workspace/AGENTS.md`) gets three new fields at the top:

```
[FROM POSTIE 📬 — inbound email triage]
Domain: school
SubTag: james
Intent: calendar
Confidence: high
From: teacher@raleighoak.org
Subject: Parent-teacher conference
Received: 2026-04-17T14:23:00-04:00
Email ID: em_xyz
Full email: /Users/dtiemann/.openclaw/workspace/webhooks/resend/emails/em_xyz.json

Summary:
…

Recommendation:
…

Extracted details:
…
```

If `subTagKnown === false`, the line is written as `SubTag: aunt-lisa (unknown — not in allowed list)` so Zoidberg surfaces it to Dana rather than silently tagging.

Postie's LLM prompt is updated so it no longer guesses domain — it's told "Domain is `{domainTag}`, SubTag is `{subTag}` (or 'none'); classify only Intent from the body." Fewer tokens of classification instructions, deterministic domain attribution.

### Hashtag composition on Zoidberg's side

Zoidberg's skill picks up the three fields and composes hashtags:

| Domain  | SubTag  | Resulting hashtags on the calendar event / handoff |
|---------|---------|----------------------------------------------------|
| school  | james   | `#school #James`                                    |
| school  | none    | `#school`                                           |
| sports  | eleanor | `#sports #Eleanor`                                  |
| general | none    | content-derived tags only (today's behavior)        |

Person subTags are title-cased on their way into hashtags (`james` → `#James`). Free-schema subTags become a kebab-case hashtag as-is (`school+field-trip@…` → `#school #field-trip`) — this is a minor convenience so free-form tags still flow through.

## Data flow

```
Email arrives at school+james@tiemannfamily.us
    ↓ Resend webhook
parseRecipient → { domainTag: "school", subTag: "james", subTagKnown: true }
    ↓ fields injected into Postie envelope
Postie (LLM) classifies Intent=calendar from body, extracts facts
    ↓ sessions_send to main
Zoidberg sees Domain=school + SubTag=james + Intent=calendar
    ↓ composes #school #James
cal-add.sh (if high confidence) or confirm-with-Dana (otherwise)
```

## Error handling

- **Unconfigured address** (e.g. mail sent to `billing@tiemannfamily.us` and that route doesn't exist): fall through to `config.fallback` (`general`). Log the unconfigured address at INFO so Dana can decide whether to add a route.
- **Global allowlist failure** (sender not in `channels.resend.allowFrom`): drop before Postie wakes. Current behavior; unchanged.
- **Unknown subTag on `person` schema** (`school+aunt-lisa@…`): pass through as `subTag="aunt-lisa", subTagKnown=false`. Postie still processes the email; the handoff surfaces the unknown subTag so Dana can react (typo vs. a new name to add).
- **Multiple configured routes match** (rare — a single envelope with multiple To: addresses, both configured): pick the first; log a warning.

## Testing

- **Unit: `parseRecipient`.** Table-driven covering: exact match, case-insensitive match, with and without subaddress, `person` schema hit and miss, `free` schema, empty sub after `+`, display-name stripping, unconfigured address (fallback), multiple `To:` addresses, subTag casing.
- **Integration.** Send test emails through the Resend sandbox to each configured address plus a `+sub` variant plus an unconfigured address; verify Postie's handoff block contains the expected `Domain` / `SubTag` / `Intent` lines and that `subTagKnown=false` renders correctly.
- **Regression.** A pre-existing email flow (a human-to-`dana@tiemannfamily.us` note that isn't a configured route) still reaches Postie and produces a handoff with `Domain: general, SubTag: none`.

## Verification

Manual checklist after the feature ships:

1. Send `School Test <test@gmail.com>` → `school@tiemannfamily.us` with body "Picture day is April 22." → handoff shows `Domain: school, SubTag: none, Intent: calendar`. Zoidberg proposes `#school` tags.
2. Send to `school+james@tiemannfamily.us` with the same body → `SubTag: james`, resulting event tagged `#school #James`.
3. Send to `sports+eleanor@tiemannfamily.us` with "Soccer moved to Friday at 5pm" → `Domain: sports, SubTag: eleanor, Intent: calendar`, event tagged `#sports #Eleanor`.
4. Send to `billing@tiemannfamily.us` (not configured) → handoff shows `Domain: general, SubTag: none`, log mentions the unconfigured address.
5. Send to `school+aunt-lisa@tiemannfamily.us` → `SubTag: aunt-lisa (unknown — not in allowed list)` surfaces in the handoff; Zoidberg asks Dana rather than silently tagging.

## Open items

- **Confidence thresholds per domain.** Uniform in V1. Revisit after we see real traffic — school schedule changes probably warrant a higher auto-action bar than sports practice reschedules, but it's premature to tune without data.
- **Resend routing state.** Each inbound address needs a Resend inbound route configured to hit our webhook. Verify current state as part of implementation; if only `general@` is wired today, this is a one-time Resend dashboard setup for each new address.
- **Per-domain sender allowlists.** Not in V1. `allowFrom` stays global until we see spam scoped to a specific address.
- **Domain-specific agent routing.** V1 hands everything to Zoidberg (`main`) regardless of domain. V2 could route `school+food@` to Chef, or `medical@` to a future medical-records agent. Out of scope here.

## Files

### Modify

- `openclaw.json` — add `emailDomains` block (root level).
- `agents/resend-inbox/workspace/AGENTS.md` — update the handoff block template to include `Domain`, `SubTag`, `Intent`. Update the classification instructions to note that Domain/SubTag are pre-filled.
- `agents/main/workspace/…` (Zoidberg's AGENTS.md or family-calendar SKILL.md) — add the hashtag composition table so Zoidberg reliably maps `(domain, subTag)` into calendar tags.

### Create

- Envelope parser module + tests. Location TBD in implementation plan (likely inside the openclaw resend plugin or a small shared workspace package — both are viable and the implementation plan will pick one).

### Reuse

- Existing Resend inbound webhook handler — the place that currently produces Postie's envelope text is where we inject the parsed `Domain` / `SubTag` fields.
- Existing `allowFrom` global allowlist — unchanged.
- Existing Postie classification prompt — trimmed, not rewritten: the domain-guessing instructions come out, the intent-classification instructions stay.

## Risks

- **Resend envelope vs. `To:` header disagreement.** If Resend ever passes us the display header instead of the envelope recipient, the parser could miss subaddresses. Mitigation: assert which field the Resend webhook provides during implementation; document it.
- **Domain tag drift between Postie and Zoidberg.** If the config adds `medical@` but Zoidberg's hashtag table hasn't been updated, Zoidberg will pass `medical` through as a raw hashtag — harmless but inconsistent. Mitigation: the hashtag table treats unknown domains as `#<domain>` lowercased, so new domains degrade gracefully.
- **Case sensitivity in subTags.** Family member names can collide with common subaddress conventions (`+james` vs. `+James`). Parser always lowercases before compare. Tests cover this.
