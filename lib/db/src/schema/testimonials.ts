import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const testimonialsTable = pgTable("testimonials", {
  id: serial("id").primaryKey(),

  orderId: integer("order_id"),
  customerName: text("customer_name").notNull(),

  productId: integer("product_id"),
  productName: text("product_name").notNull(),
  duration: text("duration").notNull(),

  purchaseType: text("purchase_type").notNull().default("MANUAL"),

  rating: integer("rating").notNull(),
  message: text("message").notNull(),
  imageUrl: text("image_url"),

  status: text("status").notNull().default("PENDING"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),

  publishedAt: timestamp("published_at", { withTimezone: true }),
});

export const insertTestimonialSchema = createInsertSchema(testimonialsTable).omit({
  id: true,
  createdAt: true,
});

export type Testimonial = typeof testimonialsTable.$inferSelect;
export type InsertTestimonial = z.infer<typeof insertTestimonialSchema>;
