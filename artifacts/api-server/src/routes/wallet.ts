import axios from "axios";
import { Router } from "express";
import { db } from "@workspace/db";
import { walletsTable, walletTransactionsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { createClerkClient } from "@clerk/backend";
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

    try {
      const token = process.env.WABLAS_API_KEY;
      const secret = process.env.WABLAS_SECRET_KEY;
      const owner = process.env.WABLAS_OWNER;

      if (token && secret && owner) {
        await axios.post(
          "https://kudus.wablas.com/api/send-message",
          new URLSearchParams({
            phone: owner,
            message:
              `🔔 DEPOSIT BARU\\n\\n` +
              `Nominal: Rp${amount.toLocaleString("id-ID")}\\n` +
              `Ref: ${reference}\\n` +
              `Status: PENDING\\n\\n` +
              `Silakan cek Admin Panel untuk menerima atau menolak deposit.`,
          }),
          {
            headers: {
              Authorization: `${token}.${secret}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
          }
        );
      }
    } catch (wablasErr) {
      console.error("WABLAS DEPOSIT NOTIFICATION ERROR:", wablasErr);
    }

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

router.patch("/admin/wallet/deposits/:id/reject", requireAdmin, async (req, res) => {
  try {
    await ensureWalletTables();
    const id = Number(req.params.id);
    const [transaction] = await db
      .select()
      .from(walletTransactionsTable)
      .where(and(eq(walletTransactionsTable.id, id), eq(walletTransactionsTable.type, "DEPOSIT")))
      .limit(1);

    if (!transaction) return res.status(404).json({ error: "Deposit tidak ditemukan" });
    if (transaction.status !== "PENDING") {
      return res.status(400).json({ error: "Deposit sudah diproses" });
    }

    const [updated] = await db
      .update(walletTransactionsTable)
      .set({ status: "REJECTED", updatedAt: new Date() })
      .where(eq(walletTransactionsTable.id, id))
      .returning();

    return res.json({ transaction: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Gagal menolak deposit" });
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

    console.log("DEBUG ACC BEFORE:", {
      transactionId: transaction.id,
      userId: transaction.userId,
      amount: transaction.amount,
      balanceBefore: wallet.balance,
    });

    const [updatedWallet] = await db
      .update(walletsTable)
      .set({
        balance: wallet.balance + transaction.amount,
        updatedAt: new Date(),
      })
      .where(eq(walletsTable.id, wallet.id))
      .returning();

    console.log("DEBUG ACC AFTER:", {
      walletId: updatedWallet.id,
      balanceAfter: updatedWallet.balance,
    });

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


router.get("/admin/wallet/users", requireAdmin, async (req, res) => {
  try {
    await ensureWalletTables();

    const secretKey = process.env.CLERK_SECRET_KEY;

    if (!secretKey) {
      return res.status(500).json({
        error: "CLERK_SECRET_KEY belum dikonfigurasi di server",
      });
    }

    const clerk = createClerkClient({ secretKey });

    const query =
      typeof req.query.query === "string"
        ? req.query.query.trim()
        : "";

    const limitRaw = Number(req.query.limit);
    const offsetRaw = Number(req.query.offset);

    const limit =
      Number.isInteger(limitRaw) && limitRaw > 0
        ? Math.min(limitRaw, 100)
        : 100;

    const offset =
      Number.isInteger(offsetRaw) && offsetRaw >= 0
        ? offsetRaw
        : 0;

    const result = await clerk.users.getUserList({
      limit,
      offset,
      ...(query ? { query } : {}),
    });

    const users = await Promise.all(
      result.data.map(async (user) => {
        const [wallet] = await db
          .select()
          .from(walletsTable)
          .where(eq(walletsTable.userId, user.id))
          .limit(1);

        const email =
          user.emailAddresses.find(
            (item) => item.id === user.primaryEmailAddressId
          )?.emailAddress ||
          user.emailAddresses[0]?.emailAddress ||
          "";

        return {
          id: user.id,
          username: user.username || "",
          email,
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          imageUrl: user.imageUrl || "",
          balance: wallet?.balance || 0,
        };
      })
    );

    return res.json({
      users,
      totalCount: result.totalCount,
      offset,
      limit,
    });
  } catch (err) {
    console.error("ADMIN GET USERS ERROR:", err);
    return res.status(500).json({
      error: "Gagal mengambil daftar member",
    });
  }
});

router.post("/admin/wallet/adjust", requireAdmin, async (req, res) => {
  try {
    await ensureWalletTables();

    const { userId, action, amount, reason } = req.body;

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "userId wajib diisi" });
    }

    if (action !== "add" && action !== "subtract") {
      return res.status(400).json({
        error: 'action harus "add" atau "subtract"',
      });
    }

    const numericAmount = Number(amount);

    if (!Number.isInteger(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        error: "Nominal harus berupa angka bulat lebih dari 0",
      });
    }

    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return res.status(400).json({
        error: "Alasan wajib diisi",
      });
    }

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

    const balanceBefore = wallet.balance;

    if (action === "subtract" && balanceBefore < numericAmount) {
      return res.status(400).json({
        error: "Saldo member tidak cukup untuk dikurangi",
        balance: balanceBefore,
      });
    }

    const newBalance =
      action === "add"
        ? balanceBefore + numericAmount
        : balanceBefore - numericAmount;

    const [updatedWallet] = await db
      .update(walletsTable)
      .set({
        balance: newBalance,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(walletsTable.id, wallet.id),
          action === "subtract"
            ? sql`${walletsTable.balance} >= ${numericAmount}`
            : sql`${walletsTable.balance} = ${balanceBefore}`
        )
      )
      .returning();

    if (!updatedWallet) {
      return res.status(409).json({
        error: "Saldo berubah bersamaan. Silakan coba lagi.",
      });
    }

    const reference =
      `ADM-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-` +
      Math.random().toString(36).slice(2, 8).toUpperCase();

    const [transaction] = await db
      .insert(walletTransactionsTable)
      .values({
        userId,
        type: "ADMIN_ADJUSTMENT",
        amount: action === "add" ? numericAmount : -numericAmount,
        reference,
        description: `Admin ${action === "add" ? "menambah" : "mengurangi"} saldo: ${reason.trim()}`,
        status: "PAID",
      })
      .returning();

    return res.json({
      success: true,
      wallet: updatedWallet,
      transaction,
      balanceBefore,
      balanceAfter: updatedWallet.balance,
    });
  } catch (err) {
    console.error("ADMIN WALLET ADJUST ERROR:", err);
    return res.status(500).json({
      error: "Gagal mengubah saldo member",
    });
  }
});

export default router;
