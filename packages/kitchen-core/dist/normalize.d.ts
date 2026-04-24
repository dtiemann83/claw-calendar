import type Database from "better-sqlite3";
/**
 * Lowercase, trim, collapse whitespace, strip leading quantity words like "a", "an", "some",
 * "a dozen", "2", "2x", etc. We keep the rest as-is — further canonicalization happens via
 * the alias table lookup.
 */
export declare function normalizeText(raw: string): string;
export interface ResolvedItem {
    itemId: number;
    canonicalName: string;
    created: boolean;
}
/**
 * Resolve a free-text phrase to an item row, creating the item + alias on first sight.
 * - Try the raw alias (after normalize).
 * - Try the singular form as an alias.
 * - If both miss, create a new item with canonical_name = normalized text, plus aliases for
 *   both the normalized and singular forms.
 */
export declare function resolveItem(db: Database.Database, raw: string): ResolvedItem;
//# sourceMappingURL=normalize.d.ts.map