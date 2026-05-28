import { Router } from "express";
import { db } from "@workspace/db";
import { linksTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateLinkBody,
  UpdateLinkBody,
  UpdateLinkParams,
  DeleteLinkParams,
} from "@workspace/api-zod";
import { requireAdmin } from "../lib/auth";

const router = Router();

router.get("/links", async (req, res) => {
  try {
    const links = await db.select().from(linksTable).orderBy(linksTable.sortOrder);
    return res.json(links);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to fetch links" });
  }
});

router.post("/links", requireAdmin, async (req, res) => {
  const parsed = CreateLinkBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  try {
    const [link] = await db.insert(linksTable).values(parsed.data).returning();
    return res.status(201).json(link);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to create link" });
  }
});

router.patch("/links/:id", requireAdmin, async (req, res) => {
  const params = UpdateLinkParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) return res.status(400).json({ error: "Invalid id" });
  const parsed = UpdateLinkBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  try {
    const [link] = await db
      .update(linksTable)
      .set(parsed.data)
      .where(eq(linksTable.id, params.data.id))
      .returning();
    if (!link) return res.status(404).json({ error: "Link not found" });
    return res.json(link);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to update link" });
  }
});

router.delete("/links/:id", requireAdmin, async (req, res) => {
  const params = DeleteLinkParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) return res.status(400).json({ error: "Invalid id" });
  try {
    await db.delete(linksTable).where(eq(linksTable.id, params.data.id));
    return res.status(204).send();
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to delete link" });
  }
});

export default router;

router.post("/links/:id/click", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    await db.execute(
      `UPDATE links SET click_count = click_count + 1 WHERE id = ${id}`
    );
    return res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to track click" });
  }
});
