import { db } from "@workspace/db";
import { userDailyLimitsTable, premiumMembersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";

const AI_DAILY_LIMIT = 60;
const TOOLS_DAILY_LIMIT = 25;

function getJakartaDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function ensureDailyLimitTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS user_daily_limits (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      date DATE NOT NULL,
      ai_used INTEGER NOT NULL DEFAULT 0,
      ai_bonus INTEGER NOT NULL DEFAULT 0,
      tools_used INTEGER NOT NULL DEFAULT 0,
      tools_bonus INTEGER NOT NULL DEFAULT 0,
      ad_rewards INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      CONSTRAINT user_daily_limits_user_date_unique UNIQUE (user_id, date)
    )
  `);
}

// Premium membership is permanent (doesn't reset daily) — its bonus stacks
// on top of whatever the user earned today from ads.
async function getPremiumBonus(userId: string): Promise<{ ai: number; tools: number }> {
  const [row] = await db
    .select({ aiBonus: premiumMembersTable.aiBonus, toolsBonus: premiumMembersTable.toolsBonus })
    .from(premiumMembersTable)
    .where(eq(premiumMembersTable.userId, userId))
    .limit(1);
  return { ai: row?.aiBonus ?? 0, tools: row?.toolsBonus ?? 0 };
}

export async function getDailyLimit(userId: string) {
  await ensureDailyLimitTables();

  const date = getJakartaDate();

  await db
    .insert(userDailyLimitsTable)
    .values({ userId, date })
    .onConflictDoNothing();

  const [row] = await db
    .select()
    .from(userDailyLimitsTable)
    .where(
      and(
        eq(userDailyLimitsTable.userId, userId),
        eq(userDailyLimitsTable.date, date),
      ),
    )
    .limit(1);

  if (!row) throw new Error("Gagal mengambil limit harian");

  const premium = await getPremiumBonus(userId);

  return {
    date,
    ai: {
      used: row.aiUsed,
      bonus: row.aiBonus + premium.ai,
      limit: AI_DAILY_LIMIT + row.aiBonus + premium.ai,
      remaining: Math.max(0, AI_DAILY_LIMIT + row.aiBonus + premium.ai - row.aiUsed),
    },
    tools: {
      used: row.toolsUsed,
      bonus: row.toolsBonus + premium.tools,
      limit: TOOLS_DAILY_LIMIT + row.toolsBonus + premium.tools,
      remaining: Math.max(0, TOOLS_DAILY_LIMIT + row.toolsBonus + premium.tools - row.toolsUsed),
    },
    adRewards: row.adRewards,
  };
}

export async function consumeDailyLimit(
  userId: string,
  type: "ai" | "tools",
) {
  await ensureDailyLimitTables();

  const date = getJakartaDate();

  await db
    .insert(userDailyLimitsTable)
    .values({ userId, date })
    .onConflictDoNothing();

  const column = type === "ai"
    ? userDailyLimitsTable.aiUsed
    : userDailyLimitsTable.toolsUsed;

  const bonusColumn = type === "ai"
    ? userDailyLimitsTable.aiBonus
    : userDailyLimitsTable.toolsBonus;

  const baseLimit = type === "ai" ? AI_DAILY_LIMIT : TOOLS_DAILY_LIMIT;
  const premium = await getPremiumBonus(userId);
  const premiumBonus = type === "ai" ? premium.ai : premium.tools;

  const result = await db
    .update(userDailyLimitsTable)
    .set({
      ...(type === "ai"
        ? { aiUsed: sql`${column} + 1` }
        : { toolsUsed: sql`${column} + 1` }),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(userDailyLimitsTable.userId, userId),
        eq(userDailyLimitsTable.date, date),
        sql`${column} < ${baseLimit} + ${bonusColumn} + ${premiumBonus}`,
      ),
    )
    .returning();

  if (result.length === 0) {
    return {
      allowed: false,
      ...(await getDailyLimit(userId))[type],
    };
  }

  const current = await getDailyLimit(userId);

  return {
    allowed: true,
    ...current[type],
  };
}
