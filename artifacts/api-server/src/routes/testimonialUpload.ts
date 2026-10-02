import { Router } from "express";
import { getAuth } from "@clerk/express";
import { get, put } from "@vercel/blob";
import { eq, or } from "drizzle-orm";
import { db, testimonialsTable } from "@workspace/db";

const router = Router();

router.post("/testimonial-upload", async (req, res) => {
  const userId = getAuth(req)?.userId;

  if (!userId) {
    res.status(401).json({ error: "Login diperlukan" });
    return;
  }

  const { filename, contentType, data } = req.body ?? {};

  if (!filename || !contentType || !data) {
    res.status(400).json({ error: "File upload tidak lengkap" });
    return;
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
    res.status(400).json({ error: "Format foto harus JPG, PNG, atau WebP" });
    return;
  }

  try {
    const buffer = Buffer.from(data, "base64");

    if (buffer.length > 5 * 1024 * 1024) {
      res.status(400).json({ error: "Ukuran foto maksimal 5 MB" });
      return;
    }

    const safeName = String(filename)
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 100);

    const blob = await put(
      `testimonials/${userId}/${Date.now()}-${safeName}`,
      buffer,
      {
        access: "private",
        contentType,
        addRandomSuffix: false,
      },
    );

    res.status(201).json({
      url: blob.url,
      pathname: blob.pathname,
    });
  } catch (err) {
    req.log.error(err, "Failed to upload testimonial image");
    res.status(500).json({ error: "Gagal upload foto" });
  }
});

router.get("/testimonial-image", async (req, res) => {
  const pathname = String(req.query.pathname || "").trim();

  if (!pathname || !pathname.startsWith("testimonials/")) {
    res.status(400).json({ error: "Path foto tidak valid" });
    return;
  }

  try {
    const testimonial = await db
      .select({
        id: testimonialsTable.id,
        imageUrl: testimonialsTable.imageUrl,
        status: testimonialsTable.status,
      })
      .from(testimonialsTable)
      .where(
        or(
          eq(testimonialsTable.imageUrl, pathname),
          eq(
            testimonialsTable.imageUrl,
            `https://blob.vercel-storage.com/${pathname}`,
          ),
        ),
      )
      .limit(1);

    if (!testimonial[0] || testimonial[0].status !== "PUBLISHED") {
      res.status(404).json({ error: "Foto tidak ditemukan" });
      return;
    }

    const blob = await get(pathname, {
      access: "private",
    });

    if (!blob) {
      res.status(404).json({ error: "Foto tidak ditemukan" });
      return;
    }

    res.setHeader(
      "Content-Type",
      blob.blob.contentType || "application/octet-stream",
    );
    res.setHeader("Cache-Control", "public, max-age=300");

    if (!blob.stream) {
      res.status(500).json({ error: "Stream foto tidak tersedia" });
      return;
    }

    const reader = blob.stream.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        res.write(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }

    res.end();
  } catch (err) {
    req.log.error(err, "Failed to read testimonial image");
    res.status(500).json({ error: "Gagal mengambil foto" });
  }
});

export default router;
