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

const router = Router();

router.post("/orders", async (req, res) => {
  try {
    const userId = getAuth(req)?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Login diperlukan" });
    }

    const { productId, optionId, whatsapp } = req.body;

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

      if (option.stock <= 0) {
        throw new Error("Stok habis");
      }

      let deliveryKey: string | null = null;
      let deliveryLink: string | null = null;

      /*
       * KEY:
       * Claim satu key READY secara atomic.
       * FOR UPDATE SKIP LOCKED mencegah dua pembeli mengambil key yang sama.
       */
      if (product.deliveryType === "KEY") {
        const claimed = await tx.execute(sql`
          UPDATE product_keys
          SET status = 'SOLD'
          WHERE id = (
            SELECT id
            FROM product_keys
            WHERE product_id = ${product.id}
              AND option_id = ${option.id}
              AND status = 'READY'
            ORDER BY id ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
          )
          RETURNING id, key
        `);

        const rows = (claimed as any).rows ?? claimed;

        if (!rows || rows.length === 0) {
          throw new Error("Key untuk durasi ini habis");
        }

        deliveryKey = rows[0].key;
      }

      /*
       * LINK:
       * Ambil link yang sudah diatur Admin Panel.
       * Tidak membuat setting/table baru.
       */
      if (product.deliveryType === "LINK") {
        deliveryLink = product.deliveryValue || null;

        if (!deliveryLink) {
          throw new Error("Link delivery belum diatur oleh admin");
        }
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
        throw new Error(`Saldo tidak cukup|${wallet.balance}|${option.price}`);
      }

      const invoice =
        `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-` +
        Math.random().toString(36).slice(2, 7).toUpperCase();

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
        throw new Error("Stok habis atau stok berubah, silakan coba lagi");
      }

      const paymentRef = deliveryKey || deliveryLink || null;

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
          status: "PAID",
          paymentRef,
        })
        .returning();

      await tx.insert(walletTransactionsTable).values({
        userId,
        type: "PURCHASE",
        amount: -option.price,
        reference: invoice,
        description: `${product.name} - ${option.duration}`,
        status: "PAID",
      });

      return {
        order,
        deliveryKey,
        deliveryLink,
        balance: updatedWallet.balance,
      };
    });

    return res.json({
      ...result.order,
      deliveryKey: result.deliveryKey,
      deliveryLink: result.deliveryLink,
      balance: result.balance,
    });
  } catch (err) {
    console.error(err);

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
      message === "Key untuk durasi ini habis" ||
      message === "Link delivery belum diatur oleh admin" ||
      message === "Saldo tidak cukup atau saldo berubah, silakan coba lagi" ||
      message === "Stok habis atau stok berubah, silakan coba lagi"
    ) {
      return res.status(400).json({ error: message });
    }

    return res.status(500).json({
      error: "Gagal melakukan pembelian",
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
      .select()
      .from(walletTransactionsTable)
      .where(eq(walletTransactionsTable.userId, userId))
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
