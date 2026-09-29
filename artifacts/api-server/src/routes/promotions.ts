import { Router } from "express";
import { getAuth } from "@clerk/express";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { db, promotions, walletsTable, walletTransactionsTable } from "@workspace/db";
import { isAdmin } from "../lib/auth.js";

const router = Router();

const PACKAGES = [
  { durationDays: 1, price: 5000 },
  { durationDays: 3, price: 10000 },
  { durationDays: 7, price: 20000 },
  { durationDays: 14, price: 35000 },
  { durationDays: 30, price: 60000 },
];

const CATEGORIES = [
  "PRODUCT",
  "SERVICE",
  "WEBSITE",
  "APP",
  "COMMUNITY",
  "OTHER",
];

function requireAuth(req: any, res: any): string | null {
  const userId = getAuth(req)?.userId;

  if (!userId) {
    res.status(401).json({ error: "Login diperlukan" });
    return null;
  }

  return userId;
}

// Paket promosi
router.get("/promotions/packages", (_req, res) => {
  res.json({
    packages: PACKAGES,
    categories: CATEGORIES,
  });
});

// Promosi aktif
router.get("/promotions", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(promotions)
      .where(
        and(
          eq(promotions.status, "ACTIVE"),
          gt(promotions.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(promotions.createdAt));

    res.json(rows);
  } catch (err) {
    console.error("Get promotions error:", err);
    res.status(500).json({ error: "Gagal mengambil promosi" });
  }
});

// Promosi milik user
router.get("/promotions/mine", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  try {
    const rows = await db
      .select()
      .from(promotions)
      .where(eq(promotions.userId, userId))
      .orderBy(desc(promotions.createdAt));

    res.json(rows);
  } catch (err) {
    console.error("Get my promotions error:", err);
    res.status(500).json({ error: "Gagal mengambil promosi kamu" });
  }
});

// Buat draft promosi
router.post("/promotions", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  try {
    const {
      title,
      description,
      category,
      link,
      imageUrl,
      durationDays,
    } = req.body;

    const cleanTitle = String(title || "").trim();
    const cleanDescription = String(description || "").trim();
    const cleanCategory = String(category || "").toUpperCase();
    const cleanLink = String(link || "").trim();
    const cleanImageUrl = String(imageUrl || "").trim();
    const days = Number(durationDays);

    if (!cleanTitle || cleanTitle.length > 150) {
      return res.status(400).json({
        error: "Judul wajib diisi dan maksimal 150 karakter",
      });
    }

    if (cleanDescription.length > 2000) {
      return res.status(400).json({
        error: "Deskripsi maksimal 2000 karakter",
      });
    }

    if (!CATEGORIES.includes(cleanCategory)) {
      return res.status(400).json({
        error: "Kategori promosi tidak valid",
      });
    }

    const selectedPackage = PACKAGES.find(
      (item) => item.durationDays === days,
    );

    if (!selectedPackage) {
      return res.status(400).json({
        error: "Durasi promosi tidak valid",
      });
    }

    const result = await db.transaction(async (tx) => {
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

      if (wallet.balance < selectedPackage.price) {
        throw new Error(
          `Saldo tidak cukup|${wallet.balance}|${selectedPackage.price}`,
        );
      }

      const [updatedWallet] = await tx
        .update(walletsTable)
        .set({
          balance: sql`${walletsTable.balance} - ${selectedPackage.price}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(walletsTable.id, wallet.id),
            sql`${walletsTable.balance} >= ${selectedPackage.price}`,
          ),
        )
        .returning();

      if (!updatedWallet) {
        throw new Error(
          "Saldo tidak cukup atau saldo berubah, silakan coba lagi",
        );
      }

      const startsAt = new Date();
      const expiresAt = new Date(startsAt);
      expiresAt.setDate(expiresAt.getDate() + selectedPackage.durationDays);

      const [promotion] = await tx
        .insert(promotions)
        .values({
          userId,
          title: cleanTitle,
          description: cleanDescription || null,
          category: cleanCategory,
          link: cleanLink || null,
          imageUrl: cleanImageUrl || null,
          durationDays: selectedPackage.durationDays,
          price: selectedPackage.price,
          status: "ACTIVE",
          startsAt,
          expiresAt,
        })
        .returning();

      await tx.insert(walletTransactionsTable).values({
        userId,
        type: "PROMOTION",
        amount: -selectedPackage.price,
        reference: `PROMOTION-${promotion.id}`,
        description: `Promosi ${selectedPackage.durationDays} hari - ${cleanTitle}`,
        status: "PAID",
      });

      return {
        promotion,
        balance: updatedWallet.balance,
      };
    });

    return res.status(201).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";

    if (message.startsWith("Saldo tidak cukup|")) {
      const [, balance, required] = message.split("|");

      return res.status(400).json({
        error: "Saldo tidak cukup",
        balance: Number(balance),
        required: Number(required),
      });
    }

    console.error("Create promotion error:", err);

    return res.status(500).json({
      error: "Gagal membuat promosi",
    });
  }
});

// Admin: lihat semua promosi
router.get("/admin/promotions", async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const rows = await db
      .select()
      .from(promotions)
      .orderBy(desc(promotions.createdAt));

    return res.json(rows);
  } catch (err) {
    console.error("Admin get promotions error:", err);
    return res.status(500).json({ error: "Gagal mengambil promosi" });
  }
});

// Admin: hapus promosi permanen
router.delete("/admin/promotions/:id", async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "ID promosi tidak valid" });
    }

    const [deleted] = await db
      .delete(promotions)
      .where(eq(promotions.id, id))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Promosi tidak ditemukan" });
    }

    return res.json({ success: true, promotion: deleted });
  } catch (err) {
    console.error("Admin delete promotion error:", err);
    return res.status(500).json({ error: "Gagal menghapus promosi" });
  }
});

// Admin: batalkan promosi
router.patch("/admin/promotions/:id/cancel", async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const id = Number(req.params.id);

    const [updated] = await db
      .update(promotions)
      .set({
        status: "CANCELLED",
      })
      .where(eq(promotions.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Promosi tidak ditemukan" });
    }

    return res.json(updated);
  } catch (err) {
    console.error("Cancel promotion error:", err);
    return res.status(500).json({ error: "Gagal membatalkan promosi" });
  }
});

export default router;
