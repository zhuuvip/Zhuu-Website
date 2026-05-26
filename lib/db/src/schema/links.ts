import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const linksTable = pgTable("links", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  icon: text("icon"),
  imageUrl: text("image_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertLinkSchema = createInsertSchema(linksTable).omit({ id: true, createdAt: true });
export const updateLinkSchema = insertLinkSchema.partial();

export type Link = typeof linksTable.$inferSelect;
export type InsertLink = z.infer<typeof insertLinkSchema>;
