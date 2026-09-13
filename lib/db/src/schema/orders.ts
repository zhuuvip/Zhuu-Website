import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  invoice: text("invoice").notNull().unique(),
  productId: integer("product_id").notNull(),
  optionId: integer("option_id").notNull(),
  productName: text("product_name").notNull(),
  duration: text("duration").notNull(),
  amount: integer("amount").notNull(),
  whatsapp: text("whatsapp"),
  status: text("status").notNull().default("PENDING"),
  paymentRef: text("payment_ref"),
  qrContent: text("qr_content"),
  qrImage: text("qr_image"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
