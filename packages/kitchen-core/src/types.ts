import { z } from "zod"

export const ItemSchema = z.object({
  id: z.number().int(),
  canonicalName: z.string(),
  category: z.string().nullable(),
  isStaple: z.boolean(),
  stapleCadenceDays: z.number().int().nullable(),
  createdAt: z.string(),
})
export type Item = z.infer<typeof ItemSchema>

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
})
export type ListEntry = z.infer<typeof ListEntrySchema>

export const PurchaseSchema = z.object({
  id: z.number().int(),
  itemId: z.number().int(),
  canonicalName: z.string(),
  boughtAt: z.string(),
  boughtBy: z.string().nullable(),
  source: z.string().nullable(),
})
export type Purchase = z.infer<typeof PurchaseSchema>

export const PantryStatus = z.enum(["stocked", "low", "out"])
export type PantryStatus = z.infer<typeof PantryStatus>

export const PantryEntrySchema = z.object({
  itemId: z.number().int(),
  canonicalName: z.string(),
  status: PantryStatus,
  updatedAt: z.string(),
  updatedBy: z.string().nullable(),
})
export type PantryEntry = z.infer<typeof PantryEntrySchema>

export const StapleDueSchema = z.object({
  itemId: z.number().int(),
  canonicalName: z.string(),
  cadenceDays: z.number().int(),
  daysSinceLastPurchase: z.number().int().nullable(),
})
export type StapleDue = z.infer<typeof StapleDueSchema>

export interface AddItemInput {
  text: string
  by: string
  via: string
  quantityNote?: string
  at?: Date
}

export interface MarkBoughtInput {
  text: string
  by?: string
  source?: string
  at?: Date
}

export interface MarkPantryInput {
  text: string
  status: PantryStatus
  by?: string
  at?: Date
}
