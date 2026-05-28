import { Router } from "express";
import { db } from "@workspace/db";
import { linksTable, songsTable, feedbackTable, conversations, messages } from "@workspace/db";
import { requireAdmin } from "../lib/auth";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/admin/stats", requireAdmin, async (req, res) => {
  try {
    const [
      [{ count: linksCount }],
      [{ count: songsCount }],
      [{ count: feedbackCount }],
      [{ count: conversationsCount }],
      [{ count: messagesCount }],
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(linksTable),
      db.select({ count: sql<number>`count(*)::int` }).from(songsTable),
      db.select({ count: sql<number>`count(*)::int` }).from(feedbackTable),
      db.select({ count: sql<number>`count(*)::int` }).from(conversations),
      db.select({ count: sql<number>`count(*)::int` }).from(messages),
    ]);

    res.json({
      links: linksCount,
      songs: songsCount,
      feedback: feedbackCount,
      conversations: conversationsCount,
      messages: messagesCount,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;

// Track visitor
router.post("/visitors", async (req, res) => {
  const { page } = req.body as { page?: string };
  try {
    await db.execute(
      `INSERT INTO visitors (page) VALUES ('${page ?? "/"}')`
    );
    const result = await db.execute(`SELECT COUNT(*) as count FROM visitors`);
    return res.json({ count: (result.rows[0] as any).count });
  } catch (err) {
    return res.status(500).json({ error: "Failed to track visitor" });
  }
});

// Get visitor count
router.get("/visitors", async (req, res) => {
  try {
    const result = await db.execute(`SELECT COUNT(*) as count FROM visitors`);
    return res.json({ count: (result.rows[0] as any).count });
  } catch (err) {
    return res.status(500).json({ error: "Failed to get visitor count" });
  }
});
