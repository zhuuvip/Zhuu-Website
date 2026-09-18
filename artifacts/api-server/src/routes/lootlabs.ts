import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

const LOOTLABS_API_URL =
  "https://creators.lootlabs.gg/api/public/content_locker";

const AI_REWARD = 5;
const TOOLS_REWARD = 10;
const MAX_AD_REWARDS_PER_DAY = 3;

function getJakartaDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function ensureLootLabsTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS lootlabs_ad_claims (
      id SERIAL PRIMARY KEY,
      claim_id TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      reward_type TEXT NOT NULL,
      unique_id TEXT UNIQUE,
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMP
    )
  `);
}

async function requireAuth(req: any, res: any) {
  const userId = req.auth?.userId;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  return userId;
}

/**
 * Create a LootLabs reward link.
 */
router.post("/ads/lootlabs", async (req: any, res: any) => {
  try {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    await ensureLootLabsTables();

    const rewardType = req.body?.type;

    if (rewardType !== "ai" && rewardType !== "tools") {
      return res.status(400).json({
        error: "Reward type tidak valid",
      });
    }

    const apiToken = process.env.LOOTLABS_API_KEY;

    if (!apiToken) {
      console.error("LOOTLABS_API_KEY belum diset");

      return res.status(500).json({
        error: "LootLabs API belum dikonfigurasi",
      });
    }

    const claimId = randomUUID();

    await db.execute(sql`
      INSERT INTO lootlabs_ad_claims
        (claim_id, user_id, reward_type)
      VALUES
        (${claimId}, ${userId}, ${rewardType})
    `);

    const destinationUrl =
      rewardType === "ai"
        ? "https://zhuusite.my.id/ai"
        : "https://zhuusite.my.id/tools";

    const response = await fetch(LOOTLABS_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        title: "Zhuu Daily Limit",
        url: destinationUrl,
        tier_id: 3,
        number_of_tasks: 1,
        theme: 3,
      }),
    });

    const data: any = await response.json().catch(() => null);

    if (!response.ok || data?.type === "error") {
      console.error("LootLabs API error:", response.status, data);

      await db.execute(sql`
        DELETE FROM lootlabs_ad_claims
        WHERE claim_id = ${claimId}
      `);

      return res.status(response.status || 500).json({
        error: "Gagal membuat link LootLabs",
        details: data?.message ?? data,
      });
    }

    const lootUrl = data?.message?.loot_url;

    if (!lootUrl) {
      await db.execute(sql`
        DELETE FROM lootlabs_ad_claims
        WHERE claim_id = ${claimId}
      `);

      return res.status(500).json({
        error: "LootLabs tidak mengembalikan link",
      });
    }

    const separator = lootUrl.includes("?") ? "&" : "?";

    const rewardUrl =
      `${lootUrl}${separator}puid=${encodeURIComponent(claimId)}`;

    return res.status(201).json({
      shortLink: rewardUrl,
      claimId,
    });
  } catch (err) {
    console.error("POST /ads/lootlabs error:", err);

    return res.status(500).json({
      error: "Gagal membuat link LootLabs",
    });
  }
});

/**
 * LootLabs postback.
 */
router.get("/lootlabs/postback", async (req: any, res: any) => {
  try {
    await ensureLootLabsTables();

    const clickId =
      typeof req.query?.click_id === "string"
        ? req.query.click_id
        : "";

    const uniqueId =
      typeof req.query?.unique_id === "string"
        ? req.query.unique_id
        : "";

    if (!clickId || !uniqueId) {
      return res.status(400).json({
        error: "click_id dan unique_id wajib diisi",
      });
    }

    /*
     * Claim the completion atomically.
     *
     * This prevents the same claim from being rewarded twice,
     * including concurrent duplicate postbacks.
     */
    const claimResult = await db.execute(sql`
      UPDATE lootlabs_ad_claims
      SET
        unique_id = ${uniqueId},
        status = 'COMPLETED',
        completed_at = NOW()
      WHERE claim_id = ${clickId}
        AND status = 'PENDING'
        AND unique_id IS NULL
      RETURNING claim_id, user_id, reward_type
    `);

    const claim = claimResult.rows[0] as
      | {
          claim_id: string;
          user_id: string;
          reward_type: string;
        }
      | undefined;

    if (!claim) {
      const existing = await db.execute(sql`
        SELECT status
        FROM lootlabs_ad_claims
        WHERE claim_id = ${clickId}
        LIMIT 1
      `);

      if (existing.rows.length === 0) {
        return res.status(404).json({
          error: "Claim tidak ditemukan",
        });
      }

      return res.json({
        ok: true,
        alreadyProcessed: true,
      });
    }

    const date = getJakartaDate();

    await db.execute(sql`
      INSERT INTO user_daily_limits (user_id, date)
      VALUES (${claim.user_id}, ${date})
      ON CONFLICT (user_id, date) DO NOTHING
    `);

    const rewardAmount =
      claim.reward_type === "ai"
        ? AI_REWARD
        : TOOLS_REWARD;

    const bonusColumn =
      claim.reward_type === "ai"
        ? "ai_bonus"
        : "tools_bonus";

    const rewardResult = await db.execute(sql`
      UPDATE user_daily_limits
      SET
        ${sql.raw(bonusColumn)} = ${sql.raw(bonusColumn)} + ${rewardAmount},
        ad_rewards = ad_rewards + 1,
        updated_at = NOW()
      WHERE user_id = ${claim.user_id}
        AND date = ${date}
        AND ad_rewards < ${MAX_AD_REWARDS_PER_DAY}
      RETURNING ad_rewards
    `);

    if (rewardResult.rows.length === 0) {
      /*
       * The claim is already marked completed, but the daily
       * reward limit has been reached. Do not give another reward.
       */
      return res.status(429).json({
        error: "Batas reward iklan hari ini sudah tercapai",
      });
    }

    return res.json({
      ok: true,
      rewarded: true,
      reward: {
        type: claim.reward_type,
        amount: rewardAmount,
      },
    });
  } catch (err) {
    console.error("GET /lootlabs/postback error:", err);

    return res.status(500).json({
      error: "Gagal memproses LootLabs postback",
    });
  }
});

export default router;
