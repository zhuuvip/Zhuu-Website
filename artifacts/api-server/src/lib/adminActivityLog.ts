import type { Request } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { adminActivityLogsTable } from "@workspace/db/schema";
import { desc } from "drizzle-orm";

export function getAdminEmail(req: Request): string | null {
  const auth = getAuth(req);
  return (auth?.sessionClaims?.email as string | undefined) ?? null;
}

export async function logAdminActivity(params: {
  action: string;
  description: string;
  adminEmail?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  try {
    await db.insert(adminActivityLogsTable).values({
      action: params.action,
      description: params.description,
      adminEmail: params.adminEmail ?? null,
      metadata: params.metadata ?? null,
    });
  } catch (error) {
    console.error("Admin activity log error:", error);
  }
}

export async function getAdminActivityLogs(limit = 100) {
  return db
    .select()
    .from(adminActivityLogsTable)
    .orderBy(desc(adminActivityLogsTable.createdAt))
    .limit(limit);
}
