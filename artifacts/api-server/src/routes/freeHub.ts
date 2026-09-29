import { Router } from "express";
import { getAuth } from "@clerk/express";
import { desc, eq } from "drizzle-orm";
import { db, freePosts } from "@workspace/db";
import { isAdmin } from "../lib/auth.js";

const router = Router();

const MODERATION_PATTERN =
  /\b(jual|dijual|jualan|checkout|berbayar|harga|reseller|porn|porno|bokep|hentai|nsfw|nude|naked|sex|seksual|pembunuhan|membunuh|murder|torture|penyiksaan|ancaman|scam|penipuan|phishing|malware|keylogger|stealer|carding|ransomware)\b/i;

function moderateFreePost(
  title: string,
  description: string | null,
  link: string | null,
): boolean {
  const content = [title, description ?? "", link ?? ""].join(" ");
  return MODERATION_PATTERN.test(content);
}


function requireAuth(req: any, res: any): string | null {
  const userId = getAuth(req)?.userId;

  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }

  return userId;
}

// Semua posting aktif, pinned selalu di atas.
router.get("/free/posts", async (_req, res): Promise<void> => {
  try {
    const posts = await db
      .select()
      .from(freePosts)
      .where(eq(freePosts.active, true))
      .orderBy(desc(freePosts.pinned), desc(freePosts.createdAt));

    res.json({ posts });
  } catch (error) {
    console.error("Free Hub fetch error:", error);
    res.status(500).json({ error: "Failed to fetch free posts" });
  }
});

// Detail posting.
router.get("/free/posts/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid post ID" });
    return;
  }

  try {
    const [post] = await db
      .select()
      .from(freePosts)
      .where(eq(freePosts.id, id))
      .limit(1);

    if (!post || !post.active) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    res.json({ post });
  } catch (error) {
    console.error("Free Hub detail error:", error);
    res.status(500).json({ error: "Failed to fetch post" });
  }
});

// Buat posting baru.
router.post("/free/posts", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const title =
    typeof req.body?.title === "string" ? req.body.title.trim() : "";

  const description =
    typeof req.body?.description === "string"
      ? req.body.description.trim()
      : null;

  const category =
    typeof req.body?.category === "string"
      ? req.body.category.trim().toUpperCase()
      : "FREE";

  const link =
    typeof req.body?.link === "string" ? req.body.link.trim() : null;

  const imageUrl =
    typeof req.body?.imageUrl === "string"
      ? req.body.imageUrl.trim()
      : null;

  const allowedCategories = [
    "FREE_PRODUCT",
    "FREE_SOURCE",
    "FREE_KEY",
    "FREE_PROMO_CODE",
    "GIVEAWAY",
  ];

  if (!title) {
    res.status(400).json({ error: "Title is required" });
    return;
  }

  if (title.length > 150) {
    res.status(400).json({ error: "Title is too long" });
    return;
  }

  if (description && description.length > 2000) {
    res.status(400).json({ error: "Description is too long" });
    return;
  }

  if (!allowedCategories.includes(category)) {
    res.status(400).json({ error: "Invalid category" });
    return;
  }

    if (moderateFreePost(title, description, link)) {
      res.status(400).json({
        error: "Posting ditolak. Free Hub hanya untuk konten gratis, aman, dan bukan promosi berbayar.",
        moderation: true,
      });
      return;
    }

  try {
    const [post] = await db
      .insert(freePosts)
      .values({
        userId,
        title,
        description,
        category,
        link,
        imageUrl,
      })
      .returning();

    res.status(201).json({ post });
  } catch (error) {
    console.error("Free Hub create error:", error);
    res.status(500).json({ error: "Failed to create free post" });
  }
});

// Pin/unpin hanya admin.
router.patch("/free/posts/:id/pin", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  if (!isAdmin(req)) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid post ID" });
    return;
  }

  const pinned = req.body?.pinned === true;

  try {
    const [post] = await db
      .update(freePosts)
      .set({ pinned })
      .where(eq(freePosts.id, id))
      .returning();

    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    res.json({ post });
  } catch (error) {
    console.error("Free Hub pin error:", error);
    res.status(500).json({ error: "Failed to update pin" });
  }
});

// Hapus posting sendiri atau admin.
router.delete("/free/posts/:id", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid post ID" });
    return;
  }

  try {
    const [post] = await db
      .select()
      .from(freePosts)
      .where(eq(freePosts.id, id))
      .limit(1);

    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    if (post.userId !== userId && !isAdmin(req)) {
      res.status(403).json({ error: "You cannot delete this post" });
      return;
    }

    await db.delete(freePosts).where(eq(freePosts.id, id));

    res.json({ success: true });
  } catch (error) {
    console.error("Free Hub delete error:", error);
    res.status(500).json({ error: "Failed to delete post" });
  }
});

export default router;
