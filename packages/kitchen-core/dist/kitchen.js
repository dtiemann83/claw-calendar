import { openDb } from "./db.js";
import { resolveItem } from "./normalize.js";
/**
 * High-level operations on Chef's kitchen DB. Each method is narrow, synchronous (better-sqlite3),
 * and returns data shaped for the CLI / agent to consume.
 */
export class KitchenClient {
    db;
    constructor(db) {
        this.db = db;
    }
    static open(path) {
        return new KitchenClient(openDb({ path }));
    }
    /** Add to the running list. Dedupes against existing open entries for the same item. */
    addItem(input) {
        const when = (input.at ?? new Date()).toISOString();
        const resolved = resolveItem(this.db, input.text);
        // If the item is already open on the list, don't create a duplicate row.
        const existing = this.db
            .prepare(`SELECT id FROM shopping_list WHERE item_id = ? AND status = 'open'`)
            .get(resolved.itemId);
        if (existing) {
            return { itemId: resolved.itemId, listId: existing.id, created: false };
        }
        const row = this.db
            .prepare(`INSERT INTO shopping_list
           (item_id, quantity_note, added_by, added_via, added_at, status)
         VALUES (?, ?, ?, ?, ?, 'open')
         RETURNING id`)
            .get(resolved.itemId, input.quantityNote ?? null, input.by, input.via, when);
        return { itemId: resolved.itemId, listId: row.id, created: true };
    }
    /** Mark an item bought: closes any open list rows for it and records a purchase. */
    markBought(input) {
        const when = (input.at ?? new Date()).toISOString();
        const resolved = resolveItem(this.db, input.text);
        this.db
            .prepare(`UPDATE shopping_list
            SET status = 'bought', resolved_at = ?, resolved_by = ?
          WHERE item_id = ? AND status = 'open'`)
            .run(when, input.by ?? null, resolved.itemId);
        const row = this.db
            .prepare(`INSERT INTO purchase_history (item_id, bought_at, bought_by, source)
         VALUES (?, ?, ?, ?) RETURNING id`)
            .get(resolved.itemId, when, input.by ?? null, input.source ?? "manual");
        // Bumping pantry to stocked is a reasonable default; user can markLow/markOut later.
        this.db
            .prepare(`INSERT INTO pantry_state (item_id, status, updated_at, updated_by)
         VALUES (?, 'stocked', ?, ?)
         ON CONFLICT(item_id) DO UPDATE SET status='stocked', updated_at=excluded.updated_at, updated_by=excluded.updated_by`)
            .run(resolved.itemId, when, input.by ?? null);
        return { itemId: resolved.itemId, purchaseId: row.id };
    }
    /** Mark an item out-of-stock. Also adds it to the list (that's the whole point). */
    markOut(input) {
        const when = (input.at ?? new Date()).toISOString();
        const resolved = resolveItem(this.db, input.text);
        this._setPantry(resolved.itemId, "out", when, input.by ?? null);
        // Also add to the list so it doesn't get forgotten.
        const existing = this.db
            .prepare(`SELECT id FROM shopping_list WHERE item_id = ? AND status = 'open'`)
            .get(resolved.itemId);
        if (!existing) {
            this.db
                .prepare(`INSERT INTO shopping_list (item_id, quantity_note, added_by, added_via, added_at, status)
           VALUES (?, NULL, ?, 'pantry-out', ?, 'open')`)
                .run(resolved.itemId, input.by ?? "Chef", when);
        }
    }
    /** Mark an item running-low. Does NOT add to the list (Chef will nudge via digest instead). */
    markLow(input) {
        const when = (input.at ?? new Date()).toISOString();
        const resolved = resolveItem(this.db, input.text);
        this._setPantry(resolved.itemId, "low", when, input.by ?? null);
    }
    _setPantry(itemId, status, when, by) {
        this.db
            .prepare(`INSERT INTO pantry_state (item_id, status, updated_at, updated_by)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(item_id) DO UPDATE SET status=excluded.status, updated_at=excluded.updated_at, updated_by=excluded.updated_by`)
            .run(itemId, status, when, by);
    }
    /** Return the open shopping list, oldest first. */
    list() {
        const rows = this.db
            .prepare(`SELECT shopping_list.id AS id,
                shopping_list.item_id AS itemId,
                items.canonical_name AS canonicalName,
                shopping_list.quantity_note AS quantityNote,
                shopping_list.added_by AS addedBy,
                shopping_list.added_via AS addedVia,
                shopping_list.added_at AS addedAt,
                shopping_list.status AS status,
                shopping_list.resolved_at AS resolvedAt,
                shopping_list.resolved_by AS resolvedBy
           FROM shopping_list
           JOIN items ON items.id = shopping_list.item_id
          WHERE shopping_list.status = 'open'
          ORDER BY shopping_list.added_at ASC`)
            .all();
        return rows;
    }
    /** Purchase history since a given date (inclusive), newest first. */
    history(opts) {
        const sinceIso = opts.since.toISOString();
        return this.db
            .prepare(`SELECT purchase_history.id AS id,
                purchase_history.item_id AS itemId,
                items.canonical_name AS canonicalName,
                purchase_history.bought_at AS boughtAt,
                purchase_history.bought_by AS boughtBy,
                purchase_history.source AS source
           FROM purchase_history
           JOIN items ON items.id = purchase_history.item_id
          WHERE purchase_history.bought_at >= ?
          ORDER BY purchase_history.bought_at DESC`)
            .all(sinceIso);
    }
    /** Staples that haven't been bought within their cadence. Never-bought staples count as due. */
    staplesDue(asOf) {
        const asOfIso = asOf.toISOString();
        // For each staple, find its most recent purchase (if any) and compare to cadence.
        const rows = this.db
            .prepare(`SELECT items.id AS itemId,
                items.canonical_name AS canonicalName,
                items.staple_cadence_days AS cadenceDays,
                (SELECT MAX(bought_at) FROM purchase_history WHERE purchase_history.item_id = items.id) AS lastBoughtAt
           FROM items
          WHERE items.is_staple = 1`)
            .all();
        const asOfMs = Date.parse(asOfIso);
        const due = [];
        for (const r of rows) {
            if (!r.lastBoughtAt) {
                due.push({
                    itemId: r.itemId,
                    canonicalName: r.canonicalName,
                    cadenceDays: r.cadenceDays,
                    daysSinceLastPurchase: null,
                });
                continue;
            }
            const days = Math.floor((asOfMs - Date.parse(r.lastBoughtAt)) / (24 * 3600 * 1000));
            if (days >= r.cadenceDays) {
                due.push({
                    itemId: r.itemId,
                    canonicalName: r.canonicalName,
                    cadenceDays: r.cadenceDays,
                    daysSinceLastPurchase: days,
                });
            }
        }
        return due;
    }
    /** Pantry rows where status is 'low' or 'out'. */
    pantryAlerts() {
        return this.db
            .prepare(`SELECT pantry_state.item_id AS itemId,
                items.canonical_name AS canonicalName,
                pantry_state.status AS status,
                pantry_state.updated_at AS updatedAt,
                pantry_state.updated_by AS updatedBy
           FROM pantry_state
           JOIN items ON items.id = pantry_state.item_id
          WHERE pantry_state.status IN ('low', 'out')
          ORDER BY pantry_state.updated_at DESC`)
            .all();
    }
    /**
     * Plain-text morning summary. Shape is stable; Chef formats it into email / Telegram outbound.
     */
    digest(asOf) {
        const list = this.list();
        const due = this.staplesDue(asOf);
        const alerts = this.pantryAlerts();
        const lines = [];
        lines.push(`Chef's morning digest — ${asOf.toDateString()}`);
        lines.push("");
        if (list.length === 0) {
            lines.push("Shopping list: empty.");
        }
        else {
            lines.push(`Shopping list (${list.length}):`);
            for (const e of list) {
                const by = `— added by ${e.addedBy} via ${e.addedVia}`;
                const qty = e.quantityNote ? ` (${e.quantityNote})` : "";
                lines.push(`  • ${e.canonicalName}${qty} ${by}`);
            }
        }
        lines.push("");
        if (due.length === 0) {
            lines.push("No staples overdue.");
        }
        else {
            lines.push(`Staples due (${due.length}):`);
            for (const d of due) {
                const since = d.daysSinceLastPurchase == null
                    ? "never bought"
                    : `${d.daysSinceLastPurchase}d since last (cadence ${d.cadenceDays}d)`;
                lines.push(`  • ${d.canonicalName} — ${since}`);
            }
        }
        if (alerts.length > 0) {
            lines.push("");
            lines.push(`Pantry alerts (${alerts.length}):`);
            for (const a of alerts) {
                lines.push(`  • ${a.canonicalName} — ${a.status}`);
            }
        }
        return lines.join("\n");
    }
}
//# sourceMappingURL=kitchen.js.map