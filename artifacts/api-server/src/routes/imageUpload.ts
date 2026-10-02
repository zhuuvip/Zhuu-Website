import { Router } from "express";
import { getAuth } from "@clerk/express";
import { put } from "@vercel/blob";
import { requireAdmin } from "../lib/auth.js";

const router = Router();

const ADMIN_FOLDERS = new Set([
  "products",
  "songs",
  "banner",
  "promotions",
]);

const USER_FOLDERS = new Set([
  "free",
]);

router.post("/image-upload", async (req, res, next) => {
  const userId = getAuth(req)?.userId;

  if (!userId) {
    res.status(401).json({ error: "Login diperlukan" });
    return;
  }

  const { filename, contentType, data, folder = "images" } = req.body ?? {};
  const safeFolder = String(folder)
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 30);

  if (!filename || !contentType || !data) {
    res.status(400).json({ error: "File upload tidak lengkap" });
    return;
  }

  if (!ADMIN_FOLDERS.has(safeFolder) && !USER_FOLDERS.has(safeFolder)) {
    res.status(400).json({ error: "Folder upload tidak diizinkan" });
    return;
  }

  if (ADMIN_FOLDERS.has(safeFolder)) {
    return requireAdmin(req, res, next);
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
    res.status(400).json({
      error: "Format gambar harus JPG, PNG, atau WebP",
    });
    return;
  }

  try {
    const buffer = Buffer.from(data, "base64");

    if (buffer.length > 5 * 1024 * 1024) {
      res.status(400).json({
        error: "Ukuran gambar maksimal 5 MB",
      });
      return;
    }

    const safeName = String(filename)
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 100);

    const blob = await put(
      `${safeFolder}/${userId}/${Date.now()}-${safeName}`,
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
    req.log.error(err, "Failed to upload image");
    res.status(500).json({ error: "Gagal upload gambar" });
  }
});

export default router;
