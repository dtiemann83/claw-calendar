# @claw/email-core

Pure parser + CLI for mapping inbound Resend email addresses onto Postie's
Domain/SubTag envelope fields. Consumed by:

- `/Users/dtiemann/.openclaw/workspace/scripts/email-domain.sh` — Postie's shim.
- `openclaw.json.emailDomains` — route table.

See `docs/superpowers/specs/2026-04-17-address-aware-postie-design.md` for the
design context.

## Status

- V1 in use: `school`, `sports`, `general` routes.
- Config lives at `~/.openclaw/openclaw.json` → `emailDomains`.
- Parser is pure; CLI/shim are deterministic — Postie calls them once per turn.
- Per-domain confidence thresholds and per-domain allowlists are intentional deferrals (see design doc).
