import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

// Persistent membership — unlike userDailyLimitsTable's per-day bonus
// columns (which reset every day), this survives across days. A premium
// member gets a permanently higher AI/Tools daily limit for as long as
// this row exists (no expiry column yet — add one later if you want
// subscriptions instead of lifetime purchases).
export const premiumMembersTable = pgTable("premium_members", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  tier: text("tier").notNull(), // "silver" | "gold" (extend as needed)
  aiBonus: integer("ai_bonus").notNull().default(0),
  toolsBonus: integer("tools_bonus").notNull().default(0),
  amountPaid: integer("amount_paid").notNull(),
  purchasedAt: timestamp("purchased_at", { withTimezone: true }).defaultNow().notNull(),
});

export type PremiumMember = typeof premiumMembersTable.$inferSelect;
