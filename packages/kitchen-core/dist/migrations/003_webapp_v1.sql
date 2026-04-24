-- 003_webapp_v1.sql
-- Tables consumed by the chef-kitchen-webapp mini app.
-- Plan A creates all three up front so Plans B and C don't re-migrate.

CREATE TABLE IF NOT EXISTS recipes (
  id          INTEGER PRIMARY KEY,
  title       TEXT NOT NULL,
  source_url  TEXT,
  image_url   TEXT,
  imported_by TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  raw_json    TEXT
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id          INTEGER PRIMARY KEY,
  recipe_id   INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  raw_text    TEXT NOT NULL,
  item_id     INTEGER REFERENCES items(id),
  item_name   TEXT NOT NULL,
  qty_note    TEXT,
  position    INTEGER NOT NULL,
  excluded    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe
  ON recipe_ingredients(recipe_id);

CREATE TABLE IF NOT EXISTS cart_jobs (
  id            INTEGER PRIMARY KEY,
  recipe_id     INTEGER REFERENCES recipes(id),
  requested_by  TEXT NOT NULL,
  requested_at  TEXT NOT NULL,
  status        TEXT NOT NULL,
  review_url    TEXT,
  error         TEXT,
  updated_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cart_jobs_status ON cart_jobs(status);
