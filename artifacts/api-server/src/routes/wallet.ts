import { Router } from "express";
import { createNotification } from "./notifications.js";
import { db } from "@workspace/db";
import { walletsTable, walletTransactionsTable } from "@workspace/db";
import { eq, and, desc, sql, like } from "drizzle-orm";
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
      user_id TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT 'site',
      balance INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    ALTER TABLE wallets
    ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'site'
  `);

  await db.execute(sql`
    UPDATE wallets
    SET scope = 'site'
    WHERE scope IS NULL OR scope = ''
  `);

  await db.execute(sql`
    DO $$
    DECLARE
      constraint_name TEXT;
    BEGIN
      SELECT conname
      INTO constraint_name
      FROM pg_constraint
      WHERE conrelid = 'wallets'::regclass
        AND contype = 'u'
        AND pg_get_constraintdef(oid) LIKE '%(user_id)%'
      LIMIT 1;

      IF constraint_name IS NOT NULL THEN
        EXECUTE format(
          'ALTER TABLE wallets DROP CONSTRAINT %I',
          constraint_name
        );
      END IF;
    END $$;
  `);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS wallets_user_scope_unique
    ON wallets (user_id, scope)
  `);

  await db.execute(sql`
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

  await db.execute(sql`
    ALTER TABLE wallet_transactions
    ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'site'
  `);

  await db.execute(sql`
    UPDATE wallet_transactions
    SET scope = 'site'
    WHERE scope IS NULL OR scope = ''
  `);
}


async function getOrCreateScopedWallet(userId: string, scope: "site" | "shop") {
  await ensureWalletTables();

  let [wallet] = await db
    .select()
    .from(walletsTable)
    .where(
      and(
        eq(walletsTable.userId, userId),
        eq(walletsTable.scope, scope),
      ),
    )
    .limit(1);

  if (!wallet) {
    [wallet] = await db
      .insert(walletsTable)
      .values({
        userId,
        scope,
        balance: 0,
      })
      .returning();
  }

  return wallet;
}


router.get("/shop/wallet", async (req, res) => {
  try {
    const userId = getUserId(req, res);
    if (!userId) return;

    const wallet = await getOrCreateScopedWallet(userId, "shop");

    res.json({
      ...wallet,
      scope: "shop",
    });
  } catch (error) {
    console.error("GET /shop/wallet error:", error);
    res.status(500).json({ error: "Gagal mengambil saldo ZhuuShop." });
  }
});

router.get("/shop/wallet/transactions", async (req, res) => {
  try {
    const userId = getUserId(req, res);
    if (!userId) return;

    await ensureWalletTables();

    const transactions = await db
      .select()
      .from(walletTransactionsTable)
      .where(
        and(
          eq(walletTransactionsTable.userId, userId),
          eq(walletTransactionsTable.scope, "shop"),
        ),
      )
      .orderBy(desc(walletTransactionsTable.createdAt));

    res.json(transactions);
  } catch (error) {
    console.error("GET /shop/wallet/transactions error:", error);
    res.status(500).json({ error: "Gagal mengambil transaksi ZhuuShop." });
  }
});

router.post("/shop/wallet/deposit", async (req, res) => {
  try {
    const userId = getUserId(req, res);
    if (!userId) return;

    const amount = Number(req.body?.amount);

    if (!Number.isInteger(amount) || amount < 1000) {
      return res.status(400).json({
        error: "Minimal deposit adalah Rp1.000.",
      });
    }

    await ensureWalletTables();

    const reference = `SHOP-DEP-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()}`;

    const [transaction] = await db
      .insert(walletTransactionsTable)
      .values({
        userId,
        scope: "shop",
        type: "DEPOSIT",
        amount,
        reference,
        description: "Deposit ZhuuShop QRIS DANA",
        status: "PENDING",
      })
      .returning();

    res.json({
      transaction,
      qrisProvider: "DANA",
      status: "PENDING",
      qrUrl: "/attached_assets/IMG_20260917_085309.jpg",
    });
  } catch (error) {
    console.error("POST /shop/wallet/deposit error:", error);
    res.status(500).json({ error: "Gagal membuat deposit ZhuuShop." });
  }
});

router.patch("/shop/wallet/transactions/:id/check", async (req, res) => {
  try {
    const userId = getUserId(req, res);
    if (!userId) return;

    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "ID transaksi tidak valid." });
    }

    const [transaction] = await db
      .select()
      .from(walletTransactionsTable)
      .where(
        and(
          eq(walletTransactionsTable.id, id),
          eq(walletTransactionsTable.userId, userId),
          eq(walletTransactionsTable.scope, "shop"),
          eq(walletTransactionsTable.type, "DEPOSIT"),
        ),
      )
      .limit(1);

    if (!transaction) {
      return res.status(404).json({ error: "Transaksi tidak ditemukan." });
    }

    if (transaction.status !== "PENDING") {
      return res.status(400).json({
        error: "Transaksi sudah diproses.",
      });
    }

    const [updated] = await db
      .update(walletTransactionsTable)
      .set({
        description: `${transaction.description || "Deposit ZhuuShop"} | MEMBER_CHECKED`,
      })
      .where(eq(walletTransactionsTable.id, id))
      .returning();

    res.json({ transaction: updated });
  } catch (error) {
    console.error("PATCH /shop/wallet/transactions/:id/check error:", error);
    res.status(500).json({ error: "Gagal mengonfirmasi pembayaran." });
  }
});

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
      qrUrl: "/attached_assets/IMG_20260917_085309.jpg",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Gagal membuat deposit" });
  }
});

router.patch("/wallet/transactions/:id/check", async (req, res) => {
  try {
    const userId = await getUserId(req, res);
    if (!userId) return;

    await ensureWalletTables();

    const id = Number(req.params.id);

    const [transaction] = await db
      .select()
      .from(walletTransactionsTable)
      .where(
        and(
          eq(walletTransactionsTable.id, id),
          eq(walletTransactionsTable.userId, userId),
          eq(walletTransactionsTable.type, "DEPOSIT")
        )
      )
      .limit(1);

    if (!transaction) {
      return res.status(404).json({ error: "Transaksi deposit tidak ditemukan" });
    }

    const description = transaction.description || "";

    if (!description.includes("MEMBER_CHECKED")) {
      const [updated] = await db
        .update(walletTransactionsTable)
        .set({
          description: `${description} | MEMBER_CHECKED`
        })
        .where(eq(walletTransactionsTable.id, id))
        .returning();

      return res.json({ transaction: updated });
    }

    return res.json({ transaction });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Gagal menandai deposit" });
  }
});

router.get("/admin/wallet/deposits", requireAdmin, async (_req, res) => {
  try {
    await ensureWalletTables();

    const deposits = await db
      .select()
      .from(walletTransactionsTable)
      .where(
        and(
          eq(walletTransactionsTable.type, "DEPOSIT"),
          like(walletTransactionsTable.description, "%MEMBER_CHECKED%")
        )
      )
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
      .set({ status: "REJECTED" })
      .where(eq(walletTransactionsTable.id, id))
      .returning();

    await createNotification({
      userId: transaction.userId,
      type: "wallet",
      title: "Deposit ditolak",
      message: `Deposit Rp${Number(transaction.amount).toLocaleString("id-ID")} ditolak oleh admin.`,
      link: "/member",
    }).catch((error) => {
      console.error("Deposit rejection notification failed:", error);
    });

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
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "ID deposit tidak valid" });
    }

    const result = await db.transaction(async (tx) => {
      const [transaction] = await tx
        .update(walletTransactionsTable)
        .set({ status: "PAID" })
        .where(
          and(
            eq(walletTransactionsTable.id, id),
            eq(walletTransactionsTable.type, "DEPOSIT"),
            eq(walletTransactionsTable.status, "PENDING"),
            like(walletTransactionsTable.description, "%MEMBER_CHECKED%"),
          ),
        )
        .returning();

      if (!transaction) {
        throw new Error(
          "Deposit tidak ditemukan, belum dikonfirmasi member, atau sudah diproses",
        );
      }

      const walletScope = transaction.scope === "shop" ? "shop" : "site";

      let walletUserId = transaction.userId;

      // Reseller wallet mapping hanya berlaku untuk ZhuuSite.
      // ZhuuShop selalu menggunakan wallet milik user + scope=shop.
      if (walletScope === "site") {
        const resellerRows = await tx.execute(
          sql`SELECT wallet_user_id
              FROM reseller_members
              WHERE user_id = ${transaction.userId}
              LIMIT 1`,
        );

        const resellerMember = Array.isArray(resellerRows)
          ? resellerRows[0]
          : (resellerRows as any)?.rows?.[0];

        walletUserId = String(
          resellerMember?.wallet_user_id || transaction.userId,
        );
      }

      let [wallet] = await tx
        .select()
        .from(walletsTable)
        .where(
          and(
            eq(walletsTable.userId, walletUserId),
            eq(walletsTable.scope, walletScope),
          ),
        )
        .limit(1);

      if (!wallet) {
        [wallet] = await tx
          .insert(walletsTable)
          .values({
            userId: walletUserId,
            scope: walletScope,
            balance: 0,
          })
          .returning();
      }

      console.log("DEBUG ATOMIC DEPOSIT BEFORE:", {
        transactionId: transaction.id,
        userId: transaction.userId,
        scope: walletScope,
        walletUserId,
        amount: transaction.amount,
        balanceBefore: wallet.balance,
      });

      const [updatedWallet] = await tx
        .update(walletsTable)
        .set({
          balance: sql`${walletsTable.balance} + ${transaction.amount}`,
          updatedAt: new Date(),
        })
        .where(eq(walletsTable.id, wallet.id))
        .returning();

      if (!updatedWallet) {
        throw new Error("Gagal memperbarui saldo wallet");
      }

      console.log("DEBUG ATOMIC DEPOSIT AFTER:", {
        walletId: updatedWallet.id,
        walletUserId,
        scope: walletScope,
        balanceAfter: updatedWallet.balance,
      });

      return {
        wallet: updatedWallet,
        transaction,
      };
    });

    await createNotification({
      userId: result.transaction.userId,
      type: "wallet",
      title: "Deposit berhasil 💰",
      message: `Saldo Rp${Number(result.transaction.amount).toLocaleString("id-ID")} sudah masuk ke wallet kamu.`,
      link: "/member",
    }).catch((error) => {
      console.error("Deposit confirmation notification failed:", error);
    });

    return res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";

    if (
      message ===
      "Deposit tidak ditemukan, belum dikonfirmasi member, atau sudah diproses"
    ) {
      return res.status(400).json({ error: message });
    }

    console.error("Deposit confirmation error:", err);
    return res.status(500).json({
      error: "Gagal mengonfirmasi deposit",
    });
  }
});


router.get("/admin/shop/wallet/users", requireAdmin, async (req, res) => {
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

    // Reseller ZhuuShop memakai akun Member yang sama.
    // Karena wallet juga memakai user_id Member yang sama,
    // jangan kirim reseller sebagai user wallet kedua.
    const resellerRows = rowsOf(
      await db.execute(sql`
        SELECT
          r.id,
          r.user_id,
          r.username,
          r.wallet_email,
          r.wallet_username,
          r.active,
          r.expires_at
        FROM reseller_members r
        WHERE r.scope = 'shop'
      `),
    );

    const resellerByUserId = new Map(
      resellerRows.map((r) => [
        String(r.user_id),
        r,
      ]),
    );

    const users = await Promise.all(
      result.data.map(async (user) => {
        const [wallet] = await db
          .select()
          .from(walletsTable)
          .where(
            and(
              eq(walletsTable.userId, user.id),
              eq(walletsTable.scope, "shop"),
            ),
          )
          .limit(1);

        const reseller = resellerByUserId.get(user.id);

        const email =
          user.emailAddresses.find(
            (item) => item.id === user.primaryEmailAddressId,
          )?.emailAddress ||
          user.emailAddresses[0]?.emailAddress ||
          "";

        const username =
          user.username ||
          [user.firstName, user.lastName]
            .filter(Boolean)
            .join(" ") ||
          email.split("@")[0] ||
          "Member";

        return {
          id: user.id,
          userId: user.id,
          username,
          email,
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          imageUrl: user.imageUrl || "",

          // Tetap satu wallet/user.
          type: reseller ? "reseller" as const : "member" as const,
          isReseller: Boolean(reseller),

          balance: Number(wallet?.balance || 0),

          ...(reseller
            ? {
                resellerId: Number(reseller.id),
                active: Boolean(reseller.active),
                expiresAt: reseller.expires_at,
              }
            : {}),
        };
      }),
    );

    return res.json({
      users,
      totalCount: result.totalCount,
      offset,
      limit,
    });
  } catch (err) {
    console.error("ADMIN SHOP GET WALLET USERS ERROR:", err);

    return res.status(500).json({
      error: "Gagal mengambil daftar user ZhuuShop",
    });
  }
});

router.post("/admin/shop/wallet/adjust", requireAdmin, async (req, res) => {
  try {
    await ensureWalletTables();

    const {
      userId,
      type,
      action,
      amount,
      reason,
    } = req.body;

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({
        error: "userId wajib diisi",
      });
    }

    if (type !== "member" && type !== "reseller") {
      return res.status(400).json({
        error: 'type harus "member" atau "reseller"',
      });
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

    let walletUserId = userId;

    if (type === "reseller") {
      const [reseller] = rowsOf(
        await db.execute(sql`
          SELECT wallet_user_id
          FROM reseller_members
          WHERE user_id = ${userId}
            AND scope = 'shop'
          LIMIT 1
        `),
      );

      if (!reseller) {
        return res.status(404).json({
          error: "Reseller ZhuuShop tidak ditemukan",
        });
      }

      walletUserId = String(reseller.wallet_user_id || userId);
    }

    let [wallet] = await db
      .select()
      .from(walletsTable)
      .where(
        and(
          eq(walletsTable.userId, walletUserId),
          eq(walletsTable.scope, "shop"),
        ),
      )
      .limit(1);

    if (!wallet) {
      [wallet] = await db
        .insert(walletsTable)
        .values({
          userId: walletUserId,
          scope: "shop",
          balance: 0,
        })
        .returning();
    }

    const balanceBefore = wallet.balance;

    if (
      action === "subtract" &&
      balanceBefore < numericAmount
    ) {
      return res.status(400).json({
        error: "Saldo tidak cukup untuk dikurangi",
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
            : sql`${walletsTable.balance} = ${balanceBefore}`,
        ),
      )
      .returning();

    if (!updatedWallet) {
      return res.status(409).json({
        error: "Saldo berubah bersamaan. Silakan coba lagi.",
      });
    }

    const reference =
      `SHOP-ADM-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-` +
      Math.random().toString(36).slice(2, 8).toUpperCase();

    const [transaction] = await db
      .insert(walletTransactionsTable)
      .values({
        userId: walletUserId,
        scope: "shop",
        type: "ADMIN_ADJUSTMENT",
        amount: action === "add" ? numericAmount : -numericAmount,
        reference,
        description:
          `Admin ${action === "add" ? "menambah" : "mengurangi"} saldo: ${reason.trim()}`,
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
    console.error("ADMIN SHOP WALLET ADJUST ERROR:", err);

    return res.status(500).json({
      error: "Gagal mengubah saldo user ZhuuShop",
    });
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

    console.log("DEBUG ADMIN ADJUST:", {
      rawAmount: amount,
      rawAmountType: typeof amount,
      numericAmount: Number(amount),
    });

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
