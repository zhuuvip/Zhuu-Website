import type { Request } from "express";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "zhuusite@gmail.com";
const ADMIN_USER_ID = process.env.ADMIN_USER_ID;

export function isAdmin(req: Request): boolean {
  const auth = (req as any).auth;
  if (!auth) return false;
  const userId: string | undefined = auth.userId;
  const email: string | undefined = auth.sessionClaims?.email;
  console.log("DEBUG auth:", { userId, email, ADMIN_USER_ID, ADMIN_EMAIL });
  if (ADMIN_USER_ID && userId === ADMIN_USER_ID) return true;
  if (email && email === ADMIN_EMAIL) return true;
  return false;
}

export function requireAdmin(req: Request, res: any, next: any): void {
  if (!isAdmin(req)) {
    res.status(403).json({ error: "Forbidden: admin access required" });
    return;
  }
  next();
}
