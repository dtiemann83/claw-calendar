-- Seed a baseline of household staples. Idempotent — re-running is safe.
-- Cadences are starting estimates; real cadence gets learned from purchase_history.

INSERT OR IGNORE INTO items (canonical_name, category, is_staple, staple_cadence_days, created_at) VALUES
  ('whole milk',         'dairy',     1, 7,  datetime('now')),
  ('eggs',               'dairy',     1, 7,  datetime('now')),
  ('butter',             'dairy',     1, 21, datetime('now')),
  ('yogurt',             'dairy',     1, 10, datetime('now')),
  ('cheese',             'dairy',     1, 14, datetime('now')),
  ('bread',              'bakery',    1, 7,  datetime('now')),
  ('bananas',            'produce',   1, 5,  datetime('now')),
  ('apples',             'produce',   1, 10, datetime('now')),
  ('onions',             'produce',   1, 14, datetime('now')),
  ('coffee',             'pantry',    1, 21, datetime('now')),
  ('olive oil',          'pantry',    1, 45, datetime('now')),
  ('pasta',              'pantry',    1, 14, datetime('now')),
  ('rice',               'pantry',    1, 45, datetime('now')),
  ('paper towels',       'household', 1, 21, datetime('now')),
  ('toilet paper',       'household', 1, 21, datetime('now')),
  ('laundry detergent',  'household', 1, 45, datetime('now')),
  ('dish soap',          'household', 1, 45, datetime('now')),
  ('trash bags',         'household', 1, 45, datetime('now'));

-- Seed a baseline alias for each staple so normalize() resolves the singular/plural lookups people actually type.
INSERT OR IGNORE INTO item_aliases (alias, item_id)
  SELECT canonical_name, id FROM items;

INSERT OR IGNORE INTO item_aliases (alias, item_id)
  SELECT 'milk',         id FROM items WHERE canonical_name = 'whole milk';
INSERT OR IGNORE INTO item_aliases (alias, item_id)
  SELECT 'egg',          id FROM items WHERE canonical_name = 'eggs';
INSERT OR IGNORE INTO item_aliases (alias, item_id)
  SELECT 'banana',       id FROM items WHERE canonical_name = 'bananas';
INSERT OR IGNORE INTO item_aliases (alias, item_id)
  SELECT 'apple',        id FROM items WHERE canonical_name = 'apples';
INSERT OR IGNORE INTO item_aliases (alias, item_id)
  SELECT 'onion',        id FROM items WHERE canonical_name = 'onions';
INSERT OR IGNORE INTO item_aliases (alias, item_id)
  SELECT 'tp',           id FROM items WHERE canonical_name = 'toilet paper';
INSERT OR IGNORE INTO item_aliases (alias, item_id)
  SELECT 'paper towel',  id FROM items WHERE canonical_name = 'paper towels';
INSERT OR IGNORE INTO item_aliases (alias, item_id)
  SELECT 'trash bag',    id FROM items WHERE canonical_name = 'trash bags';
