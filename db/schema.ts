import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const profiles = sqliteTable("profiles", {
  id: text("id").primaryKey(),            // UUID string
  name: text("name").notNull(),
  color: text("color").notNull().default("#3b82f6"),  // hex color
  avatarUrl: text("avatar_url"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
