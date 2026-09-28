import { Router } from "express";
import { db } from "@workspace/db";
import {
  linksTable,
  songsTable,
  feedbackTable,
  conversations,
  messages,
  ordersTable,
  walletTransactionsTable,
} from "@workspace/db";
import { requireAdmin } from "../lib/auth.js";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/admin/stats", requireAdmin, async (req, res) => {
  try {
    const [
      [{ links }],
      [{ songs }],
      [{ feedback }],
      [{ conversationsCount }],
      [{ messagesCount }],
      [{ totalOrders }],
      [{ successfulOrders }],
      [{ pendingOrders }],
      [{ revenue }],
      [{ pendingDeposits }],
      [{ depositTotal }],
    ] = await Promise.all([
      db.select({ links: sql<number>`count(*)::int` }).from(linksTable),
      db.select({ songs: sql<number>`count(*)::int` }).from(songsTable),
      db.select({ feedback: sql<number>`count(*)::int` }).from(feedbackTable),
      db.select({ conversationsCount: sql<number>`count(*)::int` }).from(conversations),
      db.select({ messagesCount: sql<number>`count(*)::int` }).from(messages),

      db.select({ totalOrders: sql<number>`count(*)::int` }).from(ordersTable),

      db.select({
        successfulOrders: sql<number>`count(*)::int`,
      })
        .from(ordersTable)
        .where(sql`UPPER(${ordersTable.status}) IN ('SUCCESS', 'COMPLETED', 'CONFIRMED')`),

      db.select({
        pendingOrders: sql<number>`count(*)::int`,
      })
        .from(ordersTable)
        .where(sql`UPPER(${ordersTable.status}) = 'PENDING'`),

      db.select({
        revenue: sql<number>`COALESCE(SUM(${ordersTable.amount}), 0)::int`,
      })
        .from(ordersTable)
        .where(sql`UPPER(${ordersTable.status}) IN ('SUCCESS', 'COMPLETED', 'CONFIRMED')`),

      db.select({
        pendingDeposits: sql<number>`count(*)::int`,
      })
        .from(walletTransactionsTable)
        .where(sql`
          UPPER(${walletTransactionsTable.type}) IN ('DEPOSIT', 'TOPUP')
          AND UPPER(${walletTransactionsTable.status}) = 'PENDING'
        `),

      db.select({
        depositTotal: sql<number>`COALESCE(SUM(${walletTransactionsTable.amount}), 0)::int`,
      })
        .from(walletTransactionsTable)
        .where(sql`
          UPPER(${walletTransactionsTable.type}) IN ('DEPOSIT', 'TOPUP')
          AND UPPER(${walletTransactionsTable.status}) = 'PENDING'
        `),
    ]);

    res.json({
      links,
      songs,
      feedback,
      conversations: conversationsCount,
      messages: messagesCount,

      business: {
        totalOrders,
        successfulOrders,
        pendingOrders,
        revenue,
        pendingDeposits,
        depositTotal,
      },
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// Track visitor
router.post("/visitors", async (req, res) => {
  const { page } = req.body as { page?: string };

  try {
    await db.execute(
      sql`INSERT INTO visitors (page) VALUES (${page ?? "/"})`,
    );

    const result = await db.execute(
      sql`SELECT COUNT(*) as count FROM visitors`,
    );

    return res.json({ count: (result.rows[0] as any).count });
  } catch (err) {
    return res.status(500).json({ error: "Failed to track visitor" });
  }
});

// Get visitor count
router.get("/visitors", async (_req, res) => {
  try {
    const result = await db.execute(
      sql`SELECT COUNT(*) as count FROM visitors`,
    );

    return res.json({ count: (result.rows[0] as any).count });
  } catch (err) {
    return res.status(500).json({ error: "Failed to get visitor count" });
  }
});

export default router;
