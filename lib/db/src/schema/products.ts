import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  imageUrl: text("image_url"),
  deliveryType: text("delivery_type").default("WHATSAPP"),
  deliveryValue: text("delivery_value"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const productOptionsTable = pgTable("product_options", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  duration: text("duration").notNull(),
  price: integer("price").notNull(),
  resellerPrice: integer("reseller_price"),
  dripVariantId: integer("drip_variant_id"),
  dripStock: integer("drip_stock").notNull().default(0),
  stock: integer("stock").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const productKeysTable = pgTable("product_keys", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  optionId: integer("option_id").notNull(),
  key: text("key").notNull().unique(),
  status: text("status").notNull().default("READY"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
