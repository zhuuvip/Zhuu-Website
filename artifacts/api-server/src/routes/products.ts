import { Router } from "express";
import { db } from "@workspace/db";
import {
  productsTable,
  productOptionsTable,
  productKeysTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAdmin } from "../lib/auth.js";

const router = Router();

router.get("/products", async (_req, res) => {
  await db.execute(sql`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS image_url TEXT
  `);

  await db.execute(sql`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS delivery_type TEXT DEFAULT 'WHATSAPP'
  `);

  await db.execute(sql`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS delivery_value TEXT
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS product_keys (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL,
      option_id INTEGER NOT NULL,
      key TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'READY',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

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

  await db.execute(sql`
    ALTER TABLE product_options
    ADD COLUMN IF NOT EXISTS reseller_price INTEGER
  `);

  const products = await db.select().from(productsTable);
  const options = await db.select().from(productOptionsTable);

  return res.json(
    products.map((p) => ({
      ...p,
      options: options
        .filter((o) => o.productId === p.id)
        .map((o) => ({ ...o, resellerPrice: undefined })),
    })),
  );
});

router.post("/products", requireAdmin, async (req, res) => {
  const [product] = await db
    .insert(productsTable)
    .values({
      name: req.body.name,
      deliveryType: req.body.deliveryType || "WHATSAPP",
      deliveryValue: req.body.deliveryValue || null,
      imageUrl: req.body.imageUrl || null,
    })
    .returning();

  return res.json(product);
});

router.patch("/products/:id", requireAdmin, async (req, res) => {
  const [product] = await db
    .update(productsTable)
    .set({
      name: req.body.name,
      deliveryType: req.body.deliveryType || "WHATSAPP",
      deliveryValue: req.body.deliveryValue || null,
      imageUrl: req.body.imageUrl || null,
    })
    .where(eq(productsTable.id, Number(req.params.id)))
    .returning();

  return res.json(product);
});

router.delete("/products/:id", requireAdmin, async (req, res) => {
  await db
    .delete(productKeysTable)
    .where(eq(productKeysTable.productId, Number(req.params.id)));

  await db
    .delete(productOptionsTable)
    .where(eq(productOptionsTable.productId, Number(req.params.id)));

  await db
    .delete(productsTable)
    .where(eq(productsTable.id, Number(req.params.id)));

  return res.json({ ok: true });
});

router.post("/products/:id/options", requireAdmin, async (req, res) => {
  const [option] = await db
    .insert(productOptionsTable)
    .values({
      productId: Number(req.params.id),
      duration: req.body.duration,
      price: Number(req.body.price),
      stock: Number(req.body.stock ?? 0),
    })
    .returning();

  return res.json(option);
});

router.patch("/products/options/:id", requireAdmin, async (req, res) => {
  const [option] = await db
    .update(productOptionsTable)
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
  await db
    .delete(productKeysTable)
    .where(eq(productKeysTable.optionId, Number(req.params.id)));

  await db
    .delete(productOptionsTable)
    .where(eq(productOptionsTable.id, Number(req.params.id)));

  return res.json({ ok: true });
});

router.post(
  "/products/:productId/options/:optionId/keys",
  requireAdmin,
  async (req, res) => {
    const productId = Number(req.params.productId);
    const optionId = Number(req.params.optionId);

    const keys = Array.isArray(req.body.keys) ? req.body.keys : [];

    if (
      !Number.isInteger(productId) ||
      !Number.isInteger(optionId) ||
      !keys.length
    ) {
      return res.status(400).json({
        error: "Product, option, dan keys wajib diisi",
      });
    }

    const [option] = await db
      .select()
      .from(productOptionsTable)
      .where(eq(productOptionsTable.id, optionId));

    if (!option || option.productId !== productId) {
      return res.status(400).json({
        error: "Durasi tidak cocok dengan produk",
      });
    }

    const cleanKeys = [
      ...new Set(
        keys
          .map((key: unknown) => String(key).trim())
          .filter(Boolean),
      ),
    ];

    const values = cleanKeys.map((key) => ({
      productId,
      optionId,
      key: String(key),
      status: "READY",
    }));

    const inserted = await db
      .insert(productKeysTable)
      .values(values)
      .onConflictDoNothing({
        target: productKeysTable.key,
      })
      .returning();

    if (inserted.length > 0) {
      await db
        .update(productOptionsTable)
        .set({
          stock: option.stock + inserted.length,
        })
        .where(eq(productOptionsTable.id, optionId));
    }

    return res.json({
      added: inserted.length,
      skipped: cleanKeys.length - inserted.length,
      stock: option.stock + inserted.length,
    });
  },
);

export default router;
