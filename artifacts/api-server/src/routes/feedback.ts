import { Router } from "express";
import { db } from "@workspace/db";
import { feedbackTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { isAdmin, requireAdmin } from "../lib/auth";
import { rateLimit } from "../lib/rateLimit";

const router = Router();

const RATINGS = ["😕 Not great", "😐 It's okay", "🙂 Pretty good", "😊 Really like it", "🤩 Love it!"];
const DISCORD_COLORS: Record<string, number> = {
  bug: 0xff6b6b,
  feature: 0x00d4ff,
  design: 0x9b59b6,
  performance: 0xfbbf24,
  content: 0x4ade80,
  other: 0x94a3b8,
};

const feedbackRateLimit = rateLimit({ windowMs: 60_000, max: 5, message: "Too many feedback submissions. Please wait a minute." });

router.post("/feedback", feedbackRateLimit, async (req, res) => {
  const { category, rating, name, email, message } = req.body as {
    category?: string;
    rating?: number;
    name?: string;
    email?: string;
    message: string;
  };

  if (!message?.trim()) {
    res.status(400).json({ error: "Message is required" });
    return;
  }

  try {
    await db.insert(feedbackTable).values({
      category: category ?? null,
      rating: typeof rating === "number" ? rating : null,
      name: name?.trim() || null,
      email: email?.trim() || null,
      message: message.trim(),
    });
  } catch (err) {
    req.log.error(err, "Failed to save feedback to DB");
  }

  const webhookUrl = process.env["DISCORD_WEBHOOK_URL"];
  if (webhookUrl) {
    const ratingText = typeof rating === "number" ? RATINGS[rating] ?? "Not rated" : "Not rated";
    const categoryText = category ?? "Other";
    const fromText = name || email ? `${name || ""}${name && email ? " — " : ""}${email || ""}` : "Anonymous";
    const color = DISCORD_COLORS[categoryText] ?? 0x00d4ff;

    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [{
            title: "🌊 New Feedback — ZhuuVIP",
            color,
            fields: [
              { name: "Category", value: categoryText, inline: true },
              { name: "Rating", value: ratingText, inline: true },
              { name: "From", value: fromText, inline: true },
              { name: "Message", value: message.slice(0, 1024), inline: false },
            ],
            timestamp: new Date().toISOString(),
            footer: { text: "ZhuuVIP Feedback System" },
          }],
        }),
      });
    } catch (err) {
      req.log.warn({ err }, "Failed to send Discord webhook");
    }
  }

  res.json({ ok: true });
});

router.get("/feedback", requireAdmin, async (req, res) => {
  try {
    const rows = await db.select().from(feedbackTable).orderBy(desc(feedbackTable.createdAt)).limit(100);
    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch feedback" });
  }
});

router.delete("/feedback/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!id || isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    await db.delete(feedbackTable).where(eq(feedbackTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete feedback" });
  }
});

export default router;
