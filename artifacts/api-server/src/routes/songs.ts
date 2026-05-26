import { Router } from "express";
import { db } from "@workspace/db";
import { songsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";

const router = Router();

router.get("/songs", async (req, res) => {
  try {
    const songs = await db.select().from(songsTable).orderBy(songsTable.sortOrder);
    return res.json(songs);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to fetch songs" });
  }
});

router.post("/songs", requireAdmin, async (req, res) => {
  const { title, artist, url, coverUrl, duration, sortOrder } = req.body as Record<string, unknown>;
  if (!title || typeof title !== "string" || !artist || typeof artist !== "string" || !url || typeof url !== "string") {
    return res.status(400).json({ error: "title, artist, and url are required strings" });
  }
  try {
    const [song] = await db
      .insert(songsTable)
      .values({
        title: title.trim(),
        artist: (artist as string).trim(),
        url: (url as string).trim(),
        coverUrl: typeof coverUrl === "string" && coverUrl ? coverUrl.trim() : null,
        duration: typeof duration === "number" ? duration : null,
        sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
      })
      .returning();
    return res.status(201).json(song);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to create song" });
  }
});

router.patch("/songs/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!id || isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const { title, artist, url, coverUrl, duration, sortOrder } = req.body as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (typeof title === "string") patch.title = title.trim();
  if (typeof artist === "string") patch.artist = (artist as string).trim();
  if (typeof url === "string") patch.url = (url as string).trim();
  if (coverUrl !== undefined) patch.coverUrl = typeof coverUrl === "string" && coverUrl ? coverUrl.trim() : null;
  if (typeof duration === "number") patch.duration = duration;
  if (typeof sortOrder === "number") patch.sortOrder = sortOrder;
  if (Object.keys(patch).length === 0) return res.status(400).json({ error: "Nothing to update" });
  try {
    const [song] = await db
      .update(songsTable)
      .set(patch)
      .where(eq(songsTable.id, id))
      .returning();
    if (!song) return res.status(404).json({ error: "Song not found" });
    return res.json(song);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to update song" });
  }
});

router.delete("/songs/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!id || isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    await db.delete(songsTable).where(eq(songsTable.id, id));
    return res.status(204).send();
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to delete song" });
  }
});

export default router;
