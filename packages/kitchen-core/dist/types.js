import { z } from "zod";
export const ItemSchema = z.object({
    id: z.number().int(),
    canonicalName: z.string(),
    category: z.string().nullable(),
    isStaple: z.boolean(),
    stapleCadenceDays: z.number().int().nullable(),
    createdAt: z.string(),
});
export const ListEntrySchema = z.object({
    id: z.number().int(),
    itemId: z.number().int(),
    canonicalName: z.string(),
    quantityNote: z.string().nullable(),
    addedBy: z.string(),
    addedVia: z.string(),
    addedAt: z.string(),
    status: z.enum(["open", "bought", "dropped"]),
    resolvedAt: z.string().nullable(),
    resolvedBy: z.string().nullable(),
});
export const PurchaseSchema = z.object({
    id: z.number().int(),
    itemId: z.number().int(),
    canonicalName: z.string(),
    boughtAt: z.string(),
    boughtBy: z.string().nullable(),
    source: z.string().nullable(),
});
export const PantryStatus = z.enum(["stocked", "low", "out"]);
export const PantryEntrySchema = z.object({
    itemId: z.number().int(),
    canonicalName: z.string(),
    status: PantryStatus,
    updatedAt: z.string(),
    updatedBy: z.string().nullable(),
});
export const StapleDueSchema = z.object({
    itemId: z.number().int(),
    canonicalName: z.string(),
    cadenceDays: z.number().int(),
    daysSinceLastPurchase: z.number().int().nullable(),
});
//# sourceMappingURL=types.js.map