import { Router } from "express";
import { randomUUID } from "node:crypto";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

const AI_REWARD = 5;
const TOOLS_REWARD = 10;
const MAX_AD_REWARDS_PER_DAY = 3;

// Move2link has no server-to-server postback like LootLabs does, so we
// verify completion the standard way for simple shortlink services: the
// destination URL IS our own redeem endpoint with a one-time token baked
// in. Only someone who actually finished the ad steps on Move2link ends up
// visiting it.
const API_PUBLIC_URL =
  process.env.API_PUBLIC_URL || "https://zhuuapi.vercel.app";
const FRONTEND_URL =
  process.env.FRONTEND_URL || "https://zhuusite.my.id";

function getJakartaDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function ensureMove2LinkTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS move2link_ad_claims (
      id SERIAL PRIMARY KEY,
      claim_id TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      reward_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMP
    )
  `);
}

async function requireAuth(req: any, res: any) {
  const userId = getAuth(req)?.userId;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  return userId;
}

/**
 * Create a Move2link reward link.
 */
router.post("/ads/move2link", async (req: any, res: any) => {
  try {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    await ensureMove2LinkTables();

    const rewardType = req.body?.type;

    if (rewardType !== "ai" && rewardType !== "tools") {
      return res.status(400).json({
        error: "Reward type tidak valid",
      });
    }

    const token = process.env.MOVE2LINK_API_TOKEN;

    if (!token) {
      console.error("MOVE2LINK_API_TOKEN belum diset");

      return res.status(500).json({
        error: "Move2Link API belum dikonfigurasi",
      });
    }

    const claimId = randomUUID();

    await db.execute(sql`
      INSERT INTO move2link_ad_claims
        (claim_id, user_id, reward_type)
      VALUES
        (${claimId}, ${userId}, ${rewardType})
    `);

    const destinationUrl =
      `${API_PUBLIC_URL}/api/move2link/redeem?token=${encodeURIComponent(claimId)}`;

    const response = await fetch(
      "https://api.move2link.com/api/v1/links",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          url: destinationUrl,
        }),
      },
    );

    const data: any = await response.json().catch(() => null);

    if (!response.ok) {
      console.error("Move2Link API error:", response.status, data);

      await db.execute(sql`
        DELETE FROM move2link_ad_claims
        WHERE claim_id = ${claimId}
      `);

      return res.status(response.status).json({
        error: "Gagal membuat link Move2Link",
        details: data,
      });
    }

    const shortLink = data?.data?.short_link ?? null;

    if (!shortLink) {
      await db.execute(sql`
        DELETE FROM move2link_ad_claims
        WHERE claim_id = ${claimId}
      `);

      return res.status(500).json({
        error: "Move2Link tidak mengembalikan link",
      });
    }

    return res.status(201).json({
      shortLink,
      claimId,
    });
  } catch (err) {
    console.error("POST /ads/move2link error:", err);

    return res.status(500).json({
      error: "Gagal menghubungi Move2Link",
    });
  }
});

/**
 * Move2link redeem — the destination the shortlink actually points to.
 * Visiting this page (i.e. finishing the ad on Move2link) is what proves
 * completion and credits the reward, then bounces back into the app.
 */
router.get("/move2link/redeem", async (req: any, res: any) => {
  try {
    await ensureMove2LinkTables();

    const claimId =
      typeof req.query?.token === "string" ? req.query.token : "";

    if (!claimId) {
      return res.redirect(`${FRONTEND_URL}/tools?bonus=invalid`);
    }

    const claimResult = await db.execute(sql`
      UPDATE move2link_ad_claims
      SET status = 'COMPLETED', completed_at = NOW()
      WHERE claim_id = ${claimId}
        AND status = 'PENDING'
      RETURNING claim_id, user_id, reward_type
    `);

    const claim = claimResult.rows[0] as
      | { claim_id: string; user_id: string; reward_type: string }
      | undefined;

    if (!claim) {
      // Either an unknown token, or already redeemed once before.
      return res.redirect(`${FRONTEND_URL}/tools?bonus=already`);
    }

    const date = getJakartaDate();

    await db.execute(sql`
      INSERT INTO user_daily_limits (user_id, date)
      VALUES (${claim.user_id}, ${date})
      ON CONFLICT (user_id, date) DO NOTHING
    `);

    const rewardAmount =
      claim.reward_type === "ai" ? AI_REWARD : TOOLS_REWARD;

    const bonusColumn =
      claim.reward_type === "ai" ? "ai_bonus" : "tools_bonus";

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

    const page = claim.reward_type === "ai" ? "ai" : "tools";

    if (rewardResult.rows.length === 0) {
      // Ad genuinely completed, but today's reward cap is already hit.
      return res.redirect(`${FRONTEND_URL}/${page}?bonus=capped`);
    }

    return res.redirect(`${FRONTEND_URL}/${page}?bonus=claimed`);
  } catch (err) {
    console.error("GET /move2link/redeem error:", err);
    return res.redirect(`${FRONTEND_URL}/tools?bonus=error`);
  }
});

export default router;
