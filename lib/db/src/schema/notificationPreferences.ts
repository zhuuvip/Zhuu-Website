import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const notificationPreferences = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  chat: boolean("chat").notNull().default(true),
  products: boolean("products").notNull().default(true),
  free: boolean("free").notNull().default(true),
  updates: boolean("updates").notNull().default(true),
  orders: boolean("orders").notNull().default(true),
  wallet: boolean("wallet").notNull().default(true),
  system: boolean("system").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
