import { Router } from "express";
import { DRIP_CATALOG } from "../data/dripCatalog.js";
import { db } from "@workspace/db";
import {
  productsTable,
  productOptionsTable,
  productKeysTable,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { requireAdmin, isAdmin } from "../lib/auth.js";

const router = Router();

let productsSchemaReady: Promise<void> | null = null;

function ensureProductsSchema(): Promise<void> {
  if (!productsSchemaReady) {
    productsSchemaReady = db.execute(sql`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 1
    `).then(async () => {
      await db.execute(sql`
        UPDATE products
        SET sort_order = 1
        WHERE sort_order < 1
      `);
    }).catch((e) => {
      productsSchemaReady = null;
      throw e;
    });
  }
  return productsSchemaReady;
}

router.get("/products", async (req, res) => {
  await ensureProductsSchema();
  const admin = isAdmin(req);
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

  await db.execute(sql`
    ALTER TABLE product_options
    ADD COLUMN IF NOT EXISTS drip_variant_id INTEGER
  `);

  await db.execute(sql`
    ALTER TABLE product_options
    ADD COLUMN IF NOT EXISTS drip_stock INTEGER NOT NULL DEFAULT 0
  `);

  const products = (await db.select().from(productsTable).orderBy(sql`sort_order ASC`, sql`id ASC`)).map((p) =>
    admin ? p : { ...p, deliveryValue: null },
  );
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

router.post("/products/normalize-order", requireAdmin, async (_req, res) => {
  const products = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      sortOrder: productsTable.sortOrder,
    })
    .from(productsTable)
    .orderBy(sql`sort_order ASC`, sql`id ASC`);

  for (let i = 0; i < products.length; i++) {
    await db
      .update(productsTable)
      .set({ sortOrder: i + 1 })
      .where(eq(productsTable.id, products[i].id));
  }

  return res.json({
    success: true,
    updated: products.map((p, i) => ({
      id: p.id,
      name: p.name,
      oldSortOrder: p.sortOrder,
      newSortOrder: i + 1,
    })),
  });
});

router.post("/products", requireAdmin, async (req, res) => {
  const rawSortOrder = String(req.body.sortOrder ?? "").trim();

  const sortOrder = rawSortOrder
    ? Number(rawSortOrder)
    : Number(
        (
          await db
            .select({ max: sql<number>`COALESCE(MAX(sort_order), 0)` })
            .from(productsTable)
        )[0]?.max ?? 0,
      ) + 1;

  const [product] = await db
    .insert(productsTable)
    .values({
      name: req.body.name,
      deliveryType: req.body.deliveryType || "WHATSAPP",
      deliveryValue: req.body.deliveryValue || null,
      imageUrl: req.body.imageUrl || null,
      sortOrder,
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
      sortOrder: Number(req.body.sortOrder ?? 1),
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
      dripVariantId: req.body.dripVariantId ? Number(req.body.dripVariantId) : null,
      dripStock: Number(req.body.dripStock ?? 0),
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
      dripVariantId: req.body.dripVariantId ? Number(req.body.dripVariantId) : null,
      dripStock: Number(req.body.dripStock ?? 0),
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


router.post(
  "/admin/products/import-drip-catalog",
  requireAdmin,
  async (_req, res) => {
    try {
      const expectedProducts = 41;
      const expectedVariants = 165;

      const actualVariants = DRIP_CATALOG.reduce(
        (total, product) => total + product.variants.length,
        0,
      );

      if (
        DRIP_CATALOG.length !== expectedProducts ||
        actualVariants !== expectedVariants
      ) {
        return res.status(500).json({
          error: "DRIP catalog tidak lengkap",
          products: DRIP_CATALOG.length,
          variants: actualVariants,
          expectedProducts,
          expectedVariants,
        });
      }

      let productsCreated = 0;
      let productsUpdated = 0;
      let variantsCreated = 0;
      let variantsUpdated = 0;

      for (let index = 0; index < DRIP_CATALOG.length; index++) {
        const catalogProduct = DRIP_CATALOG[index];
        const sortOrder = index + 1;

        const [existingProduct] = await db
          .select()
          .from(productsTable)
          .where(eq(productsTable.name, catalogProduct.name));

        let productId: number;

        if (existingProduct) {
          productId = existingProduct.id;

          await db
            .update(productsTable)
            .set({
              sortOrder,
            })
            .where(eq(productsTable.id, productId));

          productsUpdated++;
        } else {
          const [createdProduct] = await db
            .insert(productsTable)
            .values({
              name: catalogProduct.name,
              deliveryType: "WHATSAPP",
              sortOrder,
            })
            .returning();

          productId = createdProduct.id;
          productsCreated++;
        }

        for (const variant of catalogProduct.variants) {
          const [existingOption] = await db
            .select()
            .from(productOptionsTable)
            .where(
              and(
                eq(productOptionsTable.productId, productId),
                eq(productOptionsTable.dripVariantId, variant.id),
              ),
            );

          if (existingOption) {
            await db
              .update(productOptionsTable)
              .set({
                duration: variant.duration,
                price: variant.memberPrice,
                resellerPrice: variant.resellerPrice,
              })
              .where(eq(productOptionsTable.id, existingOption.id));

            variantsUpdated++;
          } else {
            await db.insert(productOptionsTable).values({
              productId,
              duration: variant.duration,
              price: variant.memberPrice,
              resellerPrice: variant.resellerPrice,
              dripVariantId: variant.id,
              dripStock: 0,
              stock: 0,
            });

            variantsCreated++;
          }
        }
      }

      return res.json({
        ok: true,
        catalogProducts: DRIP_CATALOG.length,
        catalogVariants: actualVariants,
        productsCreated,
        productsUpdated,
        variantsCreated,
        variantsUpdated,
      });
    } catch (error) {
      console.error("DRIP catalog import error:", error);

      return res.status(500).json({
        error: "Gagal import DRIP catalog",
      });
    }
  },
);

export default router;
