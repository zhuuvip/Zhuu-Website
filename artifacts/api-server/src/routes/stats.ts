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
  productsTable,
  productOptionsTable,
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
      [{ revenue7d }],
      [{ revenueMonth }],
      [{ orders7d }],
      orderAnalytics7d,
      [{ pendingDeposits }],
      [{ depositTotal }],
      topProducts,
      lowStockProducts,
    ] = await Promise.all([
      db.select({ links: sql<number>`count(*)::int` }).from(linksTable),

      db.select({ songs: sql<number>`count(*)::int` }).from(songsTable),

      db.select({ feedback: sql<number>`count(*)::int` }).from(feedbackTable),

      db
        .select({
          conversationsCount: sql<number>`count(*)::int`,
        })
        .from(conversations),

      db
        .select({
          messagesCount: sql<number>`count(*)::int`,
        })
        .from(messages),

      db
        .select({
          totalOrders: sql<number>`count(*)::int`,
        })
        .from(ordersTable),

      db
        .select({
          successfulOrders: sql<number>`count(*)::int`,
        })
        .from(ordersTable)
        .where(
          sql`UPPER(${ordersTable.status}) IN ('SUCCESS', 'COMPLETED', 'CONFIRMED')`,
        ),

      db
        .select({
          pendingOrders: sql<number>`count(*)::int`,
        })
        .from(ordersTable)
        .where(sql`UPPER(${ordersTable.status}) = 'PENDING'`),

      db
        .select({
          revenue: sql<number>`COALESCE(SUM(${ordersTable.amount}), 0)::int`,
        })
        .from(ordersTable)
        .where(
          sql`UPPER(${ordersTable.status}) IN ('SUCCESS', 'COMPLETED', 'CONFIRMED')`,
        ),

      db
        .select({
          revenue7d: sql<number>`COALESCE(SUM(${ordersTable.amount}), 0)::int`,
        })
        .from(ordersTable)
        .where(
          sql`
            UPPER(${ordersTable.status}) IN ('SUCCESS', 'COMPLETED', 'CONFIRMED')
            AND ${ordersTable.createdAt} >= NOW() - INTERVAL '7 days'
          `,
        ),

      db
        .select({
          revenueMonth: sql<number>`COALESCE(SUM(${ordersTable.amount}), 0)::int`,
        })
        .from(ordersTable)
        .where(
          sql`
            UPPER(${ordersTable.status}) IN ('SUCCESS', 'COMPLETED', 'CONFIRMED')
            AND ${ordersTable.createdAt} >= date_trunc('month', NOW())
          `,
        ),

      db
        .select({
          orders7d: sql<number>`count(*)::int`,
        })
        .from(ordersTable)
        .where(
          sql`
            ${ordersTable.createdAt} >= NOW() - INTERVAL '7 days'
          `,
        ),

      db.execute(sql`
        SELECT
          TO_CHAR(DATE(created_at), 'YYYY-MM-DD') AS date,
          COUNT(*)::int AS total_orders,
          COUNT(*) FILTER (
            WHERE UPPER(status) IN ('SUCCESS', 'COMPLETED', 'CONFIRMED')
          )::int AS successful_orders,
          COUNT(*) FILTER (
            WHERE UPPER(status) = 'PENDING'
          )::int AS pending_orders,
          COALESCE(
            SUM(amount) FILTER (
              WHERE UPPER(status) IN ('SUCCESS', 'COMPLETED', 'CONFIRMED')
            ),
            0
          )::int AS revenue
        FROM orders
        WHERE created_at >= CURRENT_DATE - INTERVAL '6 days'
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at) ASC
      `),

      db
        .select({
          pendingDeposits: sql<number>`count(*)::int`,
        })
        .from(walletTransactionsTable)
        .where(
          sql`
            UPPER(${walletTransactionsTable.type}) IN ('DEPOSIT', 'TOPUP')
            AND UPPER(${walletTransactionsTable.status}) = 'PENDING'
          `,
        ),

      db
        .select({
          depositTotal: sql<number>`
            COALESCE(SUM(${walletTransactionsTable.amount}), 0)::int
          `,
        })
        .from(walletTransactionsTable)
        .where(
          sql`
            UPPER(${walletTransactionsTable.type}) IN ('DEPOSIT', 'TOPUP')
            AND UPPER(${walletTransactionsTable.status}) = 'PENDING'
          `,
        ),

      db
        .select({
          productName: ordersTable.productName,
          sold: sql<number>`count(*)::int`,
          revenue: sql<number>`COALESCE(SUM(${ordersTable.amount}), 0)::int`,
        })
        .from(ordersTable)
        .where(
          sql`UPPER(${ordersTable.status}) IN ('SUCCESS', 'COMPLETED', 'CONFIRMED')`,
        )
        .groupBy(ordersTable.productName)
        .orderBy(sql`count(*) DESC`)
        .limit(5),

      db
        .select({
          productId: productsTable.id,
          productName: productsTable.name,
          optionId: productOptionsTable.id,
          duration: productOptionsTable.duration,
          stock: productOptionsTable.stock,
          dripStock: productOptionsTable.dripStock,
          dripVariantId: productOptionsTable.dripVariantId,
          effectiveStock: sql<number>`
            CASE
              WHEN ${productOptionsTable.dripVariantId} IS NOT NULL
                THEN ${productOptionsTable.dripStock}
              ELSE ${productOptionsTable.stock}
            END
          `,
        })
        .from(productOptionsTable)
        .leftJoin(
          productsTable,
          sql`${productsTable.id} = ${productOptionsTable.productId}`,
        )
        .where(
          sql`
            CASE
              WHEN ${productOptionsTable.dripVariantId} IS NOT NULL
                THEN ${productOptionsTable.dripStock}
              ELSE ${productOptionsTable.stock}
            END <= 5
          `,
        )
        .orderBy(
          sql`
            CASE
              WHEN ${productOptionsTable.dripVariantId} IS NOT NULL
                THEN ${productOptionsTable.dripStock}
              ELSE ${productOptionsTable.stock}
            END ASC
          `,
        )
        .limit(10),
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
        revenue7d,
        revenueMonth,
        orders7d,
        orderAnalytics7d: orderAnalytics7d.rows,
        pendingDeposits,
        depositTotal,
        topProducts,
        lowStockProducts,
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
