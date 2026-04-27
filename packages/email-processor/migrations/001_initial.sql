-- Allow gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS allowed_domains (
    domain      TEXT PRIMARY KEY,
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS routing_rules (
    address     TEXT PRIMARY KEY,
    action      TEXT NOT NULL CHECK (action IN ('calendar', 'ignore')),
    tag         TEXT,
    calendar_id TEXT,
    created_by  TEXT DEFAULT 'zoidberg',
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS emails (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    received_at  TIMESTAMPTZ DEFAULT now(),
    email_id     TEXT UNIQUE,
    from_addr    TEXT,
    to_addr      TEXT,
    subject      TEXT,
    full_content TEXT,
    status       TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN (
                        'pending','routing_unknown','processing',
                        'added','duplicate','ignored','no_event',
                        'parse_failed','dead_letter'
                      )),
    retry_count  INT DEFAULT 0,
    last_error   TEXT,
    processed_at TIMESTAMPTZ,
    event_uid    TEXT
);

CREATE OR REPLACE FUNCTION notify_email_change() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('email_pipeline', row_to_json(NEW)::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS email_pipeline_trigger ON emails;
CREATE TRIGGER email_pipeline_trigger
AFTER INSERT OR UPDATE ON emails
FOR EACH ROW EXECUTE FUNCTION notify_email_change();
