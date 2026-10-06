import { Router } from "express";
import { createNotification } from "./notifications.js";
import { db } from "@workspace/db";
import {
  ordersTable,
  productsTable,
  productOptionsTable,
  productKeysTable,
  walletsTable,
  walletTransactionsTable,
} from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { createClerkClient } from "@clerk/backend";
import { requireAdmin } from "../lib/auth.js";
import { generateDripKey } from "../lib/dripApi.js";
import {
  applyPromo,
  recordPromoUsage,
  rollbackPromoUsage,
} from "../lib/promo.js";

const router = Router();

let ordersSchemaReady: Promise<void> | null = null;

function ensureOrdersIdempotencySchema(): Promise<void> {
  if (!ordersSchemaReady) {
    ordersSchemaReady = (async () => {
      await db.execute(sql`
        ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS idempotency_key TEXT
      `);

      await db.execute(sql`
        ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'site'
      `);

      await db.execute(sql`
        UPDATE orders
        SET scope = 'site'
        WHERE scope IS NULL OR scope = ''
      `);

      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_key_unique
        ON orders (idempotency_key)
        WHERE idempotency_key IS NOT NULL
      `);
    })().catch((e) => {
      ordersSchemaReady = null;
      throw e;
    });
  }

  return ordersSchemaReady;
}

function makeInvoice() {
  return (
    `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-` +
    Math.random().toString(36).slice(2, 7).toUpperCase()
  );
}

router.post("/orders/validate-promo", async (req, res) => {
  try {
    const userId = getAuth(req)?.userId;

    if (!userId) {
      return res.status(401).json({
        error: "Login diperlukan",
      });
    }

    const { code, productId, optionId } = req.body;

    if (!code || !productId || !optionId) {
      return res.status(400).json({
        error: "Kode promo dan produk wajib diisi",
      });
    }

    const result = await db.transaction(async (tx) => {
      const [product] = await tx
        .select()
        .from(productsTable)
        .where(eq(productsTable.id, Number(productId)));

      const [option] = await tx
        .select()
        .from(productOptionsTable)
        .where(eq(productOptionsTable.id, Number(optionId)));

      if (!product || !option || option.productId !== product.id) {
        throw new Error("Produk atau durasi tidak valid");
      }

      const promo = await applyPromo(tx, {
        code,
        audience: "MEMBER",
        userId,
        basePrice: option.price,
      });

      return {
        ...promo,
        originalPrice: option.price,
      };
    });

    return res.json({
      code: result.promo?.code ?? null,
      originalPrice: result.originalPrice,
      discount: result.discount,
      finalPrice: result.finalPrice,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal memeriksa kode promo";

    if (
      message === "Kode promo tidak valid atau tidak tersedia" ||
      message === "Kode promo sudah expired" ||
      message === "Kuota kode promo sudah habis" ||
      message === "Kamu sudah pernah menggunakan kode promo ini" ||
      message === "Produk atau durasi tidak valid"
    ) {
      return res.status(400).json({ error: message });
    }

    console.error("Promo validation error:", err);

    return res.status(500).json({
      error: "Gagal memeriksa kode promo",
    });
  }
});

router.post(["/orders", "/shop/orders"], async (req, res) => {
  const walletScope = req.path === "/shop/orders" ? "shop" : "site";
  let pendingOrderId: number | null = null;
  let pendingInvoice: string | null = null;
  let pendingUserId: string | null = null;
  let pendingAmount: number | null = null;
  let pendingPromoId: number | null = null;
  let pendingIsDrip = false;
  let pendingOptionId: number | null = null;

  try {
    const userId = getAuth(req)?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Login diperlukan" });
    }

    await ensureOrdersIdempotencySchema();

    const idempotencyKey =
      typeof req.body.idempotencyKey === "string"
        ? req.body.idempotencyKey.trim()
        : "";

    if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
      return res.status(400).json({
        error: "Request pembelian tidak valid. Silakan coba lagi.",
      });
    }

    const { productId, optionId, whatsapp, promoCode } = req.body;

    /*
     * IDEMPOTENCY
     * Request dengan key yang sama tidak boleh membuat order/debit kedua.
     */
    const [existingOrder] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.idempotencyKey, idempotencyKey))
      .limit(1);

    if (existingOrder) {
      return res.json({
        ...existingOrder,
        balance: undefined,
        deliveryKey: undefined,
        deliveryLink: undefined,
        duplicate: true,
      });
    }

    /*
     * STEP 1
     * Ambil produk + option dan lakukan debit wallet.
     *
     * Untuk DRIP, jangan panggil supplier di dalam transaction DB.
     */
    const prepared = await db.transaction(async (tx) => {
      const [product] = await tx
        .select()
        .from(productsTable)
        .where(eq(productsTable.id, Number(productId)));

      const [option] = await tx
        .select()
        .from(productOptionsTable)
        .where(eq(productOptionsTable.id, Number(optionId)));

      if (!product || !option || option.productId !== product.id) {
        throw new Error("Produk atau durasi tidak valid");
      }

      const isDrip = Boolean(option.dripVariantId);

      /*
       * DRIP menggunakan stock supplier.
       * Produk biasa tetap menggunakan stock lokal.
       */
      if (!isDrip && option.stock <= 0) {
        throw new Error("Stok habis");
      }

      if (isDrip && Number(option.dripStock ?? 0) <= 0) {
        throw new Error("Stok DRIP habis");
      }

      await tx.execute(sql`
        CREATE TABLE IF NOT EXISTS wallets (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          scope TEXT NOT NULL DEFAULT 'site',
          balance INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await tx.execute(sql`
        ALTER TABLE wallets
        ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'site'
      `);

      await tx.execute(sql`
        CREATE TABLE IF NOT EXISTS wallet_transactions (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          scope TEXT NOT NULL DEFAULT 'site',
          type TEXT NOT NULL,
          amount INTEGER NOT NULL,
          reference TEXT UNIQUE,
          description TEXT,
          status TEXT NOT NULL DEFAULT 'PENDING',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await tx.execute(sql`
        ALTER TABLE wallet_transactions
        ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'site'
      `);

      let [wallet] = await tx
        .select()
        .from(walletsTable)
        .where(
          and(
            eq(walletsTable.userId, userId),
            eq(walletsTable.scope, walletScope),
          ),
        )
        .limit(1);

      if (!wallet) {
        [wallet] = await tx
          .insert(walletsTable)
          .values({
            userId,
            scope: walletScope,
                                                                     balance: 0,
          })
          .returning();
      }

      const promoResult = await applyPromo(tx, {
        code: promoCode,
        audience: "MEMBER",
        userId,
        basePrice: option.price,
      });

      const finalPrice = promoResult.finalPrice;

      if (wallet.balance < finalPrice) {
        throw new Error(
          `Saldo tidak cukup|${wallet.balance}|${finalPrice}`,
        );
      }

      const invoice = makeInvoice();

      const [updatedWallet] = await tx
        .update(walletsTable)
        .set({
          balance: sql`${walletsTable.balance} - ${finalPrice}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(walletsTable.id, wallet.id),
            sql`${walletsTable.balance} >= ${finalPrice}`,
          ),
        )
        .returning();

      if (!updatedWallet) {
        throw new Error(
          "Saldo tidak cukup atau saldo berubah, silakan coba lagi",
        );
      }

      /*
       * Untuk produk lokal, stock langsung dikurangi.
       * DRIP tidak mengurangi stock lokal.
       */
      if (!isDrip) {
        const [updatedOption] = await tx
          .update(productOptionsTable)
          .set({
            stock: sql`${productOptionsTable.stock} - 1`,
          })
          .where(
            and(
              eq(productOptionsTable.id, option.id),
              sql`${productOptionsTable.stock} > 0`,
            ),
          )
          .returning();

        if (!updatedOption) {
          throw new Error(
            "Stok habis atau stok berubah, silakan coba lagi",
          );
        }
      }

      const [order] = await tx
        .insert(ordersTable)
        .values({
          invoice,
          idempotencyKey,
          scope: walletScope,
          productId: product.id,
          optionId: option.id,
          productName: product.name,
          duration: option.duration,
          amount: finalPrice,
          whatsapp: whatsapp || null,
          status: "PENDING",
          paymentRef: null,
        })
        .returning();

      await tx.insert(walletTransactionsTable).values({
        userId,
        scope: walletScope,
        type: "PURCHASE",
        amount: -finalPrice,
        reference: invoice,
        description: `${product.name} - ${option.duration}`,
        status: "PENDING",
      });

      if (promoResult.promo) {
        await recordPromoUsage(tx, {
          promoId: promoResult.promo.id,
          userId,
          audience: "MEMBER",
          orderId: order.id,
          discount: promoResult.discount,
        });
      }

      return {
        order,
        product,
        option,
        balance: updatedWallet.balance,
        isDrip,
        promo: promoResult.promo
          ? {
              id: promoResult.promo.id,
              code: promoResult.promo.code,
              discount: promoResult.discount,
              originalPrice: option.price,
              finalPrice,
            }
          : null,
      };
    });

    pendingOrderId = prepared.order.id;
    pendingInvoice = prepared.order.invoice;
    pendingUserId = userId;
    pendingAmount = prepared.order.amount;
    pendingPromoId = prepared.promo?.id ?? null;
    pendingIsDrip = prepared.isDrip;
    pendingOptionId = prepared.option.id;

    /*
     * ============================================================
     * DRIP PURCHASE
     * ============================================================
     */
    if (prepared.isDrip) {
      let dripResult: any;

      try {
        dripResult = await generateDripKey(
          Number(prepared.option.dripVariantId),
          1,
        );
      } catch (error) {
        console.error("DRIP generate request failed:", error);

        throw new Error("Gagal menghubungi server DRIP");
      }

      console.log("DRIP generate response:", {
        success: dripResult?.success,
        orderId: dripResult?.order_id,
        productName: dripResult?.product_name,
        variantName: dripResult?.variant_name,
        generated: dripResult?.generated,
        amountCharged: dripResult?.amount_charged,
      });

      if (
        !dripResult ||
        dripResult.success !== true ||
        !Array.isArray(dripResult.keys) ||
        dripResult.keys.length < 1
      ) {
        throw new Error(
          dripResult?.error || "DRIP gagal membuat key",
        );
      }

      /*
       * Response supplier saat test:
       * keys: ["Key: 8603939347"]
       *
       * Simpan string tersebut sebagai delivery key.
       */
      const deliveryKey = String(dripResult.keys[0]);

      /*
       * STEP 2
       * Generate sukses -> order PAID + transaction PAID.
       */
      const completed = await db.transaction(async (tx) => {
        const [order] = await tx
          .update(ordersTable)
          .set({
            status: "PAID",
            paymentRef: deliveryKey,
          })
          .where(eq(ordersTable.id, prepared.order.id))
          .returning();

        await tx
          .update(walletTransactionsTable)
          .set({
            status: "PAID",
          })
          .where(
            eq(walletTransactionsTable.reference, prepared.order.invoice),
          );

        return order;
      });

      return res.json({
        ...completed,
        deliveryKey,
        deliveryLink: null,
        balance: prepared.balance,
        drip: true,
        dripOrderId: dripResult.order_id ?? null,
      });
    }

    /*
     * ============================================================
     * PRODUK LOKAL
     * ============================================================
     */

    let deliveryKey: string | null = null;
    let deliveryLink: string | null = null;

    if (prepared.product.deliveryType === "KEY") {
      const claimed = await db.execute(sql`
        UPDATE product_keys
        SET status = 'SOLD'
        WHERE id = (
          SELECT id
          FROM product_keys
          WHERE product_id = ${prepared.product.id}
            AND option_id = ${prepared.option.id}
            AND status = 'READY'
          ORDER BY id ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id, key
      `);

      const rows = (claimed as any).rows ?? claimed;

      if (!rows || rows.length === 0) {
        /*
         * Refund karena key lokal ternyata tidak tersedia.
         */
        await db.transaction(async (tx) => {
          await tx
            .update(walletsTable)
            .set({
              balance: sql`${walletsTable.balance} + ${prepared.order.amount}`,
              updatedAt: new Date(),
            })
            .where(
        and(
          eq(walletsTable.userId, userId),
          eq(walletsTable.scope, walletScope),
        ),
      );

          await tx
            .update(walletTransactionsTable)
            .set({
              status: "REFUNDED",
            })
            .where(
        and(
          eq(walletTransactionsTable.reference, prepared.order.invoice),
          eq(walletTransactionsTable.scope, walletScope),
        ),
      );

          await tx
            .update(productOptionsTable)
            .set({
              stock: sql`${productOptionsTable.stock} + 1`,
            })
          .where(eq(productOptionsTable.id, prepared.option.id));

          await tx
            .update(ordersTable)
            .set({
              status: "CANCELLED",
            })
            .where(eq(ordersTable.id, prepared.order.id));

        if (pendingPromoId !== null) {
          await rollbackPromoUsage(tx, {
            promoId: pendingPromoId,
            userId,
            orderId: prepared.order.id,
          });
        }
        });

        throw new Error("Key untuk durasi ini habis");
      }

      deliveryKey = rows[0].key;
    }

    if (prepared.product.deliveryType === "LINK") {
      deliveryLink = prepared.product.deliveryValue || null;

      if (!deliveryLink) {
        throw new Error("Link delivery belum diatur oleh admin");
      }
    }

    const paymentRef = deliveryKey || deliveryLink || null;

    const [order] = await db
      .update(ordersTable)
      .set({
        status: "PAID",
        paymentRef,
      })
      .where(eq(ordersTable.id, prepared.order.id))
      .returning();

    await createNotification({
      userId,
      type: "orders",
      title: "Order berhasil 🎉",
      message: `${order.productName} berhasil diproses.`,
      link: "/orders",
    }).catch((error) => {
      console.error("Order notification failed:", error);
    });

    return res.json({
      ...order,
      deliveryKey,
      deliveryLink,
      balance: prepared.balance,
      drip: false,
    });
  } catch (err) {
    console.error("Order error:", err);

    if (
      (err as any)?.code === "23505" &&
      (
        (err as any)?.constraint === "orders_idempotency_key_unique" ||
        String((err as any)?.detail || "").includes("idempotency_key")
      )
    ) {
      const duplicateKey =
        typeof req.body?.idempotencyKey === "string"
          ? req.body.idempotencyKey.trim()
          : "";

      if (duplicateKey) {
        const [existingOrder] = await db
          .select()
          .from(ordersTable)
          .where(eq(ordersTable.idempotencyKey, duplicateKey))
          .limit(1);

        if (existingOrder) {
          return res.json({
            ...existingOrder,
            balance: undefined,
            deliveryKey: undefined,
            deliveryLink: undefined,
            duplicate: true,
          });
        }
      }
    }

    /*
     * DRIP gagal setelah wallet sudah didebit.
     * Refund otomatis.
     */
    if (
      pendingOrderId !== null &&
      pendingInvoice !== null &&
      pendingUserId !== null &&
      pendingAmount !== null
    ) {
      try {
        const [order] = await db
          .select()
          .from(ordersTable)
          .where(eq(ordersTable.id, pendingOrderId));

        /*
         * Hanya refund order yang masih PENDING.
         * Ini mencegah double refund.
         */
        if (order?.status === "PENDING") {
          const refundUserId = pendingUserId;
          const refundInvoice = pendingInvoice;
          const refundOrderId = pendingOrderId;
          const refundAmount = pendingAmount;

          await db.transaction(async (tx) => {
            await tx
              .update(walletsTable)
              .set({
                balance: sql`${walletsTable.balance} + ${refundAmount}`,
                updatedAt: new Date(),
              })
              .where(
          and(
            eq(walletsTable.userId, refundUserId),
            eq(walletsTable.scope, walletScope),
          ),
        );

            await tx
              .update(walletTransactionsTable)
              .set({
                status: "REFUNDED",
              })
              .where(
          and(
            eq(walletTransactionsTable.reference, refundInvoice),
            eq(walletTransactionsTable.scope, walletScope),
          ),
        );

            if (!pendingIsDrip && pendingOptionId !== null) {
              await tx
                .update(productOptionsTable)
                .set({
                  stock: sql`${productOptionsTable.stock} + 1`,
                })
                .where(eq(productOptionsTable.id, pendingOptionId));
            }

            await tx
              .update(ordersTable)
              .set({
                status: "CANCELLED",
              })
              .where(eq(ordersTable.id, refundOrderId));

          if (pendingPromoId !== null) {
            await rollbackPromoUsage(tx, {
              promoId: pendingPromoId,
              userId: refundUserId,
              orderId: refundOrderId,
            });
          }
          });

          console.log(
            `Order ${pendingInvoice} refunded after failed delivery`,
          );
        }
      } catch (refundError) {
        /*
         * Sangat penting: jangan menelan error refund.
         * Jika sampai sini, perlu dicek manual di database.
         */
        console.error("CRITICAL: refund failed:", refundError);
      }
    }

    const message = err instanceof Error ? err.message : "";

    if (message.startsWith("Saldo tidak cukup|")) {
      const [, balance, required] = message.split("|");

      return res.status(400).json({
        error: "Saldo tidak cukup",
        balance: Number(balance),
        required: Number(required),
      });
    }

    if (
      message === "Produk atau durasi tidak valid" ||
      message === "Stok habis" ||
      message === "Stok DRIP habis" ||
      message === "Key untuk durasi ini habis" ||
      message === "Link delivery belum diatur oleh admin" ||
      message ===
        "Saldo tidak cukup atau saldo berubah, silakan coba lagi" ||
      message === "Kode promo tidak valid atau tidak tersedia" ||
      message === "Kode promo sudah expired" ||
      message === "Kuota kode promo sudah habis" ||
      message === "Kamu sudah pernah menggunakan kode promo ini" ||
      message === "Stok habis atau stok berubah, silakan coba lagi"
    ) {
      return res.status(400).json({
        error: message,
      });
    }

    return res.status(500).json({
      error: message || "Gagal melakukan pembelian",
    });
  }
});


/**
 * Public recent purchase ticker.
 *
 * Hanya mengirim data yang aman untuk ditampilkan publik:
 * - username yang sudah dimasking
 * - nama produk
 * - harga
 * - logo produk
 * - waktu pembelian
 *
 * Tidak mengirim userId, invoice, WhatsApp, paymentRef, atau delivery data.
 */
router.get("/orders/recent", async (_req, res) => {
  try {
    const rows = await db
      .select({
        userId: walletTransactionsTable.userId,
        productId: ordersTable.productId,
        productName: ordersTable.productName,
        amount: ordersTable.amount,
        createdAt: ordersTable.createdAt,
        imageUrl: productsTable.imageUrl,
      })
      .from(walletTransactionsTable)
      .innerJoin(
        ordersTable,
        eq(walletTransactionsTable.reference, ordersTable.invoice),
      )
      .leftJoin(
        productsTable,
        eq(productsTable.id, ordersTable.productId),
      )
      .where(
        and(
          eq(walletTransactionsTable.type, "PURCHASE"),
          eq(walletTransactionsTable.scope, "site"),
              eq(ordersTable.scope, "site"),
              eq(ordersTable.status, "PAID"),
        ),
      )
      .orderBy(desc(ordersTable.createdAt))
      .limit(12);

    if (!rows.length) {
      return res.json([]);
    }

    const secretKey = process.env.CLERK_SECRET_KEY;

    if (!secretKey) {
      return res.status(500).json({
        error: "CLERK_SECRET_KEY belum dikonfigurasi di server",
      });
    }

    const clerk = createClerkClient({ secretKey });

    const uniqueUserIds = [...new Set(rows.map((row) => row.userId))];

    const userEntries = await Promise.all(
      uniqueUserIds.map(async (userId) => {
        try {
          const user = await clerk.users.getUser(userId);

          const rawName =
            typeof user.username === "string" && user.username.trim()
              ? user.username.trim()
              : typeof user.firstName === "string" && user.firstName.trim()
                ? user.firstName.trim()
                : "Member";

          return [userId, rawName] as const;
        } catch {
          return [userId, "Member"] as const;
        }
      }),
    );

    const usernames = new Map(userEntries);

    const maskName = (name: string) => {
      const clean = name.trim();

      if (!clean || clean.toLowerCase() === "member") {
        return "Member";
      }

      if (clean.length <= 2) {
        return `${clean[0]}***`;
      }

      return `${clean.slice(0, 2)}***${clean.slice(-1)}`;
    };

    return res.json(
      rows.map((row) => ({
        productId: row.productId,
        productName: row.productName,
        amount: row.amount,
        createdAt: row.createdAt,
        imageUrl: row.imageUrl || "",
        username: maskName(usernames.get(row.userId) || "Member"),
      })),
    );
  } catch (err) {
    console.error("Recent purchase ticker error:", err);

    return res.status(500).json({
      error: "Gagal mengambil pembelian terbaru",
    });
  }
});

router.get("/orders", async (req, res) => {
  try {
    const userId = getAuth(req)?.userId;

    if (!userId) {
      return res.status(401).json({
        error: "Login diperlukan",
      });
    }

    const transactions = await db
      .select({
        id: walletTransactionsTable.id,
        amount: walletTransactionsTable.amount,
        status: walletTransactionsTable.status,
        createdAt: walletTransactionsTable.createdAt,
        invoice: ordersTable.invoice,
        productName: ordersTable.productName,
        duration: ordersTable.duration,
        paymentRef: ordersTable.paymentRef,
        orderStatus: ordersTable.status,
      })
      .from(walletTransactionsTable)
      .innerJoin(
        ordersTable,
        eq(walletTransactionsTable.reference, ordersTable.invoice),
      )
      .where(
        and(
          eq(walletTransactionsTable.userId, userId),
          eq(walletTransactionsTable.scope, "site"),
              eq(ordersTable.scope, "site"),
              eq(walletTransactionsTable.type, "PURCHASE"),
        ),
      )
      .orderBy(desc(walletTransactionsTable.createdAt));

    return res.json(transactions);
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: "Gagal mengambil riwayat transaksi",
    });
  }
});

router.get("/admin/orders", requireAdmin, async (_req, res) => {
  try {
    const orders = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.scope, "site"))
      .orderBy(sql`${ordersTable.createdAt} DESC`);

    return res.json(orders);
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: "Gagal mengambil orders",
    });
  }
});

export default router;
