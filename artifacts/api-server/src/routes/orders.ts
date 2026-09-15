import { Router } from "express";
import { db } from "@workspace/db";
import {
  ordersTable,
  productsTable,
  productOptionsTable,
  productKeysTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";

const router = Router();

router.post("/orders", async (req, res) => {
  try {
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

    if (product.deliveryType === "KEY") {
      const [availableKey] = await db
        .select({ id: productKeysTable.id })
        .from(productKeysTable)
        .where(
          and(
            eq(productKeysTable.productId, product.id),
            eq(productKeysTable.optionId, option.id),
            eq(productKeysTable.status, "READY"),
          ),
        )
        .limit(1);

      if (!availableKey) {
        return res.status(400).json({
          error: "Key untuk durasi ini habis",
        });
      }
    }

    const invoice =
      `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-` +
      Math.random().toString(36).slice(2, 7).toUpperCase();

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
        status: "PENDING",
        paymentRef: null,
      })
      .returning();

    return res.json(order);
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Gagal membuat invoice",
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

router.patch("/admin/orders/:id/confirm", requireAdmin, async (req, res) => {
  try {
    const orderId = Number(req.params.id);

    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId));

    if (!order) {
      return res.status(404).json({ error: "Order tidak ditemukan" });
    }

    if (order.status !== "PENDING") {
      return res.status(400).json({
        error: "Order sudah diproses",
      });
    }

    const [product] = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, order.productId));

    const [option] = await db
      .select()
      .from(productOptionsTable)
      .where(eq(productOptionsTable.id, order.optionId));

    if (!product || !option || option.productId !== product.id) {
      return res.status(400).json({
        error: "Produk atau durasi order tidak valid",
      });
    }

    let deliveryKey: string | null = null;

    if (product.deliveryType === "KEY") {
      const [keyRow] = await db
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
          error: "Key untuk durasi ini sudah habis",
        });
      }

      deliveryKey = keyRow.key;

      await db
        .update(productKeysTable)
        .set({ status: "SOLD" })
        .where(eq(productKeysTable.id, keyRow.id));
    }

    if (option.stock <= 0) {
      return res.status(400).json({
        error: "Stok durasi ini sudah habis",
      });
    }

    await db
      .update(productOptionsTable)
      .set({
        stock: Math.max(0, option.stock - 1),
      })
      .where(eq(productOptionsTable.id, option.id));

    const [updated] = await db
      .update(ordersTable)
      .set({
        status: "PAID",
        paymentRef: deliveryKey,
      })
      .where(eq(ordersTable.id, order.id))
      .returning();

    return res.json({
      ...updated,
      deliveryKey,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Gagal mengonfirmasi order",
    });
  }
});

export default router;
