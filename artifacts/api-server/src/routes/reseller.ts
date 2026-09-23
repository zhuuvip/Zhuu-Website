import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { productsTable, productOptionsTable, ordersTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import { requireAdmin } from "../lib/auth.js";
import { generateDripKey } from "../lib/dripApi.js";

const router = Router();
const rowsOf = (r: any): any[] => r?.rows ?? r ?? [];
const PLAN_DAYS = 30;

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let tablesReady: Promise<void> | null = null;
function ensureResellerTables(): Promise<void> {
  if (!tablesReady) {
    tablesReady = (async () => {
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
        CREATE TABLE IF NOT EXISTS reseller_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `);
      await db.execute(sql`ALTER TABLE product_options ADD COLUMN IF NOT EXISTS reseller_price INTEGER`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS wallets (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL UNIQUE,
          balance INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS wallet_transactions (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          type TEXT NOT NULL,
          amount INTEGER NOT NULL,
          reference TEXT UNIQUE,
          description TEXT,
          status TEXT NOT NULL DEFAULT 'PENDING',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
    })().catch((e) => {
      tablesReady = null;
      throw e;
    });
  }
  return tablesReady;
}

/* ---------- password & token ---------- */
function hashPassword(pw: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pw, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(pw: string, stored: string) {
  const [salt, hash] = String(stored).split(":");
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(pw, salt, 64);
  const known = Buffer.from(hash, "hex");
  return known.length === test.length && crypto.timingSafeEqual(known, test);
}
function secret() {
  const s = process.env.RESELLER_SECRET;
  if (!s || s.length < 16) throw new Error("RESELLER_SECRET belum diatur");
  return s;
}
function sign(body: string) {
  return crypto.createHmac("sha256", secret()).update(body).digest("base64url");
}
function signToken(userId: string) {
  const body = Buffer.from(
    JSON.stringify({ u: userId, exp: Date.now() + 7 * 24 * 3600 * 1000 }),
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}
function readToken(token: string): string | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(body));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    if (typeof p.u !== "string" || p.exp < Date.now()) return null;
    return p.u;
  } catch {
    return null;
  }
}

/* ---------- util ---------- */
const h =
  (fn: (req: Request, res: Response) => Promise<any>) =>
  async (req: Request, res: Response) => {
    try {
      await ensureResellerTables();
      return await fn(req, res);
    } catch (e) {
      if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
      console.error(e);
      return res.status(500).json({ error: "Terjadi kesalahan server" });
    }
  };

function isActiveMember(row: any): boolean {
  if (!row || !row.active) return false;
  if (row.plan === "lifetime") return true;
  return !!row.expires_at && new Date(row.expires_at).getTime() > Date.now();
}

async function getPlanPrices() {
  const rows = rowsOf(await db.execute(sql`SELECT key, value FROM reseller_settings`));
  const m = new Map<string, number>(rows.map((r) => [String(r.key), Number(r.value)]));
  const pick = (k: string, d: number) => {
    const v = m.get(k);
    return v !== undefined && Number.isFinite(v) ? v : d;
  };
  return { monthly: pick("price_monthly", 10000), lifetime: pick("price_lifetime", 50000) };
}

async function walletBalance(ex: any, userId: string) {
  const r = rowsOf(await ex.execute(sql`SELECT balance FROM wallets WHERE user_id = ${userId}`))[0];
  return r ? Number(r.balance) : 0;
}

function clerkUser(req: Request): string {
  const id = getAuth(req)?.userId;
  if (!id) throw new HttpError(401, "Login diperlukan");
  return id;
}

const attempts = new Map<string, { n: number; t: number }>();
function tooMany(ip: string) {
  const now = Date.now();
  const a = attempts.get(ip);
  if (!a || now - a.t > 15 * 60 * 1000) {
    attempts.set(ip, { n: 1, t: now });
    return false;
  }
  a.n++;
  return a.n > 10;
}

async function requireReseller(req: Request, res: Response, next: NextFunction) {
  try {
    await ensureResellerTables();
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const userId = token ? readToken(token) : null;
    if (!userId) return res.status(401).json({ error: "Login reseller diperlukan" });

    const row = rowsOf(
      await db.execute(sql`SELECT * FROM reseller_members WHERE user_id = ${userId}`),
    )[0];
    if (!isActiveMember(row) || !row.username) {
      return res.status(401).json({ error: "Paket reseller tidak aktif atau sudah habis" });
    }
    (req as any).reseller = {
      userId,
      username: row.username,
      plan: row.plan,
      expiresAt: row.expires_at,
      balance: await walletBalance(db, userId),
    };
    return next();
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Terjadi kesalahan server" });
  }
}

/* ================= MEMBER (Clerk) ================= */
router.get(
  "/reseller/plans",
  h(async (req, res) => {
    const prices = await getPlanPrices();
    const userId = getAuth(req)?.userId;
    let member: any = null;
    if (userId) {
      const row = rowsOf(
        await db.execute(sql`SELECT * FROM reseller_members WHERE user_id = ${userId}`),
      )[0];
      if (row) {
        member = {
          plan: row.plan,
          expiresAt: row.expires_at,
          active: isActiveMember(row),
          username: row.username,
        };
      }
    }
    return res.json({ prices, member });
  }),
);

router.post(
  "/reseller/plans/purchase",
  h(async (req, res) => {
    const userId = clerkUser(req);
    const plan = String(req.body.plan);
    if (plan !== "monthly" && plan !== "lifetime") throw new HttpError(400, "Paket tidak valid");
    const price = (await getPlanPrices())[plan];

    const result = await db.transaction(async (tx) => {
      const existing = rowsOf(
        await tx.execute(sql`SELECT * FROM reseller_members WHERE user_id = ${userId} FOR UPDATE`),
      )[0];
      if (existing && !existing.active) {
        throw new HttpError(403, "Akun reseller kamu dinonaktifkan admin");
      }
      if (existing && existing.plan === "lifetime") {
        throw new HttpError(409, "Kamu sudah reseller lifetime");
      }

      await tx.execute(
        sql`INSERT INTO wallets (user_id, balance) VALUES (${userId}, 0) ON CONFLICT (user_id) DO NOTHING`,
      );
      const debit = rowsOf(
        await tx.execute(sql`
          UPDATE wallets SET balance = balance - ${price}, updated_at = NOW()
          WHERE user_id = ${userId} AND balance >= ${price}
          RETURNING balance
        `),
      )[0];
      if (!debit) throw new HttpError(400, "Saldo tidak cukup. Top up dulu di tab Top Up Saldo.");

      let expiresIso: string | null = null;
      if (plan === "monthly") {
        const now = Date.now();
        const cur = existing?.expires_at ? new Date(existing.expires_at).getTime() : 0;
        expiresIso = new Date(Math.max(now, cur) + PLAN_DAYS * 86400000).toISOString();
      }

      await tx.execute(sql`
        INSERT INTO reseller_members (user_id, plan, expires_at)
        VALUES (${userId}, ${plan}, ${expiresIso}::timestamptz)
        ON CONFLICT (user_id) DO UPDATE
        SET plan = EXCLUDED.plan, expires_at = EXCLUDED.expires_at
      `);

      await tx.execute(sql`
        INSERT INTO wallet_transactions (user_id, type, amount, reference, description, status)
        VALUES (${userId}, 'PURCHASE', ${-price},
                ${`RESELLER-${plan.toUpperCase()}-${Date.now()}`},
                ${`Rank Reseller Products (${plan === "monthly" ? "Bulanan" : "Lifetime"})`}, 'PAID')
      `);

      return { plan, expiresAt: expiresIso, balance: Number(debit.balance) };
    });

    return res.json(result);
  }),
);

router.post(
  "/reseller/credentials",
  h(async (req, res) => {
    const userId = clerkUser(req);
    const username = String(req.body.username || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      throw new HttpError(400, "Username 3-24 karakter: huruf kecil, angka, atau _");
    }
    if (password.length < 6 || password.length > 72) {
      throw new HttpError(400, "Password 6-72 karakter");
    }

    const member = rowsOf(
      await db.execute(sql`SELECT * FROM reseller_members WHERE user_id = ${userId}`),
    )[0];
    if (!isActiveMember(member)) {
      throw new HttpError(403, "Kamu belum punya paket reseller aktif");
    }

    const taken = rowsOf(
      await db.execute(
        sql`SELECT 1 FROM reseller_members WHERE username = ${username} AND user_id <> ${userId}`,
      ),
    )[0];
    if (taken) throw new HttpError(400, "Username sudah dipakai, pilih yang lain");

    try {
      await db.execute(sql`
        UPDATE reseller_members
        SET username = ${username}, password_hash = ${hashPassword(password)}
        WHERE user_id = ${userId}
      `);
    } catch (e: any) {
      if (e?.code === "23505" || e?.cause?.code === "23505") {
        throw new HttpError(400, "Username sudah dipakai, pilih yang lain");
      }
      throw e;
    }
    return res.json({ ok: true, username });
  }),
);

/* ================= RESELLER (login sendiri) ================= */
router.post(
  "/reseller/login",
  h(async (req, res) => {
    const ip = String(req.headers["x-forwarded-for"] || req.ip || "x").split(",")[0].trim();
    if (tooMany(ip)) throw new HttpError(429, "Terlalu banyak percobaan, coba lagi 15 menit lagi");

    const username = String(req.body.username || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const acc = rowsOf(
      await db.execute(sql`SELECT * FROM reseller_members WHERE username = ${username}`),
    )[0];

    if (!acc || !acc.password_hash || !verifyPassword(password, acc.password_hash)) {
      throw new HttpError(401, "Username atau password salah");
    }
    if (!isActiveMember(acc)) {
      throw new HttpError(403, "Paket reseller kamu habis atau dinonaktifkan. Perpanjang di halaman Member.");
    }
    attempts.delete(ip);
    return res.json({ token: signToken(acc.user_id), username: acc.username });
  }),
);

router.get("/reseller/me", requireReseller, (req, res) => {
  const a = (req as any).reseller;
  res.json({ username: a.username, balance: a.balance, plan: a.plan, expiresAt: a.expiresAt });
});

router.get(
  "/reseller/products",
  requireReseller,
  h(async (_req, res) => {
    const products = await db.select().from(productsTable);
    const options = await db.select().from(productOptionsTable);

    return res.json(
      products.map((p: any) => {
        const { deliveryValue, ...safe } = p;
        return {
          ...safe,
          options: options
            .filter((o) => o.productId === p.id)
            .map(({ resellerPrice, ...o }) => ({
              ...o,
              normalPrice: o.price,
              price: resellerPrice ?? o.price,
              hasResellerPrice: resellerPrice != null,
            })),
        };
      }),
    );
  }),
);

router.post(
  "/reseller/orders",
  requireReseller,
  h(async (req, res) => {
    const acc = (req as any).reseller;
    const productId = Number(req.body.productId);
    const optionId = Number(req.body.optionId);

    const result = await db.transaction(async (tx) => {
      const [product] = await tx.select().from(productsTable).where(eq(productsTable.id, productId));
      const [option] = await tx
        .select()
        .from(productOptionsTable)
        .where(eq(productOptionsTable.id, optionId));

      if (!product || !option || option.productId !== product.id) {
        throw new HttpError(400, "Produk atau durasi tidak valid");
      }
      const isDrip = Boolean(option.dripVariantId);
    const availableStock = isDrip
      ? Number(option.dripStock ?? 0)
      : Number(option.stock ?? 0);

    if (availableStock <= 0) throw new HttpError(400, "Stok habis");

      const price = option.resellerPrice ?? option.price;

      let deliveryKey: string | null = null;
      let deliveryLink: string | null = null;

      if (!isDrip && product.deliveryType === "KEY") {
        const claimed = rowsOf(
          await tx.execute(sql`
            UPDATE product_keys SET status = 'SOLD'
            WHERE id = (
              SELECT id FROM product_keys
              WHERE product_id = ${product.id} AND option_id = ${option.id} AND status = 'READY'
              ORDER BY id ASC LIMIT 1 FOR UPDATE SKIP LOCKED
            )
            RETURNING id, key
          `),
        );
        if (!claimed[0]) throw new HttpError(400, "Key untuk durasi ini habis");
        deliveryKey = claimed[0].key;
      }

      if (product.deliveryType === "LINK") {
        deliveryLink = product.deliveryValue || null;
        if (!deliveryLink) throw new HttpError(400, "Link delivery belum diatur oleh admin");
      }

      const debit = rowsOf(
        await tx.execute(sql`
          UPDATE wallets SET balance = balance - ${price}, updated_at = NOW()
          WHERE user_id = ${acc.userId} AND balance >= ${price}
          RETURNING balance
        `),
      )[0];
      if (!debit) throw new HttpError(400, "Saldo tidak cukup. Top up di halaman Member.");

      if (!isDrip) {
        const stockRow = rowsOf(
          await tx.execute(sql`
            UPDATE product_options SET stock = stock - 1
            WHERE id = ${option.id} AND stock > 0 RETURNING id
          `),
        )[0];

        if (!stockRow) {
          throw new HttpError(400, "Stok habis, coba lagi");
        }
      }

      const invoice =
        `RSL-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-` +
        Math.random().toString(36).slice(2, 7).toUpperCase();

      const [order] = await tx
        .insert(ordersTable)
        .values({
          invoice,
          productId: product.id,
          optionId: option.id,
          productName: product.name,
          duration: option.duration,
          amount: price,
          whatsapp: `reseller:${acc.username}`,
          status: isDrip ? "PENDING" : "PAID",
          paymentRef: deliveryKey || deliveryLink || null,
        })
        .returning();

      await tx.execute(sql`
        INSERT INTO wallet_transactions (user_id, type, amount, reference, description, status)
        VALUES (${acc.userId}, 'PURCHASE', ${-price}, ${invoice},
                ${`[Reseller] ${product.name} - ${option.duration}`},
          ${isDrip ? "PENDING" : "PAID"})
      `);

      return { order, deliveryKey, deliveryLink, balance: Number(debit.balance) };
    });

    if (result.order.status === "PENDING" && result.order.optionId) {
      try {
        const drip = await generateDripKey(
          Number(
            (
              await db
                .select({ dripVariantId: productOptionsTable.dripVariantId })
                .from(productOptionsTable)
                .where(eq(productOptionsTable.id, result.order.optionId))
                .limit(1)
            )[0]?.dripVariantId,
          ),
          1,
        );

        if (
          !drip?.success ||
          !Array.isArray(drip?.keys) ||
          !drip.keys[0]
        ) {
          throw new Error(drip?.error || drip?.message || "DRIP gagal membuat key");
        }

        const deliveryKey = String(drip.keys[0]);

        const [completed] = await db
          .update(ordersTable)
          .set({
            status: "PAID",
            paymentRef: deliveryKey,
          })
          .where(eq(ordersTable.id, result.order.id))
          .returning();

        await db.execute(sql`
          UPDATE wallet_transactions
          SET status = 'PAID'
          WHERE reference = ${result.order.invoice}
        `);

        return res.json({
          ...completed,
          deliveryKey,
          deliveryLink: null,
          balance: result.balance,
          drip: true,
          dripOrderId: drip.order_id ?? null,
        });
      } catch (error) {
        console.error("Reseller DRIP generate error:", error);

        await db.transaction(async (tx) => {
          await tx.execute(sql`
            UPDATE wallets
            SET balance = balance + ${result.order.amount},
                updated_at = NOW()
            WHERE user_id = ${(req as any).reseller.userId}
          `);

          await tx.execute(sql`
            UPDATE wallet_transactions
            SET status = 'REFUNDED'
            WHERE reference = ${result.order.invoice}
          `);

          await tx
            .update(ordersTable)
            .set({ status: "CANCELLED" })
            .where(eq(ordersTable.id, result.order.id));
        });

        throw new HttpError(502, "Gagal generate key DRIP. Saldo sudah dikembalikan.");
      }
    }

    return res.json({
      ...result.order,
      deliveryKey: result.deliveryKey,
      deliveryLink: result.deliveryLink,
      balance: result.balance,
    });
  }),
);

router.get(
  "/reseller/orders",
  requireReseller,
  h(async (req, res) => {
    const tag = `reseller:${(req as any).reseller.username}`;
    const rows = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.whatsapp, tag))
      .orderBy(desc(ordersTable.createdAt));
    return res.json(rows);
  }),
);

/* ================= ADMIN ================= */
router.get(
  "/admin/reseller-settings",
  requireAdmin,
  h(async (_req, res) => res.json(await getPlanPrices())),
);

router.put(
  "/admin/reseller-settings",
  requireAdmin,
  h(async (req, res) => {
    const monthly = Math.trunc(Number(req.body.monthly));
    const lifetime = Math.trunc(Number(req.body.lifetime));
    if (![monthly, lifetime].every((n) => Number.isFinite(n) && n >= 0)) {
      throw new HttpError(400, "Harga paket tidak valid");
    }
    for (const [k, v] of [
      ["price_monthly", monthly],
      ["price_lifetime", lifetime],
    ] as const) {
      await db.execute(sql`
        INSERT INTO reseller_settings (key, value) VALUES (${k}, ${String(v)})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `);
    }
    return res.json({ ok: true, monthly, lifetime });
  }),
);

router.get(
  "/admin/resellers",
  requireAdmin,
  h(async (_req, res) => {
    const rows = rowsOf(
      await db.execute(sql`
        SELECT id, user_id, plan, expires_at, username, active, created_at
        FROM reseller_members ORDER BY id DESC
      `),
    );
    return res.json(rows.map((r) => ({ ...r, valid: isActiveMember(r) })));
  }),
);

router.patch(
  "/admin/resellers/:id",
  requireAdmin,
  h(async (req, res) => {
    if (typeof req.body.active !== "boolean") throw new HttpError(400, "active harus true/false");
    await db.execute(
      sql`UPDATE reseller_members SET active = ${req.body.active} WHERE id = ${Number(req.params.id)}`,
    );
    return res.json({ ok: true });
  }),
);

router.delete(
  "/admin/resellers/:id",
  requireAdmin,
  h(async (req, res) => {
    await db.execute(sql`DELETE FROM reseller_members WHERE id = ${Number(req.params.id)}`);
    return res.json({ ok: true });
  }),
);

router.get(
  "/admin/reseller-prices",
  requireAdmin,
  h(async (_req, res) => {
    return res.json(
      rowsOf(
        await db.execute(sql`
          SELECT id AS option_id, reseller_price AS price
          FROM product_options WHERE reseller_price IS NOT NULL
        `),
      ),
    );
  }),
);

// price kosong/null = hapus harga reseller (kembali ke harga normal)
router.put(
  "/admin/reseller-prices/:optionId",
  requireAdmin,
  h(async (req, res) => {
    const optionId = Number(req.params.optionId);
    const raw = req.body.price;
    let price: number | null = null;
    if (raw !== null && raw !== "" && raw !== undefined) {
      price = Math.trunc(Number(raw));
      if (!Number.isFinite(price) || price < 0) throw new HttpError(400, "Harga tidak valid");
    }
    await db.execute(
      sql`UPDATE product_options SET reseller_price = ${price}::integer WHERE id = ${optionId}`,
    );
    return res.json({ ok: true, price });
  }),
);

export default router;
