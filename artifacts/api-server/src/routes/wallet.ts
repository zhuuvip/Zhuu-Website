import { Router } from "express";
import { db } from "@workspace/db";
import { walletsTable, walletTransactionsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { requireAdmin } from "../lib/auth.js";

const router = Router();

async function getUserId(req: any, res: any) {
  const userId = getAuth(req)?.userId;
  if (!userId) {
    res.status(401).json({ error: "Login diperlukan" });
    return null;
  }
  return userId;
}

async function ensureWalletTables() {
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
}

router.get("/wallet", async (req, res) => {
  try {
    const userId = await getUserId(req, res);
    if (!userId) return;

    await ensureWalletTables();

    let [wallet] = await db
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.userId, userId))
      .limit(1);

    if (!wallet) {
      [wallet] = await db
        .insert(walletsTable)
        .values({ userId, balance: 0 })
        .returning();
    }

    return res.json(wallet);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Gagal mengambil saldo" });
  }
});

router.get("/wallet/transactions", async (req, res) => {
  try {
    const userId = await getUserId(req, res);
    if (!userId) return;

    await ensureWalletTables();

    const transactions = await db
      .select()
      .from(walletTransactionsTable)
      .where(eq(walletTransactionsTable.userId, userId))
      .orderBy(desc(walletTransactionsTable.createdAt));

    return res.json(transactions);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Gagal mengambil transaksi" });
  }
});

router.post("/wallet/deposit", async (req, res) => {
  try {
    const userId = await getUserId(req, res);
    if (!userId) return;

    await ensureWalletTables();

    const amount = Number(req.body.amount);

    if (!Number.isInteger(amount) || amount < 1000) {
      return res.status(400).json({
        error: "Minimal deposit Rp1.000",
      });
    }

    const reference =
      `DEP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-` +
      Math.random().toString(36).slice(2, 8).toUpperCase();

    const [transaction] = await db
      .insert(walletTransactionsTable)
      .values({
        userId,
        type: "DEPOSIT",
        amount,
        reference,
        description: "Deposit QRIS DANA",
        status: "PENDING",
      })
      .returning();

    return res.json({
      transaction,
      qrisProvider: "DANA",
      status: "PENDING",
      qrUrl: "https://zhuusite.my.id/attached_assets/qr_ID1026531275638_12.09.26_1789202677_1789202677296.jpeg",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Gagal membuat deposit" });
  }
});

router.get("/admin/wallet/deposits", requireAdmin, async (_req, res) => {
  try {
    await ensureWalletTables();

    const deposits = await db
      .select()
      .from(walletTransactionsTable)
      .where(eq(walletTransactionsTable.type, "DEPOSIT"))
      .orderBy(desc(walletTransactionsTable.createdAt));

    return res.json(deposits);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Gagal mengambil deposit" });
  }
});

router.patch("/admin/wallet/deposits/:id/confirm", requireAdmin, async (req, res) => {
  try {
    await ensureWalletTables();

    const id = Number(req.params.id);

    const [transaction] = await db
      .select()
      .from(walletTransactionsTable)
      .where(
        and(
          eq(walletTransactionsTable.id, id),
          eq(walletTransactionsTable.type, "DEPOSIT")
        )
      );

    if (!transaction) {
      return res.status(404).json({ error: "Deposit tidak ditemukan" });
    }

    if (transaction.status !== "PENDING") {
      return res.status(400).json({ error: "Deposit sudah diproses" });
    }

    let [wallet] = await db
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.userId, transaction.userId))
      .limit(1);

    if (!wallet) {
      [wallet] = await db
        .insert(walletsTable)
        .values({
          userId: transaction.userId,
          balance: 0,
        })
        .returning();
    }

    const [updatedWallet] = await db
      .update(walletsTable)
      .set({
        balance: wallet.balance + transaction.amount,
        updatedAt: new Date(),
      })
      .where(eq(walletsTable.id, wallet.id))
      .returning();

    const [updatedTransaction] = await db
      .update(walletTransactionsTable)
      .set({
        status: "PAID",
      })
      .where(eq(walletTransactionsTable.id, transaction.id))
      .returning();

    return res.json({
      wallet: updatedWallet,
      transaction: updatedTransaction,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Gagal mengonfirmasi deposit" });
  }
});

export default router;
