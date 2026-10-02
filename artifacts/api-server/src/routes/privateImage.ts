import { Router } from "express";
import { get } from "@vercel/blob";

const router = Router();

const ALLOWED_FOLDERS = new Set([
  "products",
  "songs",
  "banner",
  "promotions",
  "free",
]);

router.get("/private-image", async (req, res) => {
  const pathname = String(req.query.pathname || "").trim();

  if (!pathname) {
    res.status(400).json({ error: "Path gambar tidak valid" });
    return;
  }

  const parts = pathname.split("/");
  const folder = parts[0];

  if (!ALLOWED_FOLDERS.has(folder) || parts.length < 3) {
    res.status(400).json({ error: "Path gambar tidak valid" });
    return;
  }

  try {
    const blob = await get(pathname, { access: "private" });

    if (!blob) {
      res.status(404).json({ error: "Gambar tidak ditemukan" });
      return;
    }

    res.setHeader(
      "Content-Type",
      blob.blob.contentType || "application/octet-stream",
    );
    res.setHeader("Cache-Control", "public, max-age=300");

    if (!blob.stream) {
      res.status(500).json({ error: "Stream gambar tidak tersedia" });
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
    req.log.error(err, "Failed to read private image");
    res.status(500).json({ error: "Gagal mengambil gambar" });
  }
});

export default router;
