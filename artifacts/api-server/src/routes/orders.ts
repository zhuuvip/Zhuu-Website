import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, productsTable, productOptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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
      return res.status(400).json({ error: "Produk atau durasi tidak valid" });
    }

    if (option.stock <= 0) {
      return res.status(400).json({ error: "Stok habis" });
    }

    const invoice = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

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
      })
      .returning();

    return res.json(order);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Gagal membuat invoice" });
  }
});

export default router;
