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
import { requireAdmin } from "../lib/auth";

const router = Router();

router.post("/orders", async (req, res) => {
  try {
    const userId = getAuth(req)?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Login diperlukan" });
    }

    const { productId, optionId, whatsapp } = req.body;

    const [product] = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, Number(productId)));

    const [option] = await db
      .select()
      .from(productOptionsTable)
      .where(eq(productOptionsTable.id, Number(optionId)));

    if (!product || !option || option.productId !== product.id) {
      return res.status(400).json({
        error: "Produk atau durasi tidak valid",
      });
    }

    if (option.stock <= 0) {
      return res.status(400).json({
        error: "Stok habis",
      });
    }

    let deliveryKey: string | null = null;
    let keyRow: any = null;

    if (product.deliveryType === "KEY") {
      [keyRow] = await db
        .select()
        .from(productKeysTable)
        .where(
          and(
            eq(productKeysTable.productId, product.id),
            eq(productKeysTable.optionId, option.id),
            eq(productKeysTable.status, "READY"),
          ),
        )
        .limit(1);

      if (!keyRow) {
        return res.status(400).json({
          error: "Key untuk durasi ini habis",
        });
      }

      deliveryKey = keyRow.key;
    }

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS wallets (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        balance INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await db.execute(sql`
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

    let [wallet] = await db
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.userId, userId))
      .limit(1);

    if (!wallet) {
      [wallet] = await db
        .insert(walletsTable)
        .values({
          userId,
          balance: 0,
        })
        .returning();
    }

    if (wallet.balance < option.price) {
      return res.status(400).json({
        error: "Saldo tidak cukup",
        balance: wallet.balance,
        required: option.price,
      });
    }

    const invoice =
      `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-` +
      Math.random().toString(36).slice(2, 7).toUpperCase();

    const newBalance = wallet.balance - option.price;

    const [updatedWallet] = await db
      .update(walletsTable)
      .set({
        balance: newBalance,
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
      return res.status(400).json({
        error: "Saldo tidak cukup atau saldo berubah, silakan coba lagi",
      });
    }

    if (product.deliveryType === "KEY" && keyRow) {
      await db
        .update(productKeysTable)
        .set({ status: "SOLD" })
        .where(eq(productKeysTable.id, keyRow.id));
    }

    await db
      .update(productOptionsTable)
      .set({
        stock: Math.max(0, option.stock - 1),
      })
      .where(
        and(
          eq(productOptionsTable.id, option.id),
          sql`${productOptionsTable.stock} > 0`,
        ),
      );

    const [order] = await db
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
        paymentRef: deliveryKey,
      })
      .returning();

    await db.insert(walletTransactionsTable).values({
      userId,
      type: "PURCHASE",
      amount: -option.price,
      reference: invoice,
      description: `${product.name} - ${option.duration}`,
      status: "PAID",
    });

    return res.json({
      ...order,
      deliveryKey,
      balance: updatedWallet.balance,
    });
  } catch (err) {
    console.error(err);
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
