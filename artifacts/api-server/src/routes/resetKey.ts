import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { resetDripKey, resetFluoriteKey, resetHgKey } from "../lib/dripApi.js";

const router = Router();

const DAILY_MEMBER_LIMIT = 2;

async function ensureResetKeyTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS reseller_members (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      plan TEXT NOT NULL,
      expires_at TIMESTAMPTZ,
      username TEXT UNIQUE,
      password_hash TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS premium_members (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      tier TEXT NOT NULL,
      ai_bonus INTEGER NOT NULL DEFAULT 0,
      tools_bonus INTEGER NOT NULL DEFAULT 0,
      amount_paid INTEGER NOT NULL,
      purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS reset_key_logs (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      api TEXT NOT NULL,
      key TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS reset_key_logs_user_date_idx
    ON reset_key_logs (user_id, created_at)
  `);
}

async function getResetCountToday(userId: string) {
  const result = await db.execute(sql`
    SELECT COUNT(*)::int AS count
    FROM reset_key_logs
    WHERE user_id = ${userId}
      AND created_at >= CURRENT_DATE
      AND created_at < CURRENT_DATE + INTERVAL '1 day'
  `);

  return Number((result.rows as any[])?.[0]?.count ?? 0);
}

async function isReseller(userId: string) {
  const result = await db.execute(sql`
    SELECT active, plan, expires_at
    FROM reseller_members
    WHERE user_id = ${userId}
    LIMIT 1
  `);

  const row = (result.rows as any[])?.[0];
  if (!row || !row.active) return false;

  if (row.plan === "lifetime") return true;

  return Boolean(
    row.expires_at &&
    new Date(row.expires_at).getTime() > Date.now(),
  );
}

async function isPremium(userId: string) {
  const result = await db.execute(sql`
    SELECT id
    FROM premium_members
    WHERE user_id = ${userId}
    LIMIT 1
  `);

  return (result.rows as any[])?.length > 0;
}

router.get("/reset-key/status", async (req, res) => {
  try {
    await ensureResetKeyTable();

    const userId = getAuth(req)?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Login diperlukan" });
    }

    const reseller = await isReseller(userId);
    const premium = await isPremium(userId);

    const unlimited = reseller || premium;

    const usedToday = await getResetCountToday(userId);

    return res.json({
      usedToday,
      dailyLimit: unlimited ? null : DAILY_MEMBER_LIMIT,
      unlimited,
      reseller,
      premium,
    });
  } catch (error) {
    console.error("GET /reset-key/status error:", error);
    return res.status(500).json({
      error: "Gagal mengambil status reset key",
    });
  }
});

router.post("/reset-key", async (req, res) => {
  try {
    await ensureResetKeyTable();

    const userId = getAuth(req)?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Login diperlukan" });
    }

    const api = String(req.body?.api || "").toLowerCase();
    const key = String(req.body?.key || "").trim();

    if (api !== "drip" && api !== "fluorite" && api !== "hg") {
      return res.status(400).json({
        error: "API reset tidak valid",
      });
    }

    if (!key) {
      return res.status(400).json({
        error: "License key wajib diisi",
      });
    }

    const reseller = await isReseller(userId);
    const premium = await isPremium(userId);
    const unlimited = reseller || premium;

    const usedToday = await getResetCountToday(userId);

    if (!unlimited && usedToday >= DAILY_MEMBER_LIMIT) {
      return res.status(429).json({
        error: "Batas reset key hari ini sudah habis",
        usedToday,
        dailyLimit: DAILY_MEMBER_LIMIT,
      });
    }

    let result: any;

    if (api === "drip") {
      result = await resetDripKey(key);
    } else if (api === "fluorite") {
      result = await resetFluoriteKey(key);
    } else {
      result = await resetHgKey(key);
    }

    await db.execute(sql`
      INSERT INTO reset_key_logs (user_id, api, key)
      VALUES (${userId}, ${api}, ${key})
    `);

    return res.json({
      ok: true,
      api,
      result,
      usedToday: unlimited ? usedToday : usedToday + 1,
      dailyLimit: unlimited ? null : DAILY_MEMBER_LIMIT,
      unlimited,
    });
  } catch (error: any) {
    console.error("POST /reset-key error:", error);

    return res.status(502).json({
      error: error?.message || "Reset key gagal",
    });
  }
});

export default router;
