import { z } from "zod";
export declare const ItemSchema: z.ZodObject<{
    id: z.ZodNumber;
    canonicalName: z.ZodString;
    category: z.ZodNullable<z.ZodString>;
    isStaple: z.ZodBoolean;
    stapleCadenceDays: z.ZodNullable<z.ZodNumber>;
    createdAt: z.ZodString;
}, z.core.$strip>;
export type Item = z.infer<typeof ItemSchema>;
export declare const ListEntrySchema: z.ZodObject<{
    id: z.ZodNumber;
    itemId: z.ZodNumber;
    canonicalName: z.ZodString;
    quantityNote: z.ZodNullable<z.ZodString>;
    addedBy: z.ZodString;
    addedVia: z.ZodString;
    addedAt: z.ZodString;
    status: z.ZodEnum<{
        open: "open";
        bought: "bought";
        dropped: "dropped";
    }>;
    resolvedAt: z.ZodNullable<z.ZodString>;
    resolvedBy: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export type ListEntry = z.infer<typeof ListEntrySchema>;
export declare const PurchaseSchema: z.ZodObject<{
    id: z.ZodNumber;
    itemId: z.ZodNumber;
    canonicalName: z.ZodString;
    boughtAt: z.ZodString;
    boughtBy: z.ZodNullable<z.ZodString>;
    source: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export type Purchase = z.infer<typeof PurchaseSchema>;
export declare const PantryStatus: z.ZodEnum<{
    out: "out";
    stocked: "stocked";
    low: "low";
}>;
export type PantryStatus = z.infer<typeof PantryStatus>;
export declare const PantryEntrySchema: z.ZodObject<{
    itemId: z.ZodNumber;
    canonicalName: z.ZodString;
    status: z.ZodEnum<{
        out: "out";
        stocked: "stocked";
        low: "low";
    }>;
    updatedAt: z.ZodString;
    updatedBy: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export type PantryEntry = z.infer<typeof PantryEntrySchema>;
export declare const StapleDueSchema: z.ZodObject<{
    itemId: z.ZodNumber;
    canonicalName: z.ZodString;
    cadenceDays: z.ZodNumber;
    daysSinceLastPurchase: z.ZodNullable<z.ZodNumber>;
}, z.core.$strip>;
export type StapleDue = z.infer<typeof StapleDueSchema>;
export interface AddItemInput {
    text: string;
    by: string;
    via: string;
    quantityNote?: string;
    at?: Date;
}
export interface MarkBoughtInput {
    text: string;
    by?: string;
    source?: string;
    at?: Date;
}
export interface MarkPantryInput {
    text: string;
    status: PantryStatus;
    by?: string;
    at?: Date;
}
//# sourceMappingURL=types.d.ts.map