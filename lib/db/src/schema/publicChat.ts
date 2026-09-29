import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const publicChatMessages = pgTable("public_chat_messages", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const insertPublicChatMessageSchema =
  createInsertSchema(publicChatMessages).omit({
    id: true,
    createdAt: true,
  });

export type PublicChatMessage = typeof publicChatMessages.$inferSelect;
export type InsertPublicChatMessage = z.infer<
  typeof insertPublicChatMessageSchema
>;
