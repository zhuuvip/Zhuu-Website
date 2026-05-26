import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const songsTable = pgTable("songs", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  url: text("url").notNull(),
  coverUrl: text("cover_url"),
  duration: integer("duration"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertSongSchema = createInsertSchema(songsTable).omit({ id: true, createdAt: true });

export type Song = typeof songsTable.$inferSelect;
export type InsertSong = z.infer<typeof insertSongSchema>;
