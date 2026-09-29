import { Router } from "express";
import { getAuth } from "@clerk/express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  notifications,
  notificationPreferences,
  pushSubscriptions,
} from "@workspace/db";
import webpush from "web-push";

const router = Router();

const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "";
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";

if (VAPID_SUBJECT && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
  );
}

export async function sendPushToUser(
  userId: string,
  payload: {
    title: string;
    message?: string;
    link?: string;
    icon?: string;
    badge?: string;
  },
): Promise<void> {
  if (!VAPID_SUBJECT || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn("Web Push disabled: VAPID environment variables are missing");
    return;
  }

  const subscriptions = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          JSON.stringify(payload),
        );
      } catch (error: any) {
        const statusCode = error?.statusCode;

        if (statusCode === 404 || statusCode === 410) {
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.id, subscription.id));
        } else {
          console.error("Web Push send error:", error);
        }
      }
    }),
  );
}


function requireAuth(req: any, res: any): string | null {
  const userId = getAuth(req)?.userId;

  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }

  return userId;
}

// Simpan subscription browser/device.
router.post("/notifications/push/subscribe", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const subscription = req.body?.subscription;

  const endpoint = String(subscription?.endpoint || "").trim();
  const p256dh = String(subscription?.keys?.p256dh || "").trim();
  const auth = String(subscription?.keys?.auth || "").trim();

  if (!endpoint || !p256dh || !auth) {
    res.status(400).json({ error: "Invalid push subscription" });
    return;
  }

  try {
    const [result] = await db
      .insert(pushSubscriptions)
      .values({
        userId,
        endpoint,
        p256dh,
        auth,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          userId,
          p256dh,
          auth,
        },
      })
      .returning();

    res.json({ success: true, subscription: result });
  } catch (error) {
    console.error("Push subscription save error:", error);
    res.status(500).json({ error: "Failed to save push subscription" });
  }
});

// Hapus subscription browser/device.
router.delete("/notifications/push/subscribe", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const endpoint = String(req.body?.endpoint || "").trim();

  if (!endpoint) {
    res.status(400).json({ error: "Endpoint is required" });
    return;
  }

  try {
    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, userId),
          eq(pushSubscriptions.endpoint, endpoint),
        ),
      );

    res.json({ success: true });
  } catch (error) {
    console.error("Push subscription delete error:", error);
    res.status(500).json({ error: "Failed to delete push subscription" });
  }
});

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

export type NotificationType =
  | "chat"
  | "products"
  | "free"
  | "updates"
  | "orders"
  | "wallet"
  | "system";

export async function createNotification(input: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  icon?: string;
  badge?: string;
}) {
  const [notification] = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link ?? null,
    })
    .returning();

  const [preferences] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, input.userId))
    .limit(1);

  const pushEnabled = preferences?.[input.type] ?? true;

  if (pushEnabled) {
    await sendPushToUser(input.userId, {
      title: input.title,
      message: input.message,
      link: input.link,
      icon: input.icon,
      badge: input.badge,
    });
  }

  return notification;
}


router.post("/admin/notifications/test-push", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const adminUserId = process.env.ADMIN_USER_ID;

  if (!adminUserId || userId !== adminUserId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  try {
    await sendPushToUser(adminUserId, {
      title: "ZHUU Push Test 🚀",
      message: "Web Push berhasil masuk ke perangkat kamu.",
      link: "/notifications",
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Test push error:", error);
    res.status(500).json({ error: "Failed to send test push" });
  }
});

export async function broadcastNotification(input: {
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  icon?: string;
  badge?: string;
  excludeUserId?: string;
}) {
  const subscriptions = await db
    .select({ userId: pushSubscriptions.userId })
    .from(pushSubscriptions);

  const recipientIds = [
    ...new Set(
      subscriptions
        .map((item) => item.userId)
        .filter((userId) => userId !== input.excludeUserId),
    ),
  ];

  await Promise.all(
    recipientIds.map((userId) =>
      createNotification({
        userId,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link,
        icon: input.icon,
        badge: input.badge,
      }).catch((error) => {
        console.error(
          `Broadcast notification failed for ${userId}:`,
          error,
        );
      }),
    ),
  );
}

export default router;
