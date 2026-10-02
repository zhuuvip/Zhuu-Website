import { Router } from "express";
import { db } from "@workspace/db";
import {
  testimonialsTable,
  ordersTable,
  walletTransactionsTable,
} from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { requireAdmin } from "../lib/auth.js";
import { rateLimit } from "../lib/rateLimit.js";

const router = Router();

const testimonialRateLimit = rateLimit({
  windowMs: 60_000,
  max: 5,
  message: "Too many testimonial submissions. Please wait a minute.",
});

// Submit testimonial for a completed website purchase
router.post("/testimonials", testimonialRateLimit, async (req, res) => {
  const userId = getAuth(req)?.userId;

  if (!userId) {
    res.status(401).json({ error: "Login diperlukan" });
    return;
  }

  const {
    orderId,
    customerName,
    rating,
    message,
    imageUrl,
  } = req.body ?? {};

  if (!Number.isInteger(orderId) || orderId <= 0) {
    res.status(400).json({ error: "Order tidak valid" });
    return;
  }

  if (!customerName?.trim()) {
    res.status(400).json({ error: "Customer name is required" });
    return;
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    res.status(400).json({ error: "Rating must be between 1 and 5" });
    return;
  }

  if (!message?.trim()) {
    res.status(400).json({ error: "Feedback is required" });
    return;
  }

  try {
    // Verify that this PAID order belongs to the logged-in user.
    const [order] = await db
      .select({
        id: ordersTable.id,
        invoice: ordersTable.invoice,
        productId: ordersTable.productId,
        productName: ordersTable.productName,
        duration: ordersTable.duration,
        status: ordersTable.status,
      })
      .from(ordersTable)
      .innerJoin(
        walletTransactionsTable,
        and(
          eq(walletTransactionsTable.reference, ordersTable.invoice),
          eq(walletTransactionsTable.userId, userId),
          eq(walletTransactionsTable.type, "PURCHASE"),
        ),
      )
      .where(eq(ordersTable.id, orderId))
      .limit(1);

    if (!order || order.status !== "PAID") {
      res.status(403).json({
        error: "Order tidak ditemukan atau belum berhasil dibayar",
      });
      return;
    }

    // Prevent duplicate testimonials for the same order.
    const [existing] = await db
      .select({ id: testimonialsTable.id })
      .from(testimonialsTable)
      .where(eq(testimonialsTable.orderId, order.id))
      .limit(1);

    if (existing) {
      res.status(409).json({
        error: "Testimoni untuk order ini sudah pernah dikirim",
      });
      return;
    }

    const [testimonial] = await db
      .insert(testimonialsTable)
      .values({
        orderId: order.id,
        customerName: customerName.trim(),
        productId: order.productId,
        productName: order.productName,
        duration: order.duration,
        purchaseType: "WEBSITE",
        rating,
        message: message.trim(),
        imageUrl: imageUrl?.trim() || null,
        status: "PENDING",
      })
      .returning();

    res.status(201).json(testimonial);
  } catch (err) {
    req.log.error(err, "Failed to save testimonial");
    res.status(500).json({ error: "Failed to save testimonial" });
  }
});

// Admin: create manual testimonial
router.post("/admin/testimonials", requireAdmin, async (req, res) => {
  const {
    customerName,
    productId,
    productName,
    duration,
    rating,
    message,
    imageUrl,
  } = req.body ?? {};

  if (!customerName?.trim()) {
    res.status(400).json({ error: "Customer name is required" });
    return;
  }

  if (!productName?.trim()) {
    res.status(400).json({ error: "Product name is required" });
    return;
  }

  if (!duration?.trim()) {
    res.status(400).json({ error: "Duration is required" });
    return;
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    res.status(400).json({ error: "Rating must be between 1 and 5" });
    return;
  }

  if (!message?.trim()) {
    res.status(400).json({ error: "Feedback is required" });
    return;
  }

  try {
    const [testimonial] = await db
      .insert(testimonialsTable)
      .values({
        orderId: null,
        customerName: customerName.trim(),
        productId: Number.isInteger(productId) ? productId : null,
        productName: productName.trim(),
        duration: duration.trim(),
        purchaseType: "MANUAL",
        rating,
        message: message.trim(),
        imageUrl: imageUrl?.trim() || null,
        status: "PUBLISHED",
        publishedAt: new Date(),
      })
      .returning();

    res.status(201).json(testimonial);
  } catch (err) {
    req.log.error(err, "Failed to save manual testimonial");
    res.status(500).json({ error: "Failed to save testimonial" });
  }
});

// Public published testimonials
router.get("/testimonials", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(testimonialsTable)
      .where(eq(testimonialsTable.status, "PUBLISHED"))
      .orderBy(desc(testimonialsTable.publishedAt))
      .limit(100);

    res.json(rows);
  } catch (err) {
    req.log.error(err, "Failed to fetch testimonials");
    res.status(500).json({ error: "Failed to fetch testimonials" });
  }
});

// Admin: all testimonials
router.get("/admin/testimonials", requireAdmin, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(testimonialsTable)
      .orderBy(desc(testimonialsTable.createdAt))
      .limit(200);

    res.json(rows);
  } catch (err) {
    req.log.error(err, "Failed to fetch admin testimonials");
    res.status(500).json({ error: "Failed to fetch testimonials" });
  }
});

// Admin: approve
router.patch("/admin/testimonials/:id/publish", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    const [testimonial] = await db
      .update(testimonialsTable)
      .set({
        status: "PUBLISHED",
        publishedAt: new Date(),
      })
      .where(eq(testimonialsTable.id, id))
      .returning();

    if (!testimonial) {
      res.status(404).json({ error: "Testimonial not found" });
      return;
    }

    res.json(testimonial);
  } catch (err) {
    req.log.error(err, "Failed to publish testimonial");
    res.status(500).json({ error: "Failed to publish testimonial" });
  }
});

// Admin: reject
router.patch("/admin/testimonials/:id/reject", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    const [testimonial] = await db
      .update(testimonialsTable)
      .set({ status: "REJECTED" })
      .where(eq(testimonialsTable.id, id))
      .returning();

    if (!testimonial) {
      res.status(404).json({ error: "Testimonial not found" });
      return;
    }

    res.json(testimonial);
  } catch (err) {
    req.log.error(err, "Failed to reject testimonial");
    res.status(500).json({ error: "Failed to reject testimonial" });
  }
});

// Admin: delete
router.delete("/admin/testimonials/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    await db
      .delete(testimonialsTable)
      .where(eq(testimonialsTable.id, id));

    res.status(204).send();
  } catch (err) {
    req.log.error(err, "Failed to delete testimonial");
    res.status(500).json({ error: "Failed to delete testimonial" });
  }
});

export default router;
