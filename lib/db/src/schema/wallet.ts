import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const walletsTable = pgTable("wallets", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  scope: text("scope").notNull().default("site"),
  balance: integer("balance").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const walletTransactionsTable = pgTable("wallet_transactions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  scope: text("scope").notNull().default("site"),
  type: text("type").notNull(),
  amount: integer("amount").notNull(),
  reference: text("reference").unique(),
  description: text("description"),
  status: text("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
