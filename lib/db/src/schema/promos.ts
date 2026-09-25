import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const promoCodesTable = pgTable(
  "promo_codes",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    audience: text("audience").notNull().default("MEMBER"),
    discountAmount: integer("discount_amount").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    maxUses: integer("max_uses"),
    usedCount: integer("used_count").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("promo_codes_code_audience_idx").on(
      table.code,
      table.audience,
    ),
  ],
);

export const promoCodeUsagesTable = pgTable(
  "promo_code_usages",
  {
    id: serial("id").primaryKey(),
    promoCodeId: integer("promo_code_id").notNull(),
    userId: text("user_id").notNull(),
    audience: text("audience").notNull(),
    orderId: integer("order_id"),
    discountAmount: integer("discount_amount").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("promo_code_usages_promo_user_idx").on(
      table.promoCodeId,
      table.userId,
    ),
  ],
);
