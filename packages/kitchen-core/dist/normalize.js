/**
 * Lowercase, trim, collapse whitespace, strip leading quantity words like "a", "an", "some",
 * "a dozen", "2", "2x", etc. We keep the rest as-is — further canonicalization happens via
 * the alias table lookup.
 */
export function normalizeText(raw) {
    let s = raw.toLowerCase().trim();
    s = s.replace(/\s+/g, " ");
    // Strip a leading "a dozen", "half dozen", "2", "2x", "a", "an", "some" qualifier.
    s = s.replace(/^(a dozen|half dozen|a|an|some|\d+x?)\s+/, "");
    return s.trim();
}
/**
 * Naive singularizer: "eggs" -> "egg". Only used to generate an alias fallback.
 * Plurals that aren't just "+s" stay as-is and get stored verbatim.
 */
function toSingular(s) {
    if (s.endsWith("ies") && s.length > 3)
        return s.slice(0, -3) + "y";
    if (s.endsWith("es") && s.length > 2)
        return s.slice(0, -2);
    if (s.endsWith("s") && s.length > 1 && !s.endsWith("ss"))
        return s.slice(0, -1);
    return s;
}
/**
 * Resolve a free-text phrase to an item row, creating the item + alias on first sight.
 * - Try the raw alias (after normalize).
 * - Try the singular form as an alias.
 * - If both miss, create a new item with canonical_name = normalized text, plus aliases for
 *   both the normalized and singular forms.
 */
export function resolveItem(db, raw) {
    const normalized = normalizeText(raw);
    if (!normalized) {
        throw new Error(`empty item after normalize: ${JSON.stringify(raw)}`);
    }
    const singular = toSingular(normalized);
    const byAlias = db
        .prepare(`SELECT items.id AS id, items.canonical_name AS canonicalName
         FROM item_aliases
         JOIN items ON items.id = item_aliases.item_id
        WHERE item_aliases.alias = ?`)
        .get(normalized);
    if (byAlias) {
        return { itemId: byAlias.id, canonicalName: byAlias.canonicalName, created: false };
    }
    if (singular !== normalized) {
        const bySingular = db
            .prepare(`SELECT items.id AS id, items.canonical_name AS canonicalName
           FROM item_aliases
           JOIN items ON items.id = item_aliases.item_id
          WHERE item_aliases.alias = ?`)
            .get(singular);
        if (bySingular) {
            // Learn the new alias for next time.
            db.prepare(`INSERT OR IGNORE INTO item_aliases (alias, item_id) VALUES (?, ?)`).run(normalized, bySingular.id);
            return { itemId: bySingular.id, canonicalName: bySingular.canonicalName, created: false };
        }
    }
    // Miss — create the item with the normalized form as canonical, and register aliases.
    const insert = db
        .prepare(`INSERT INTO items (canonical_name, is_staple, created_at) VALUES (?, 0, datetime('now')) RETURNING id`)
        .get(normalized);
    db.prepare(`INSERT OR IGNORE INTO item_aliases (alias, item_id) VALUES (?, ?)`).run(normalized, insert.id);
    if (singular !== normalized) {
        db.prepare(`INSERT OR IGNORE INTO item_aliases (alias, item_id) VALUES (?, ?)`).run(singular, insert.id);
    }
    return { itemId: insert.id, canonicalName: normalized, created: true };
}
//# sourceMappingURL=normalize.js.map