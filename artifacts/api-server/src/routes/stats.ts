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
