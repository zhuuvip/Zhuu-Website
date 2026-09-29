import type { Request } from "express";
import { getAuth } from "@clerk/express";


const ADMIN_USER_ID = process.env.ADMIN_USER_ID;

export function isAdmin(req: Request): boolean {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!ADMIN_USER_ID) return false;
  return userId === ADMIN_USER_ID;
}

export function requireAdmin(req: Request, res: any, next: any): void {
  if (!isAdmin(req)) {
    res.status(403).json({ error: "Forbidden: admin access required" });
    return;
  }
  next();
}
