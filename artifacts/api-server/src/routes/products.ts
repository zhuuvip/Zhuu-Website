import { Router } from "express";
import { db } from "@workspace/db";
import { productsTable, productOptionsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";

const router = Router();

router.get("/products", async (_req, res) => {
  await db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT`);
  await db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_type TEXT DEFAULT 'WHATSAPP'`);
  await db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_value TEXT`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      invoice TEXT NOT NULL UNIQUE,
      product_id INTEGER NOT NULL,
      option_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      duration TEXT NOT NULL,
      amount INTEGER NOT NULL,
      whatsapp TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      payment_ref TEXT,
      qr_content TEXT,
      qr_image TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const products = await db.select().from(productsTable);
  const options = await db.select().from(productOptionsTable);
  return res.json(products.map(p => ({
    ...p,
    options: options.filter(o => o.productId === p.id),
  })));
});

router.post("/products", requireAdmin, async (req, res) => {
  const [product] = await db.insert(productsTable).values({
    name: req.body.name,
    imageUrl: req.body.imageUrl || null,
  }).returning();
  return res.json(product);
});

router.patch("/products/:id", requireAdmin, async (req, res) => {
  const [product] = await db.update(productsTable)
    .set({ name: req.body.name, imageUrl: req.body.imageUrl || null })
    .where(eq(productsTable.id, Number(req.params.id)))
    .returning();
  return res.json(product);
});

router.delete("/products/:id", requireAdmin, async (req, res) => {
  await db.delete(productOptionsTable)
    .where(eq(productOptionsTable.productId, Number(req.params.id)));
  await db.delete(productsTable)
    .where(eq(productsTable.id, Number(req.params.id)));
  return res.json({ ok: true });
});

router.post("/products/:id/options", requireAdmin, async (req, res) => {
  const [option] = await db.insert(productOptionsTable).values({
    productId: Number(req.params.id),
    duration: req.body.duration,
    price: Number(req.body.price),
    stock: Number(req.body.stock ?? 0),
  }).returning();
  return res.json(option);
});

router.patch("/products/options/:id", requireAdmin, async (req, res) => {
  const [option] = await db.update(productOptionsTable)
    .set({
      duration: req.body.duration,
      price: Number(req.body.price),
      stock: Number(req.body.stock),
    })
    .where(eq(productOptionsTable.id, Number(req.params.id)))
    .returning();
  return res.json(option);
});

router.delete("/products/options/:id", requireAdmin, async (req, res) => {
  await db.delete(productOptionsTable)
    .where(eq(productOptionsTable.id, Number(req.params.id)));
  return res.json({ ok: true });
});

export default router;
