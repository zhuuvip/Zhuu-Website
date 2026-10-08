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
  settingsTable,
} from "@workspace/db";
import { requireAdmin } from "../lib/auth.js";
import { sql } from "drizzle-orm";
import { DRIP_CATALOG } from "../data/dripCatalog.js";

const router = Router();

const DRIP_MODAL_BY_VARIANT = new Map(
  DRIP_CATALOG.flatMap((product) =>
    product.variants.map((variant) => [Number(variant.id), Number(variant.modal)]),
  ),
);

router.post("/admin/stats/reset", requireAdmin, async (req, res) => {
  try {
    const resetAt = new Date();

    await db
      .insert(settingsTable)
      .values({
        key: "profit_calculation_reset_at",
        value: resetAt.toISOString(),
      })
      .onConflictDoUpdate({
        target: settingsTable.key,
        set: {
          value: resetAt.toISOString(),
          updatedAt: resetAt,
        },
      });

    return res.json({
      success: true,
      resetAt: resetAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({
      error: "Failed to reset profit calculation",
    });
  }
});

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
      orderAnalytics30d,
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
          sql`UPPER(${ordersTable.status}) IN ('PAID')`,
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
          sql`UPPER(${ordersTable.status}) IN ('PAID')`,
        ),

      db
        .select({
          revenue7d: sql<number>`COALESCE(SUM(${ordersTable.amount}), 0)::int`,
        })
        .from(ordersTable)
        .where(
          sql`
            UPPER(${ordersTable.status}) IN ('PAID')
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
            UPPER(${ordersTable.status}) IN ('PAID')
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
            WHERE UPPER(status) IN ('PAID')
          )::int AS successful_orders,
          COUNT(*) FILTER (
            WHERE UPPER(status) = 'PENDING'
          )::int AS pending_orders,
          COALESCE(
            SUM(amount) FILTER (
              WHERE UPPER(status) IN ('PAID')
            ),
            0
          )::int AS revenue
        FROM orders
        WHERE created_at >= CURRENT_DATE - INTERVAL '6 days'
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at) ASC
      `),
      db.execute(sql`
        SELECT
          TO_CHAR(DATE(created_at), 'YYYY-MM-DD') AS date,
          COUNT(*)::int AS total_orders,
          COUNT(*) FILTER (
            WHERE UPPER(status) IN ('PAID')
          )::int AS successful_orders,
          COUNT(*) FILTER (
            WHERE UPPER(status) = 'PENDING'
          )::int AS pending_orders,
          COALESCE(
            SUM(amount) FILTER (
              WHERE UPPER(status) IN ('PAID')
            ),
            0
          )::int AS revenue
        FROM orders
        WHERE created_at >= CURRENT_DATE - INTERVAL '29 days'
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
          sql`UPPER(${ordersTable.status}) IN ('PAID')`,
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

    const [profitResetSetting] = await db
      .select({ value: settingsTable.value })
      .from(settingsTable)
      .where(sql`${settingsTable.key} = 'profit_calculation_reset_at'`)
      .limit(1);

    const profitResetAt = profitResetSetting?.value
      ? new Date(profitResetSetting.value)
      : null;

    const profitOrders = await db
      .select({
        amount: ordersTable.amount,
        dripVariantId: productOptionsTable.dripVariantId,
      })
      .from(ordersTable)
      .leftJoin(
        productOptionsTable,
        sql`${productOptionsTable.id} = ${ordersTable.optionId}`,
      )
      .where(sql`UPPER(${ordersTable.status}) = 'PAID'`);

    let profitRevenue = 0;
    let dripCost = 0;
    let countedOrders = 0;

    for (const order of profitOrders) {
      const variantId = order.dripVariantId;
      if (variantId == null) continue;

      const modal = DRIP_MODAL_BY_VARIANT.get(Number(variantId));
      if (modal == null) continue;

      profitRevenue += Number(order.amount) || 0;
      dripCost += modal;
      countedOrders++;
    }

    const netProfit = profitRevenue - dripCost;
    const yourFee = Math.max(0, Math.round(netProfit * 0.60));
    const richoProfit = netProfit - yourFee;

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
        orderAnalytics30d: orderAnalytics30d.rows,
        pendingDeposits,
        depositTotal,
        topProducts,
        lowStockProducts,
        profit: {
          revenue: profitRevenue,
          dripCost,
          netProfit,
          yourFee,
          richoProfit,
          countedOrders,
        },
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
