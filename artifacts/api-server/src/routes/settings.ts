import { Router } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdmin } from "../lib/auth.js";

const router = Router();

const SETTINGS_KEYS = [
  "profileName",
  "profileBio",
  "logoUrl",
  "bannerUrl",
  "themeColor",
  "statusText",
  "maintenanceMode",
  "maintenanceReason",
] as const;

type SettingsKey = typeof SETTINGS_KEYS[number];

async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(settingsTable);
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

router.get("/settings", async (req, res) => {
  try {
    const settings = await getAllSettings();
    return res.json(settings);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to fetch settings" });
  }
});

router.put("/settings", requireAdmin, async (req, res) => {
  const body = req.body as Record<string, unknown>;
  try {
    for (const key of SETTINGS_KEYS) {
      const val = body[key];
      if (val === undefined) continue;
      const value = String(val);
      await db
        .insert(settingsTable)
        .values({ key, value })
        .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });
    }
    const settings = await getAllSettings();
    return res.json(settings);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to update settings" });
  }
});

// Announcements
// Tabel `announcements` tidak ada di lib/db/src/schema (hanya di drizzle/schema.ts hasil introspeksi),
// jadi `drizzle-kit push` di database baru tidak membuatnya. Pastikan tabelnya ada.
let announcementsReady: Promise<void> | null = null;

function ensureAnnouncementsTable(): Promise<void> {
  if (!announcementsReady) {
    announcementsReady = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS announcements (
          id SERIAL PRIMARY KEY,
          message TEXT NOT NULL,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          color TEXT NOT NULL DEFAULT '#00d4ff',
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
      `);
    })().catch((e) => {
      announcementsReady = null;
      throw e;
    });
  }
  return announcementsReady;
}

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

router.get("/announcements", async (req, res) => {
  try {
    await ensureAnnouncementsTable();
    const result = await db.execute(
      sql`SELECT * FROM announcements WHERE is_active = true ORDER BY created_at DESC LIMIT 1`
    );
    return res.json(result.rows[0] || null);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to fetch announcement" });
  }
});

router.post("/announcements", requireAdmin, async (req, res) => {
  const { message, color } = (req.body ?? {}) as { message?: string; color?: string };
  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Message required" });
  }
  const safeColor = typeof color === "string" && HEX_COLOR_RE.test(color) ? color : "#00d4ff";
  try {
    await ensureAnnouncementsTable();
    await db.execute(sql`UPDATE announcements SET is_active = false`);
    const result = await db.execute(
      sql`INSERT INTO announcements (message, color) VALUES (${message.trim()}, ${safeColor}) RETURNING *`
    );
    return res.json(result.rows[0]);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to create announcement" });
  }
});

router.delete("/announcements", requireAdmin, async (req, res) => {
  try {
    await ensureAnnouncementsTable();
    await db.execute(sql`UPDATE announcements SET is_active = false`);
    return res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to delete announcement" });
  }
});

export default router;
