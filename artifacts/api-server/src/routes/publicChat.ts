import { Router } from "express";
import { getAuth } from "@clerk/express";
import { createClerkClient } from "@clerk/backend";
import { desc } from "drizzle-orm";
import { db, publicChatMessages } from "@workspace/db";

const router = Router();

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10_000;
const messageRateLimit = new Map<string, number[]>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (messageRateLimit.get(userId) || []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
  );

  if (recent.length >= RATE_LIMIT_MAX) {
    messageRateLimit.set(userId, recent);
    return true;
  }

  recent.push(now);
  messageRateLimit.set(userId, recent);

  return false;
}

function requireAuth(req: any, res: any): string | null {
  const userId = getAuth(req)?.userId;

  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }

  return userId;
}

async function enrichMessages(messages: typeof publicChatMessages.$inferSelect[]) {
  const secretKey = process.env.CLERK_SECRET_KEY;

  if (!secretKey) {
    throw new Error("CLERK_SECRET_KEY belum dikonfigurasi di server");
  }

  const clerk = createClerkClient({ secretKey });

  const uniqueUserIds = [...new Set(messages.map((item) => item.userId))];

  const users = await Promise.all(
    uniqueUserIds.map(async (userId) => {
      try {
        const user = await clerk.users.getUser(userId);

        return [
          userId,
          {
            username:
              user.username ||
              user.firstName ||
              "User",
            imageUrl: user.imageUrl || "",
          },
        ] as const;
      } catch (error) {
        console.error(`Failed to fetch Clerk user ${userId}:`, error);

        return [
          userId,
          {
            username: "User",
            imageUrl: "",
          },
        ] as const;
      }
    }),
  );

  const userMap = new Map(users);

  return messages.map((message) => {
    const profile = userMap.get(message.userId);

    return {
      ...message,
      username: profile?.username || "User",
      imageUrl: profile?.imageUrl || "",
    };
  });
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

    const enrichedMessages = await enrichMessages(messages.reverse());

    res.json({
      messages: enrichedMessages,
    });
  } catch (error) {
    console.error("Public chat fetch error:", error);
    res.status(500).json({
      error: "Failed to fetch public chat messages",
    });
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

  if (isRateLimited(userId)) {
    res.status(429).json({
      error: "Terlalu banyak pesan. Tunggu beberapa detik.",
    });
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

    const [enrichedMessage] = await enrichMessages([created]);

    res.status(201).json({
      message: enrichedMessage,
    });
  } catch (error) {
    console.error("Public chat send error:", error);
    res.status(500).json({
      error: "Failed to send message",
    });
  }
});

export default router;
