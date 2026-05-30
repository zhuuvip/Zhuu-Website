import { Router } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";

const router = Router();

const SETTINGS_KEYS = [
  "profileName",
  "profileBio",
  "logoUrl",
  "bannerUrl",
  "themeColor",
  "statusText",
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

export default router;

// Announcements
router.get("/announcements", async (req, res) => {
  try {
    const result = await db.execute(`SELECT * FROM announcements WHERE is_active = true ORDER BY created_at DESC LIMIT 1`);
    return res.json(result.rows[0] || null);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch announcement" });
  }
});

router.post("/announcements", requireAdmin, async (req, res) => {
  const { message, color } = req.body as { message: string; color?: string };
  if (!message?.trim()) return res.status(400).json({ error: "Message required" });
  try {
    await db.execute(`UPDATE announcements SET is_active = false`);
    const result = await db.execute(
      `INSERT INTO announcements (message, color) VALUES ('${message.replace(/'/g, "''")}', '${color || "#00d4ff"}') RETURNING *`
    );
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: "Failed to create announcement" });
  }
});

router.delete("/announcements", requireAdmin, async (req, res) => {
  try {
    await db.execute(`UPDATE announcements SET is_active = false`);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete announcement" });
  }
});
