import { Router } from "express";
import { requireAdmin } from "../lib/auth.js";
import { getDripProducts, getDripBalance } from "../lib/dripApi.js";
import { db } from "@workspace/db";
import { productOptionsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();
router.post("/admin/drip/sync-stock", requireAdmin, async (_req, res) => {
  try {
    const data = await getDripProducts();

    const dripProducts = Array.isArray(data)
      ? data
      : Array.isArray(data?.products)
        ? data.products
        : Array.isArray(data?.data)
          ? data.data
          : [];

    await db.execute(sql`
      ALTER TABLE product_options
      ADD COLUMN IF NOT EXISTS drip_variant_id INTEGER
    `);

    await db.execute(sql`
      ALTER TABLE product_options
      ADD COLUMN IF NOT EXISTS drip_stock INTEGER NOT NULL DEFAULT 0
    `);

    const options = await db.select().from(productOptionsTable);

    let updated = 0;
    let matched = 0;

    for (const option of options) {
      if (!option.dripVariantId) continue;

      const drip = dripProducts.find(
        (item: any) => Number(item.variant_id) === Number(option.dripVariantId)
      );

      if (!drip) continue;

      matched++;

      await db
        .update(productOptionsTable)
        .set({
          dripStock: Number(drip.in_stock ?? drip.local_stock ?? 0),
        })
        .where(eq(productOptionsTable.id, option.id));

      updated++;
    }

    return res.json({
      ok: true,
      totalOptions: options.length,
      matched,
      updated,
    });
  } catch (error) {
    console.error("DRIP stock sync error:", error);
    return res.status(502).json({
      error: "Gagal sinkronisasi stock DRIP",
    });
  }
});


router.get("/admin/drip/products", requireAdmin, async (_req, res) => {
  try {
    return res.json(await getDripProducts());
  } catch (error) {
    console.error(error);
    return res.status(502).json({ error: "Gagal mengambil produk DRIP" });
  }
});

router.get("/admin/drip/balance", requireAdmin, async (_req, res) => {
  try {
    return res.json(await getDripBalance());
  } catch (error) {
    console.error(error);
    return res.status(502).json({ error: "Gagal mengambil saldo DRIP" });
  }
});

export default router;

