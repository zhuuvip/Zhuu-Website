import { Router } from "express";
import { DRIP_CATALOG } from "../data/dripCatalog.js";
import { db } from "@workspace/db";
import {
  productsTable,
  productOptionsTable,
  productKeysTable,
  ordersTable,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { requireAdmin, isAdmin } from "../lib/auth.js";
import { getDripProducts } from "../lib/dripApi.js";

const router = Router();

function getCatalogGroup(name: string) {
  const upper = name.toUpperCase();

  if (upper.includes("DRIP")) return "DRIP";
  if (upper.includes("HG")) return "HG";
  if (upper.includes("FLURIOTE")) return "FLURIOTE";
  if (upper.includes("MIGUL")) return "MIGUL";
  if (upper.includes("PATO")) return "PATO";
  if (upper.includes("SILENT")) return "SILENT";
  if (upper.includes("ROOT")) return "ROOT";
  if (upper.includes("IOS")) return "IOS";
  if (upper.includes("ANDROID")) return "ANDROID";
  if (upper.includes("FF")) return "FF";

  return "OTHER";
}

function findImageUrl(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;

  const object = value as Record<string, unknown>;

  const keys = [
    "image_url",
    "imageUrl",
    "logo_url",
    "logoUrl",
    "thumbnail",
    "thumbnail_url",
    "thumbnailUrl",
    "icon_url",
    "iconUrl",
    "image",
    "logo",
    "icon",
  ];

  for (const key of keys) {
    const candidate = object[key];

    if (
      typeof candidate === "string" &&
      /^https?:\/\//i.test(candidate.trim())
    ) {
      return candidate.trim();
    }
  }

  return null;
}


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
  return productsSchemaReady as Promise<void>;
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

  const products = (
    await db
      .select()
      .from(productsTable)
      .orderBy(sql`sort_order ASC`, sql`id ASC`)
  ).map((p) => (admin ? p : { ...p, deliveryValue: null }));

  const options = await db.select().from(productOptionsTable);

  const purchaseCounts = await db
    .select({
      productId: ordersTable.productId,
      purchaseCount: sql<number>`COUNT(*)`,
    })
    .from(ordersTable)
    .where(eq(ordersTable.status, "PAID"))
    .groupBy(ordersTable.productId);

  const purchaseCountMap = new Map(
    purchaseCounts.map((row) => [
      row.productId,
      Number(row.purchaseCount),
    ]),
  );

  return res.json(
    products.map((p) => ({
      ...p,
      purchaseCount: purchaseCountMap.get(p.id) ?? 0,
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
  const optionId = Number(req.params.id);

  const [current] = await db
    .select()
    .from(productOptionsTable)
    .where(eq(productOptionsTable.id, optionId));

  if (!current) {
    return res.status(404).json({ error: "Option tidak ditemukan" });
  }

  const updateData: Record<string, unknown> = {};

  if (req.body.duration !== undefined && req.body.duration !== "") {
    updateData.duration = String(req.body.duration).trim();
  }

  if (req.body.price !== undefined && req.body.price !== "") {
    const value = Number(req.body.price);
    if (!Number.isInteger(value) || value < 0) {
      return res.status(400).json({ error: "Harga member tidak valid" });
    }
    updateData.price = value;
  }

  if (req.body.resellerPrice !== undefined) {
    if (req.body.resellerPrice === "" || req.body.resellerPrice === null) {
      updateData.resellerPrice = null;
    } else {
      const value = Number(req.body.resellerPrice);
      if (!Number.isInteger(value) || value < 0) {
        return res.status(400).json({ error: "Harga reseller tidak valid" });
      }
      updateData.resellerPrice = value;
    }
  }

  if (req.body.stock !== undefined && req.body.stock !== "") {
    const value = Number(req.body.stock);
    if (!Number.isInteger(value) || value < 0) {
      return res.status(400).json({ error: "Stock tidak valid" });
    }
    updateData.stock = value;
  }

  if (req.body.dripVariantId !== undefined) {
    if (req.body.dripVariantId === "" || req.body.dripVariantId === null) {
      updateData.dripVariantId = null;
    } else {
      const value = Number(req.body.dripVariantId);
      if (!Number.isInteger(value) || value <= 0) {
        return res.status(400).json({ error: "DRIP Variant ID tidak valid" });
      }
      updateData.dripVariantId = value;
    }
  }

  if (req.body.dripStock !== undefined && req.body.dripStock !== "") {
    const value = Number(req.body.dripStock);
    if (!Number.isInteger(value) || value < 0) {
      return res.status(400).json({ error: "DRIP Stock tidak valid" });
    }
    updateData.dripStock = value;
  }

  const [option] = await db
    .update(productOptionsTable)
    .set(updateData)
    .where(eq(productOptionsTable.id, optionId))
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
      await db.execute(sql`
        ALTER TABLE products
        ADD COLUMN IF NOT EXISTS image_url TEXT
      `);

      await db.execute(sql`
        ALTER TABLE product_options
        ADD COLUMN IF NOT EXISTS drip_variant_id INTEGER
      `);

      await db.execute(sql`
        ALTER TABLE product_options
        ADD COLUMN IF NOT EXISTS drip_stock INTEGER NOT NULL DEFAULT 0
      `);

      const raw: any = await getDripProducts();

      console.log(
        "DRIP RAW STRUCTURE:",
        JSON.stringify(
          raw,
          (_key, value) =>
            typeof value === "string" && value.length > 200
              ? value.slice(0, 200) + "..."
              : value,
          2,
        ).slice(0, 12000),
      );

      console.log(
        "DRIP FIRST ITEM:",
        JSON.stringify(
          Array.isArray(raw)
            ? raw[0]
            : raw?.data?.[0] ??
              raw?.products?.[0] ??
              raw?.data ??
              raw?.products ??
              raw,
          null,
          2,
        ).slice(0, 8000),
      );

      const dripProducts: any[] =
        Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.data)
            ? raw.data
            : Array.isArray(raw?.products)
              ? raw.products
              : [];

      if (String(_req.query.debug ?? "") === "__disabled__") {
        return res.json({
          debug: true,
          rawType: Array.isArray(raw) ? "array" : typeof raw,
          rawKeys:
            raw && typeof raw === "object" && !Array.isArray(raw)
              ? Object.keys(raw)
              : [],
          totalDetected: dripProducts.length,
          sample: dripProducts.slice(0, 2),
        });
      }

      if (!dripProducts.length) {
        return res.status(502).json({
          error: "DRIP API tidak mengembalikan produk",
          dripResponseKeys:
            raw && typeof raw === "object"
              ? Object.keys(raw)
              : [],
          dripSuccess:
            raw && typeof raw === "object"
              ? raw.success ?? null
              : null,
          dripError:
            raw && typeof raw === "object"
              ? raw.error ?? null
              : null,
        });
      }

      const getNumber = (...values: unknown[]): number | null => {
        for (const value of values) {
          if (typeof value === "number" && Number.isFinite(value)) {
            return value;
          }

          if (typeof value === "string" && value.trim()) {
            const parsed = Number(
              value.replace(/[^\d.-]/g, ""),
            );

            if (Number.isFinite(parsed)) return parsed;
          }
        }

        return null;
      };

      const getText = (...values: unknown[]): string | null => {
        for (const value of values) {
          if (typeof value === "string" && value.trim()) {
            return value.trim();
          }
        }

        return null;
      };

      const getVariantId = (variant: any): number | null => {
        const id = getNumber(
          variant?.variant_id,
          variant?.variantId,
          variant?.id,
        );

        return id && Number.isInteger(id) && id > 0 ? id : null;
      };

      const getStock = (variant: any): number => {
        const stock = getNumber(
          variant?.in_stock,
          variant?.local_stock,
          variant?.stock,
          variant?.stock_count,
          variant?.quantity,
          variant?.available_stock,
          variant?.availableStock,
        );

        return stock !== null && stock >= 0
          ? Math.floor(stock)
          : 0;
      };

      const getDuration = (variant: any): string =>
        getText(
          variant?.duration,
          variant?.period,
          variant?.name,
          variant?.title,
          variant?.duration_name,
          variant?.durationName,
        ) ?? "Default";

      const getProductName = (item: any): string | null =>
        getText(
          item?.name,
          item?.product_name,
          item?.productName,
          item?.title,
          item?.product,
        );

      const getVariants = (item: any): any[] =>
        Array.isArray(item?.variants)
          ? item.variants
          : [item];

      /*
       * DRIP_CATALOG hanya dipakai sebagai fallback harga
       * untuk variant lama.
       *
       * Jumlah product/variant TIDAK lagi dibatasi 41/165.
       */
      const catalogByVariant = new Map<
        number,
        {
          duration: string;
          resellerPrice: number;
          memberPrice: number;
        }
      >();

      for (const product of DRIP_CATALOG) {
        for (const variant of product.variants) {
          catalogByVariant.set(Number(variant.id), {
            duration: variant.duration,
            resellerPrice: Number(variant.resellerPrice),
            memberPrice: Number(variant.memberPrice),
          });
        }
      }

      // DRIP mengirim harga dalam USD.
      // Kurs kerja mengikuti rumus katalog sebelumnya.
      const DRIP_USD_TO_IDR = 18000;

      const getApiMemberPrice = (_variant: any): number | null => null;

      const getApiResellerPrice = (_variant: any): number | null => null;

      const getApiModal = (variant: any): number | null => {
        const usd = getNumber(variant?.price);
        if (usd === null || usd <= 0) return null;
        return usd * DRIP_USD_TO_IDR;
      };

      const ceil1000 = (value: number): number =>
        Math.ceil(value / 1000) * 1000;

      const calculateNewPrices = (
  modal: number,
  duration: string,
): {
  resellerPrice: number;
  memberPrice: number;
} => {
  const match = duration.match(/(\d+)/);
  const days = match ? Number(match[1]) : null;
  const base = ceil1000(modal);

  if (days === null || days <= 1) {
    return {
      resellerPrice: Math.max(base + 3000, 5000),
      memberPrice: Math.max(base + 5000, 7000),
    };
  }

  if (days <= 3) {
    return {
      resellerPrice: base + 7000,
      memberPrice: base + 11000,
    };
  }

  if (days <= 7) {
    return {
      resellerPrice: base + 12000,
      memberPrice: base + 18000,
    };
  }

  if (days === 10) {
    return {
      resellerPrice: base + 14000,
      memberPrice: base + 20000,
    };
  }

  if (days === 14 || days === 15) {
    return {
      resellerPrice: base + 18000,
      memberPrice: base + 26000,
    };
  }

  if (days === 20) {
    return {
      resellerPrice: base + 20000,
      memberPrice: base + 29000,
    };
  }

  if (days === 28) {
    return {
      resellerPrice: base + 22000,
      memberPrice: base + 32000,
    };
  }

  if (days === 30 || days === 31) {
    return {
      resellerPrice: base + 25000,
      memberPrice: base + 35000,
    };
  }

  return {
    resellerPrice: base + 12000,
    memberPrice: base + 18000,
  };
};

// API DRIP mengembalikan SATU ROW untuk setiap varian.
      // Kelompokkan berdasarkan product_id agar 184 varian tidak
      // dianggap sebagai 184 produk.
      const productGroups = new Map<
        number,
        {
          name: string;
          variants: any[];
        }
      >();

      for (const item of dripProducts) {
        const productId = getNumber(item?.product_id);
        const name = getText(
          item?.product_name,
          item?.productName,
          item?.name,
        );

        if (productId === null || !name) continue;

        let group = productGroups.get(productId);

        if (!group) {
          group = {
            name,
            variants: [],
          };
          productGroups.set(productId, group);
        }

        group.variants.push(item);
      }

      const liveCatalog = Array.from(productGroups.values())
        .map((product) => {
          const variants = product.variants
            .map((variant: any) => {
              const id = getVariantId(variant);
              if (!id) return null;

              const old = catalogByVariant.get(id);

              const duration =
                getText(
                  variant?.variant_name,
                  variant?.duration,
                  variant?.period,
                  variant?.name,
                ) ?? "1 Days";

              const modal = getApiModal(variant);

              // Untuk varian lama, pertahankan harga katalog yang sudah
              // terbukti benar. Varian baru dihitung otomatis dari modal.
              let memberPrice: number | null = null;
              let resellerPrice: number | null = null;

              if (modal !== null) {
                const calculated = calculateNewPrices(
                  modal,
                  duration,
                );

                resellerPrice = calculated.resellerPrice;
                memberPrice = calculated.memberPrice;
              } else {
                resellerPrice = old?.resellerPrice ?? null;
                memberPrice = old?.memberPrice ?? null;
              }

              if (memberPrice === null || resellerPrice === null) {
                console.warn(
                  `Variant DRIP ${id} dilewati: harga tidak ditemukan.`,
                );
                return null;
              }

              const stock = getNumber(
                variant?.in_stock,
                variant?.local_stock,
                variant?.stock,
              );

              return {
                id,
                duration,
                memberPrice: Math.round(memberPrice),
                resellerPrice: Math.round(resellerPrice),
                stock:
                  stock !== null && stock >= 0
                    ? Math.floor(stock)
                    : 0,
              };
            })
            .filter(
              (
                value,
              ): value is {
                id: number;
                duration: string;
                memberPrice: number;
                resellerPrice: number;
                stock: number;
              } => Boolean(value),
            );

          return variants.length
            ? {
                name: product.name,
                variants,
              }
            : null;
        })
        .filter(
          (
            value,
          ): value is {
            name: string;
            variants: Array<{
              id: number;
              duration: string;
              memberPrice: number;
              resellerPrice: number;
              stock: number;
            }>;
          } => Boolean(value),
        );

      const imageByVariant = new Map<number, string>();

      for (const item of dripProducts) {
        const image = findImageUrl(item);

        if (!image) continue;

        for (const variant of getVariants(item)) {
          const id = getVariantId(variant);

          if (id) {
            imageByVariant.set(id, image);
          }
        }
      }

      const groups = [
        "DRIP",
        "HG",
        "FLURIOTE",
        "MIGUL",
        "PATO",
        "SILENT",
        "ROOT",
        "IOS",
        "ANDROID",
        "FF",
        "OTHER",
      ];

      const orderedCatalog = [...liveCatalog].sort(
        (a: any, b: any) => {
          const ga = groups.indexOf(
            getCatalogGroup(a.name),
          );

          const gb = groups.indexOf(
            getCatalogGroup(b.name),
          );

          return (
            ga - gb ||
            a.name.localeCompare(b.name)
          );
        },
      );

      let productsCreated = 0;
      let productsUpdated = 0;
      let variantsCreated = 0;
      let variantsUpdated = 0;
      let stockUpdated = 0;
      let imagesImported = 0;

      for (
        let index = 0;
        index < orderedCatalog.length;
        index++
      ) {
        const catalogProduct = orderedCatalog[index];

        const imageUrl =
          catalogProduct.variants
            .map((variant: any) =>
              imageByVariant.get(variant.id),
            )
            .find(Boolean) ?? null;

        const [existingProduct] = await db
          .select()
          .from(productsTable)
          .where(
            eq(
              productsTable.name,
              catalogProduct.name,
            ),
          );

        let productId: number;

        if (existingProduct) {
          productId = existingProduct.id;

          await db
            .update(productsTable)
            .set({
              sortOrder: index + 1,
              ...(imageUrl
                ? { imageUrl }
                : {}),
            })
            .where(
              eq(
                productsTable.id,
                productId,
              ),
            );

          productsUpdated++;
        } else {
          const [createdProduct] = await db
            .insert(productsTable)
            .values({
              name: catalogProduct.name,
              deliveryType: "WHATSAPP",
              imageUrl,
              sortOrder: index + 1,
            })
            .returning();

          productId = createdProduct.id;
          productsCreated++;
        }

        if (imageUrl) {
          imagesImported++;
        }

        for (const variant of catalogProduct.variants) {
          /*
           * dripVariantId adalah unique identity variant DRIP.
           * Tidak bergantung pada nama product.
           */
          const [existingOption] = await db
            .select()
            .from(productOptionsTable)
            .where(
              eq(
                productOptionsTable.dripVariantId,
                variant.id,
              ),
            );

          if (existingOption) {
            await db
              .update(productOptionsTable)
              .set({
                productId,
                duration: variant.duration,
                price: variant.memberPrice,
                resellerPrice:
                  variant.resellerPrice,
                dripStock: variant.stock,
              })
              .where(
                eq(
                  productOptionsTable.id,
                  existingOption.id,
                ),
              );

            variantsUpdated++;
          } else {
            await db
              .insert(productOptionsTable)
              .values({
                productId,
                duration: variant.duration,
                price: variant.memberPrice,
                resellerPrice:
                  variant.resellerPrice,
                dripVariantId: variant.id,
                dripStock: variant.stock,
                stock: 0,
              });

            variantsCreated++;
          }

          stockUpdated++;
        }
      }

      return res.json({
        ok: true,
        source: "DRIP_API",
        catalogProducts:
          orderedCatalog.length,
        catalogVariants:
          orderedCatalog.reduce(
            (total: number, product: any) =>
              total + product.variants.length,
            0,
          ),
        productsCreated,
        productsUpdated,
        variantsCreated,
        variantsUpdated,
        stockUpdated,
        imagesImported,
      });
    } catch (error) {
      console.error(
        "DRIP catalog import error:",
        error,
      );

      return res.status(500).json({
        error: "Gagal import DRIP catalog",
      });
    }
  },
);


export default router;
