import { Router } from "express";
import { getAuth } from "@clerk/express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  notifications,
  notificationPreferences,
} from "@workspace/db";

const router = Router();

function requireAuth(req: any, res: any): string | null {
  const userId = getAuth(req)?.userId;

  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }

  return userId;
}

// Ambil notifikasi user.
router.get("/notifications", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  try {
    const items = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(100);

    res.json({ notifications: items });
  } catch (error) {
    console.error("Notifications fetch error:", error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// Tandai satu sudah dibaca.
router.patch("/notifications/:id/read", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid notification ID" });
    return;
  }

  try {
    const [item] = await db
      .update(notifications)
      .set({ read: true })
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.userId, userId),
        ),
      )
      .returning();

    if (!item) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }

    res.json({ notification: item });
  } catch (error) {
    console.error("Notification read error:", error);
    res.status(500).json({ error: "Failed to update notification" });
  }
});

// Tandai semua sudah dibaca.
router.post("/notifications/read-all", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  try {
    await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.userId, userId));

    res.json({ success: true });
  } catch (error) {
    console.error("Notifications read-all error:", error);
    res.status(500).json({ error: "Failed to update notifications" });
  }
});

// Ambil preferensi.
router.get("/notifications/preferences", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  try {
    const [preferences] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    if (preferences) {
      res.json({ preferences });
      return;
    }

    const [created] = await db
      .insert(notificationPreferences)
      .values({ userId })
      .returning();

    res.json({ preferences: created });
  } catch (error) {
    console.error("Notification preferences fetch error:", error);
    res.status(500).json({ error: "Failed to fetch preferences" });
  }
});

// Update preferensi.
router.patch("/notifications/preferences", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const allowed = [
    "chat",
    "products",
    "free",
    "updates",
    "orders",
    "wallet",
    "system",
  ] as const;

  const values: Partial<Record<(typeof allowed)[number], boolean>> = {};

  for (const key of allowed) {
    if (typeof req.body?.[key] === "boolean") {
      values[key] = req.body[key];
    }
  }

  try {
    const [existing] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    const [result] = existing
      ? await db
          .update(notificationPreferences)
          .set({
            ...values,
            updatedAt: new Date(),
          })
          .where(eq(notificationPreferences.userId, userId))
          .returning()
      : await db
          .insert(notificationPreferences)
          .values({
            userId,
            ...values,
          })
          .returning();

    res.json({ preferences: result });
  } catch (error) {
    console.error("Notification preferences update error:", error);
    res.status(500).json({ error: "Failed to update preferences" });
  }
});

export default router;
