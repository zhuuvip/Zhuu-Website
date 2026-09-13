import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const productOptionsTable = pgTable("product_options", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  duration: text("duration").notNull(),
  price: integer("price").notNull(),
  stock: integer("stock").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
