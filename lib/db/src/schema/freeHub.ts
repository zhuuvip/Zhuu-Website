import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const freePosts = pgTable("free_posts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("FREE"),
  link: text("link"),
  imageUrl: text("image_url"),
  pinned: boolean("pinned").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type FreePost = typeof freePosts.$inferSelect;
