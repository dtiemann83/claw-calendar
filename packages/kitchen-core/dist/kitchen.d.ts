import type Database from "better-sqlite3";
import type { AddItemInput, ListEntry, MarkBoughtInput, MarkPantryInput, PantryEntry, Purchase, StapleDue } from "./types.js";
/**
 * High-level operations on Chef's kitchen DB. Each method is narrow, synchronous (better-sqlite3),
 * and returns data shaped for the CLI / agent to consume.
 */
export declare class KitchenClient {
    private db;
    constructor(db: Database.Database);
    static open(path?: string): KitchenClient;
    /** Add to the running list. Dedupes against existing open entries for the same item. */
    addItem(input: AddItemInput): {
        itemId: number;
        listId: number;
        created: boolean;
    };
    /** Mark an item bought: closes any open list rows for it and records a purchase. */
    markBought(input: MarkBoughtInput): {
        itemId: number;
        purchaseId: number;
    };
    /** Mark an item out-of-stock. Also adds it to the list (that's the whole point). */
    markOut(input: MarkPantryInput | {
        text: string;
        by?: string;
        at?: Date;
    }): void;
    /** Mark an item running-low. Does NOT add to the list (Chef will nudge via digest instead). */
    markLow(input: MarkPantryInput | {
        text: string;
        by?: string;
        at?: Date;
    }): void;
    private _setPantry;
    /** Return the open shopping list, oldest first. */
    list(): ListEntry[];
    /** Purchase history since a given date (inclusive), newest first. */
    history(opts: {
        since: Date;
    }): Purchase[];
    /** Staples that haven't been bought within their cadence. Never-bought staples count as due. */
    staplesDue(asOf: Date): StapleDue[];
    /** Pantry rows where status is 'low' or 'out'. */
    pantryAlerts(): PantryEntry[];
    /**
     * Plain-text morning summary. Shape is stable; Chef formats it into email / Telegram outbound.
     */
    digest(asOf: Date): string;
}
//# sourceMappingURL=kitchen.d.ts.map