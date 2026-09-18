import {
  pgTable,
  serial,
  text,
  integer,
  date,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const userDailyLimitsTable = pgTable(
  "user_daily_limits",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    date: date("date").notNull(),
    aiUsed: integer("ai_used").notNull().default(0),
    aiBonus: integer("ai_bonus").notNull().default(0),
    toolsUsed: integer("tools_used").notNull().default(0),
    toolsBonus: integer("tools_bonus").notNull().default(0),
    adRewards: integer("ad_rewards").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userDateUnique: unique("user_daily_limits_user_date_unique").on(
      table.userId,
      table.date,
    ),
  }),
);
