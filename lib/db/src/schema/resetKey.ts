import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const resetKeyLogsTable = pgTable("reset_key_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  api: text("api").notNull(),
  key: text("key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ResetKeyLog = typeof resetKeyLogsTable.$inferSelect;
