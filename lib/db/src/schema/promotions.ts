import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

export const promotions = pgTable("promotions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),

  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("PRODUCT"),
  link: text("link"),
  imageUrl: text("image_url"),

  durationDays: integer("duration_days").notNull(),
  price: integer("price").notNull(),

  status: text("status").notNull().default("PENDING"),

  startsAt: timestamp("starts_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Promotion = typeof promotions.$inferSelect;
