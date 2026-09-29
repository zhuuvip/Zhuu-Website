import { Router } from "express";
import { getAuth } from "@clerk/express";
import { desc } from "drizzle-orm";
import { db, publicChatMessages } from "@workspace/db";

const router = Router();

function requireAuth(req: any, res: any): string | null {
  const userId = getAuth(req)?.userId;

  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }

  return userId;
}

// Ambil pesan public chat terbaru
router.get("/public-chat/messages", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  try {
    const messages = await db
      .select()
      .from(publicChatMessages)
      .orderBy(desc(publicChatMessages.createdAt))
      .limit(100);

    res.json({
      messages: messages.reverse(),
    });
  } catch (error) {
    console.error("Public chat fetch error:", error);
    res.status(500).json({ error: "Failed to fetch public chat messages" });
  }
});

// Kirim pesan
router.post("/public-chat/messages", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const message =
    typeof req.body?.message === "string"
      ? req.body.message.trim()
      : "";

  if (!message) {
    res.status(400).json({ error: "Message is required" });
    return;
  }

  if (message.length > 500) {
    res.status(400).json({ error: "Message is too long" });
    return;
  }

  try {
    const [created] = await db
      .insert(publicChatMessages)
      .values({
        userId,
        message,
      })
      .returning();

    res.status(201).json({
      message: created,
    });
  } catch (error) {
    console.error("Public chat send error:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

export default router;
