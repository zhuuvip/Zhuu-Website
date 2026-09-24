import { Router } from "express";
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
import { requireAdmin } from "../lib/auth.js";
import { generateDripKey } from "../lib/dripApi.js";

const router = Router();

function makeInvoice() {
  return (
    `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-` +
    Math.random().toString(36).slice(2, 7).toUpperCase()
  );
}

router.post("/orders", async (req, res) => {
  let pendingOrderId: number | null = null;
  let pendingInvoice: string | null = null;
  let pendingUserId: string | null = null;
  let pendingAmount: number | null = null;

  try {
    const userId = getAuth(req)?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Login diperlukan" });
    }

    const { productId, optionId, whatsapp } = req.body;

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
          user_id TEXT NOT NULL UNIQUE,
          balance INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await tx.execute(sql`
        CREATE TABLE IF NOT EXISTS wallet_transactions (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          type TEXT NOT NULL,
          amount INTEGER NOT NULL,
          reference TEXT UNIQUE,
          description TEXT,
          status TEXT NOT NULL DEFAULT 'PENDING',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      let [wallet] = await tx
        .select()
        .from(walletsTable)
        .where(eq(walletsTable.userId, userId))
        .limit(1);

      if (!wallet) {
        [wallet] = await tx
          .insert(walletsTable)
          .values({
            userId,
            balance: 0,
          })
          .returning();
      }

      if (wallet.balance < option.price) {
        throw new Error(
          `Saldo tidak cukup|${wallet.balance}|${option.price}`,
        );
      }

      const invoice = makeInvoice();

      const [updatedWallet] = await tx
        .update(walletsTable)
        .set({
          balance: sql`${walletsTable.balance} - ${option.price}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(walletsTable.id, wallet.id),
            sql`${walletsTable.balance} >= ${option.price}`,
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
          productId: product.id,
          optionId: option.id,
          productName: product.name,
          duration: option.duration,
          amount: option.price,
          whatsapp: whatsapp || null,
          status: isDrip ? "PENDING" : "PAID",
          paymentRef: null,
        })
        .returning();

      await tx.insert(walletTransactionsTable).values({
        userId,
        type: "PURCHASE",
        amount: -option.price,
        reference: invoice,
        description: `${product.name} - ${option.duration}`,
        status: isDrip ? "PENDING" : "PAID",
      });

      return {
        order,
        product,
        option,
        balance: updatedWallet.balance,
        isDrip,
      };
    });

    pendingOrderId = prepared.order.id;
    pendingInvoice = prepared.order.invoice;
    pendingUserId = userId;
    pendingAmount = prepared.option.price;

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
              balance: sql`${walletsTable.balance} + ${prepared.option.price}`,
              updatedAt: new Date(),
            })
            .where(eq(walletsTable.userId, userId));

          await tx
            .update(walletTransactionsTable)
            .set({
              status: "REFUNDED",
            })
            .where(eq(walletTransactionsTable.reference, prepared.order.invoice));

          await tx
            .update(ordersTable)
            .set({
              status: "CANCELLED",
            })
            .where(eq(ordersTable.id, prepared.order.id));
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

    return res.json({
      ...order,
      deliveryKey,
      deliveryLink,
      balance: prepared.balance,
      drip: false,
    });
  } catch (err) {
    console.error("Order error:", err);

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
              .where(eq(walletsTable.userId, refundUserId));

            await tx
              .update(walletTransactionsTable)
              .set({
                status: "REFUNDED",
              })
              .where(eq(walletTransactionsTable.reference, refundInvoice));

            await tx
              .update(ordersTable)
              .set({
                status: "CANCELLED",
              })
              .where(eq(ordersTable.id, refundOrderId));
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
