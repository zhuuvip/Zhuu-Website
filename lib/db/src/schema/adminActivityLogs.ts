import { pgTable, serial, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const adminActivityLogsTable = pgTable("admin_activity_logs", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(),
  description: text("description").notNull(),
  adminEmail: text("admin_email"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type AdminActivityLog = typeof adminActivityLogsTable.$inferSelect;
