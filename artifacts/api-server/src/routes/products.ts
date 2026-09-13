import { Router } from "express";
import { db } from "@workspace/db";
import { productsTable, productOptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";

const router = Router();

router.get("/products", async (_req, res) => {
  const products = await db.select().from(productsTable);
  const options = await db.select().from(productOptionsTable);
  return res.json(products.map(p => ({
    ...p,
    options: options.filter(o => o.productId === p.id),
  })));
});

router.post("/products", requireAdmin, async (req, res) => {
  const [product] = await db.insert(productsTable).values({
    name: req.body.name,
  }).returning();
  return res.json(product);
});

router.patch("/products/:id", requireAdmin, async (req, res) => {
  const [product] = await db.update(productsTable)
    .set({ name: req.body.name })
    .where(eq(productsTable.id, Number(req.params.id)))
    .returning();
  return res.json(product);
});

router.delete("/products/:id", requireAdmin, async (req, res) => {
  await db.delete(productOptionsTable)
    .where(eq(productOptionsTable.productId, Number(req.params.id)));
  await db.delete(productsTable)
    .where(eq(productsTable.id, Number(req.params.id)));
  return res.json({ ok: true });
});

router.post("/products/:id/options", requireAdmin, async (req, res) => {
  const [option] = await db.insert(productOptionsTable).values({
    productId: Number(req.params.id),
    duration: req.body.duration,
    price: Number(req.body.price),
    stock: Number(req.body.stock ?? 0),
  }).returning();
  return res.json(option);
});

router.patch("/products/options/:id", requireAdmin, async (req, res) => {
  const [option] = await db.update(productOptionsTable)
    .set({
      duration: req.body.duration,
      price: Number(req.body.price),
      stock: Number(req.body.stock),
    })
    .where(eq(productOptionsTable.id, Number(req.params.id)))
    .returning();
  return res.json(option);
});

router.delete("/products/options/:id", requireAdmin, async (req, res) => {
  await db.delete(productOptionsTable)
    .where(eq(productOptionsTable.id, Number(req.params.id)));
  return res.json({ ok: true });
});

export default router;
