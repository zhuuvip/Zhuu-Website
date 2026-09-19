import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, walletsTable, walletTransactionsTable, premiumMembersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router = Router();

// Adjust these anytime — price in Rupiah, bonus = extra messages/tool-runs
// per day on top of the free daily limit, forever (no expiry).
const TIERS: Record<string, { price: number; aiBonus: number; toolsBonus: number; label: string }> = {
  silver: { price: 5000, aiBonus: 60, toolsBonus: 25, label: "Silver" },   // doubles the free limit
  gold: { price: 10000, aiBonus: 200, toolsBonus: 100, label: "Gold" },   // effectively unlimited for most usage
};

function requireAuth(req: any, res: any): string | null {
  const userId = getAuth(req)?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return userId;
}

// GET /api/premium/status — current membership (if any).
router.get("/premium/status", async (req: any, res: any) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  try {
    const [row] = await db
      .select()
      .from(premiumMembersTable)
      .where(eq(premiumMembersTable.userId, userId))
      .limit(1);
    res.json({ member: row ?? null, tiers: TIERS });
  } catch (err) {
    console.error("GET /premium/status error:", err);
    res.status(500).json({ error: "Gagal mengambil status membership" });
  }
});

// POST /api/premium/purchase — body: { tier: "silver" | "gold" }
router.post("/premium/purchase", async (req: any, res: any) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const tierKey = req.body?.tier;
  const tier = TIERS[tierKey];
  if (!tier) {
    return res.status(400).json({ error: "Tier tidak valid" });
  }

  try {
    const [existing] = await db
      .select()
      .from(premiumMembersTable)
      .where(eq(premiumMembersTable.userId, userId))
      .limit(1);

    if (existing && existing.tier === tierKey) {
      return res.status(409).json({ error: `Kamu sudah punya tier ${tier.label}` });
    }
    if (existing && (tier.aiBonus <= existing.aiBonus)) {
      return res.status(409).json({ error: "Kamu sudah punya tier yang lebih tinggi atau setara" });
    }

    // If upgrading (e.g. silver -> gold), only charge the price difference.
    const amountDue = existing ? Math.max(0, tier.price - Math.floor(existing.amountPaid)) : tier.price;

    const result = await db.transaction(async (tx) => {
      let [wallet] = await tx.select().from(walletsTable).where(eq(walletsTable.userId, userId)).limit(1);
      if (!wallet) {
        [wallet] = await tx.insert(walletsTable).values({ userId, balance: 0 }).returning();
      }

      if (wallet.balance < amountDue) {
        throw new Error(`Saldo tidak cukup|${wallet.balance}|${amountDue}`);
      }

      const [updatedWallet] = await tx
        .update(walletsTable)
        .set({ balance: sql`${walletsTable.balance} - ${amountDue}`, updatedAt: new Date() })
        .where(and(eq(walletsTable.id, wallet.id), sql`${walletsTable.balance} >= ${amountDue}`))
        .returning();

      if (!updatedWallet) {
        throw new Error("Saldo tidak cukup atau saldo berubah, silakan coba lagi");
      }

      const [member] = await tx
        .insert(premiumMembersTable)
        .values({ userId, tier: tierKey, aiBonus: tier.aiBonus, toolsBonus: tier.toolsBonus, amountPaid: tier.price })
        .onConflictDoUpdate({
          target: premiumMembersTable.userId,
          set: { tier: tierKey, aiBonus: tier.aiBonus, toolsBonus: tier.toolsBonus, amountPaid: tier.price, purchasedAt: new Date() },
        })
        .returning();

      await tx.insert(walletTransactionsTable).values({
        userId,
        type: "PURCHASE",
        amount: -amountDue,
        reference: `PREMIUM-${tierKey.toUpperCase()}-${Date.now()}`,
        description: `Upgrade ke Premium ${tier.label}`,
        status: "PAID",
      });

      return { member, balance: updatedWallet.balance };
    });

    res.json(result);
  } catch (err: any) {
    if (typeof err?.message === "string" && err.message.startsWith("Saldo tidak cukup|")) {
      const [, balance, required] = err.message.split("|");
      return res.status(400).json({ error: "Saldo tidak cukup", balance: Number(balance), required: Number(required) });
    }
    console.error("POST /premium/purchase error:", err);
    res.status(500).json({ error: err?.message || "Gagal upgrade premium" });
  }
});

export default router;
