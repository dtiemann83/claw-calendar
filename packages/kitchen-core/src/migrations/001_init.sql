-- Kitchen canonical store. Owned by Chef.
-- One item per real-world SKU-ish thing ("eggs", "whole milk").
-- Aliases are the free-text forms we accept on the wire.

CREATE TABLE IF NOT EXISTS items (
  id                   INTEGER PRIMARY KEY,
  canonical_name       TEXT NOT NULL UNIQUE,
  category             TEXT,
  is_staple            INTEGER NOT NULL DEFAULT 0,
  staple_cadence_days  INTEGER,
  created_at           TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS item_aliases (
  alias    TEXT PRIMARY KEY,
  item_id  INTEGER NOT NULL REFERENCES items(id)
);

CREATE TABLE IF NOT EXISTS shopping_list (
  id             INTEGER PRIMARY KEY,
  item_id        INTEGER NOT NULL REFERENCES items(id),
  quantity_note  TEXT,
  added_by       TEXT NOT NULL,
  added_via      TEXT NOT NULL,
  added_at       TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'open',
  resolved_at    TEXT,
  resolved_by    TEXT
);

CREATE INDEX IF NOT EXISTS idx_shopping_list_status ON shopping_list(status);
CREATE INDEX IF NOT EXISTS idx_shopping_list_item   ON shopping_list(item_id);

CREATE TABLE IF NOT EXISTS purchase_history (
  id         INTEGER PRIMARY KEY,
  item_id    INTEGER NOT NULL REFERENCES items(id),
  bought_at  TEXT NOT NULL,
  bought_by  TEXT,
  source     TEXT
);

CREATE INDEX IF NOT EXISTS idx_purchase_history_item ON purchase_history(item_id);
CREATE INDEX IF NOT EXISTS idx_purchase_history_at   ON purchase_history(bought_at);

CREATE TABLE IF NOT EXISTS pantry_state (
  item_id     INTEGER PRIMARY KEY REFERENCES items(id),
  status      TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  updated_by  TEXT
);
