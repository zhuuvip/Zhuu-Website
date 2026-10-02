import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { getAuth } from "@clerk/express";
import { createClerkClient } from "@clerk/backend";
import { db } from "@workspace/db";
import { productsTable, productOptionsTable, ordersTable } from "@workspace/db";
import { and, eq, sql, desc } from "drizzle-orm";
import { requireAdmin } from "../lib/auth.js";
import { generateDripKey } from "../lib/dripApi.js";
import {
  applyPromo,
  recordPromoUsage,
  rollbackPromoUsage,
} from "../lib/promo.js";

const router = Router();

let ordersIdempotencyReady: Promise<void> | null = null;

function ensureOrdersIdempotencySchema(): Promise<void> {
  if (!ordersIdempotencyReady) {
    ordersIdempotencyReady = (async () => {
      await db.execute(sql`
        ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS idempotency_key TEXT
      `);

      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_key_unique
        ON orders (idempotency_key)
        WHERE idempotency_key IS NOT NULL
      `);
    })().catch((e) => {
      ordersIdempotencyReady = null;
      throw e;
    });
  }

  return ordersIdempotencyReady;
}

const rowsOf = (r: any): any[] => r?.rows ?? r ?? [];
const PLAN_DAYS = 30;

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function isIdempotencyConflict(error: unknown): boolean {
  const e = error as any;
  return (
    e?.code === "23505" &&
    (
      e?.constraint === "orders_idempotency_key_unique" ||
      String(e?.detail || "").includes("idempotency_key")
    )
  );
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
      await db.execute(sql`ALTER TABLE reseller_members ADD COLUMN IF NOT EXISTS credential_version INTEGER NOT NULL DEFAULT 0`);
      await db.execute(sql`ALTER TABLE reseller_members ADD COLUMN IF NOT EXISTS wallet_user_id TEXT`);
      await db.execute(sql`ALTER TABLE reseller_members ADD COLUMN IF NOT EXISTS wallet_email TEXT`);
  await db.execute(sql`ALTER TABLE reseller_members ADD COLUMN IF NOT EXISTS wallet_username TEXT`);
      await db.execute(sql`ALTER TABLE reseller_members ADD COLUMN IF NOT EXISTS api_key_hash TEXT`);
      await db.execute(sql`ALTER TABLE reseller_members ADD COLUMN IF NOT EXISTS api_key_prefix TEXT`);
      await db.execute(sql`ALTER TABLE reseller_members ADD COLUMN IF NOT EXISTS api_enabled BOOLEAN NOT NULL DEFAULT FALSE`);
      await db.execute(sql`ALTER TABLE reseller_members ADD COLUMN IF NOT EXISTS api_created_at TIMESTAMPTZ`);
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
function generateResellerApiKey() {
  const raw = crypto.randomBytes(32).toString("base64url");
  return `zhuu_live_${raw}`;
}

function hashResellerApiKey(apiKey: string) {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}

function apiKeyPrefix(apiKey: string) {
  return apiKey.slice(0, 16);
}

function secret() {
  const s = process.env.RESELLER_SECRET;
  if (!s || s.length < 16) throw new Error("RESELLER_SECRET belum diatur");
  return s;
}
function sign(body: string) {
  return crypto.createHmac("sha256", secret()).update(body).digest("base64url");
}
function signToken(userId: string, credentialVersion = 0) {
  const body = Buffer.from(
    JSON.stringify({
      u: userId,
      v: credentialVersion,
      exp: Date.now() + 7 * 24 * 3600 * 1000,
    }),
  ).toString("base64url");

  return `${body}.${sign(body)}`;
}

function readToken(
  token: string,
): { userId: string; credentialVersion: number } | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const a = Buffer.from(sig);
  const b = Buffer.from(sign(body));

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());

    if (typeof p.u !== "string" || p.exp < Date.now()) {
      return null;
    }

    return {
      userId: p.u,
      credentialVersion:
        Number.isInteger(p.v) && p.v >= 0 ? p.v : 0,
    };
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

      if (isIdempotencyConflict(e)) {
        const idempotencyKey =
          typeof req.body?.idempotencyKey === "string"
            ? req.body.idempotencyKey.trim()
            : "";

        if (idempotencyKey) {
          const [existingOrder] = await db
            .select()
            .from(ordersTable)
            .where(eq(ordersTable.idempotencyKey, idempotencyKey))
            .limit(1);

          if (existingOrder) {
            return res.json({
              ...existingOrder,
              duplicate: true,
            });
          }
        }
      }

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
  const member = rowsOf(
    await ex.execute(
      sql`SELECT wallet_user_id FROM reseller_members WHERE user_id = ${userId}`,
    ),
  )[0];

  const walletUserId = String(member?.wallet_user_id || userId);

  const r = rowsOf(
    await ex.execute(
      sql`SELECT balance FROM wallets WHERE user_id = ${walletUserId}`,
    ),
  )[0];

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

    const token = String(req.headers.authorization || "").replace(
      /^Bearer\s+/i,
      "",
    );

    const tokenData = token ? readToken(token) : null;

    if (!tokenData) {
      return res.status(401).json({
        error: "Login reseller diperlukan",
      });
    }

    const userId = tokenData.userId;

    const row = rowsOf(
      await db.execute(
        sql`SELECT * FROM reseller_members WHERE user_id = ${userId}`,
      ),
    )[0];

    if (!isActiveMember(row) || !row.username) {
      return res.status(401).json({
        error: "Paket reseller tidak aktif atau sudah habis",
      });
    }

    const currentCredentialVersion = Number(
      row.credential_version ?? 0,
    );

    if (currentCredentialVersion !== tokenData.credentialVersion) {
      return res.status(401).json({
        error: "Sesi reseller sudah tidak berlaku. Silakan login kembali.",
      });
    }

    (req as any).reseller = {
      userId,
      username: row.username,
      plan: row.plan,
      expiresAt: row.expires_at,
      balance: await walletBalance(db, userId),
        wallet_user_id: row.wallet_user_id || null,
      walletEmail: row.wallet_email || null,
    };

    return next();
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      error: "Terjadi kesalahan server",
    });
  }
}

/* ================= MEMBER (Clerk) ================= */

async function requireResellerApi(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ")) {
      return res.status(401).json({ error: "API key required" });
    }

    const apiKey = auth.slice(7).trim();
    if (!apiKey.startsWith("zhuu_live_")) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    const hash = hashResellerApiKey(apiKey);

    const rows = await db.execute(sql`
      SELECT *
      FROM reseller_members
      WHERE api_key_hash = ${hash}
      LIMIT 1
    `);

    const acc = rows.rows?.[0] as any;

    if (!acc || !acc.api_enabled) {
      return res.status(401).json({ error: "Invalid or disabled API key" });
    }

    if (acc.status !== "ACTIVE") {
      return res.status(403).json({ error: "Reseller account is not active" });
    }

    if (acc.expires_at && new Date(acc.expires_at).getTime() < Date.now()) {
      return res.status(403).json({ error: "Reseller plan expired" });
    }

    (req as any).reseller = {
      userId: acc.user_id,
      username: acc.username,
      plan: acc.plan,
      expiresAt: acc.expires_at,
      balance: await walletBalance(db, acc.user_id),
      wallet_user_id: acc.wallet_user_id || null,
      walletEmail: acc.wallet_email || null,
    };

    return next();
  } catch (err) {
    console.error("[reseller-api-auth]", err);
    return res.status(500).json({ error: "API authentication failed" });
  }
}

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

      const walletUserId = String(existing?.wallet_user_id || userId);

      await tx.execute(
        sql`INSERT INTO wallets (user_id, balance) VALUES (${walletUserId}, 0) ON CONFLICT (user_id) DO NOTHING`,
      );
      const debit = rowsOf(
        await tx.execute(sql`
          UPDATE wallets SET balance = balance - ${price}, updated_at = NOW()
          WHERE user_id = ${walletUserId} AND balance >= ${price}
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
        VALUES (${walletUserId}, 'PURCHASE', ${-price},
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
  requireReseller,
  h(async (req, res) => {
    const userId = (req as any).reseller.userId;

    const username = String(req.body.username || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const walletEmail = String(req.body.walletEmail || "").trim().toLowerCase();

    if (!username && !password && !walletEmail) {
      throw new HttpError(
        400,
        "Isi username, password, atau email Member.",
      );
    }

    if (username && !/^[a-z0-9_]{3,24}$/.test(username)) {
      throw new HttpError(
        400,
        "Username 3-24 karakter: huruf kecil, angka, atau underscore.",
      );
    }

    if (password && (password.length < 6 || password.length > 72)) {
      throw new HttpError(400, "Password harus 6-72 karakter.");
    }

    let walletUserId: string | null = null;
    let savedWalletEmail: string | null = null;
  let savedWalletUsername: string | null = null;

    if (walletEmail) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(walletEmail)) {
        throw new HttpError(400, "Format email Member tidak valid.");
      }

      const secretKey = process.env.CLERK_SECRET_KEY;

      if (!secretKey) {
        throw new HttpError(
          500,
          "CLERK_SECRET_KEY belum dikonfigurasi di server.",
        );
      }

      const clerk = createClerkClient({ secretKey });

      const result = await clerk.users.getUserList({
        emailAddress: [walletEmail],
        limit: 100,
      });

      const user = result.data.find((item) =>
        item.emailAddresses.some(
          (email) =>
            email.emailAddress.toLowerCase() === walletEmail,
        ),
      );

      if (!user) {
        throw new HttpError(
          404,
          "Akun Member dengan email tersebut tidak ditemukan.",
        );
      }

      walletUserId = user.id;
      savedWalletEmail = walletEmail;
      savedWalletUsername =
        typeof user.username === "string" && user.username.trim()
          ? user.username.trim()
          : null;
    }

    try {
      const updated = rowsOf(
        await db.execute(sql`
          UPDATE reseller_members
          SET
            username = COALESCE(${username || null}, username),
            password_hash = COALESCE(
              ${password ? hashPassword(password) : null},
              password_hash
            ),
            wallet_user_id = COALESCE(
              ${walletUserId},
              wallet_user_id
            ),
            wallet_email = COALESCE(
              ${savedWalletEmail},
              wallet_email
            ),
            wallet_username = COALESCE(
              ${savedWalletUsername},
              wallet_username
            ),
            credential_version = credential_version + 1
          WHERE user_id = ${userId}
          RETURNING
            credential_version,
            username,
            wallet_email,
            wallet_username
        `),
      );

      const credentialVersion = Number(
        updated[0]?.credential_version ?? 0,
      );

      return res.json({
        ok: true,
        username: updated[0]?.username || username,
        walletEmail: updated[0]?.wallet_email || null,
        walletUsername: updated[0]?.wallet_username || null,
        token: signToken(userId, credentialVersion),
      });
    } catch (e: any) {
      if (e?.code === "23505" || e?.cause?.code === "23505") {
        throw new HttpError(
          400,
          "Username sudah dipakai, pilih yang lain.",
        );
      }

      throw e;
    }
  }),
);

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
    return res.json({
      token: signToken(
        acc.user_id,
        Number(acc.credential_version ?? 0),
      ),
      username: acc.username,
    });
  }),
);


router.post("/reseller/api-key", requireReseller, async (req, res) => {
  try {
    const acc = (req as any).reseller;
    const apiKey = generateResellerApiKey();
    const hash = hashResellerApiKey(apiKey);
    const prefix = apiKeyPrefix(apiKey);

    await db.execute(sql`
      UPDATE reseller_members
      SET
        api_key_hash = ${hash},
        api_key_prefix = ${prefix},
        api_enabled = TRUE,
        api_created_at = NOW()
      WHERE user_id = ${acc.userId}
    `);

    return res.json({
      success: true,
      apiKey,
      prefix,
      enabled: true,
      warning: "Simpan API key ini sekarang. Key lengkap hanya ditampilkan saat dibuat."
    });
  } catch (err) {
    console.error("[reseller-api-key-create]", err);
    return res.status(500).json({ error: "Failed to generate API key" });
  }
});

router.get("/reseller/api-key", requireReseller, async (req, res) => {
  try {
    const acc = (req as any).reseller;

    const rows = await db.execute(sql`
      SELECT api_key_prefix, api_enabled, api_created_at
      FROM reseller_members
      WHERE user_id = ${acc.userId}
      LIMIT 1
    `);

    const row = rows.rows?.[0] as any;

    return res.json({
      enabled: !!row?.api_enabled,
      prefix: row?.api_key_prefix || null,
      createdAt: row?.api_created_at || null
    });
  } catch (err) {
    console.error("[reseller-api-key-info]", err);
    return res.status(500).json({ error: "Failed to get API key info" });
  }
});

router.delete("/reseller/api-key", requireReseller, async (req, res) => {
  try {
    const acc = (req as any).reseller;

    await db.execute(sql`
      UPDATE reseller_members
      SET api_key_hash = NULL,
          api_key_prefix = NULL,
          api_enabled = FALSE,
          api_created_at = NULL
      WHERE user_id = ${acc.userId}
    `);

    return res.json({
      success: true,
      enabled: false
    });
  } catch (err) {
    console.error("[reseller-api-key-revoke]", err);
    return res.status(500).json({ error: "Failed to revoke API key" });
  }
});


router.get("/reseller/v1/balance", requireResellerApi, async (req, res) => {
  try {
    const acc = (req as any).reseller;
    const balance = await walletBalance(db, acc.userId);

    return res.json({
      success: true,
      balance,
      currency: "IDR"
    });
  } catch (err) {
    console.error("[reseller-api-balance]", err);
    return res.status(500).json({ error: "Failed to get balance" });
  }
});

router.get("/reseller/v1/products", requireResellerApi, async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT
        p.id,
        p.name,
        p.description,
        p.image,
        p.category,
        o.id AS option_id,
        o.name AS option_name,
        o.reseller_price,
        o.stock
      FROM products p
      LEFT JOIN product_options o ON o.product_id = p.id
      WHERE p.active = TRUE
      ORDER BY p.id ASC, o.id ASC
    `);

    const products = new Map<string, any>();

    for (const row of result.rows as any[]) {
      if (!products.has(row.id)) {
        products.set(row.id, {
          id: row.id,
          name: row.name,
          description: row.description,
          image: row.image,
          category: row.category,
          options: []
        });
      }

      if (row.option_id) {
        products.get(row.id).options.push({
          id: row.option_id,
          name: row.option_name,
          price: row.reseller_price,
          stock: row.stock
        });
      }
    }

    return res.json({
      success: true,
      products: Array.from(products.values())
    });
  } catch (err) {
    console.error("[reseller-api-products]", err);
    return res.status(500).json({ error: "Failed to get products" });
  }
});

router.get("/reseller/me", requireReseller, (req, res) => {
  const a = (req as any).reseller;
  res.json({
    username: a.username,
    balance: a.balance,
    plan: a.plan,
    expiresAt: a.expiresAt,
    walletEmail: a.walletEmail || null,
  });
});

router.get(
  "/reseller/products",
  requireReseller,
  h(async (_req, res) => {
    const products = await db.select().from(productsTable);
    const options = await db.select().from(productOptionsTable);

    const purchaseCounts = await db
      .select({
        productId: ordersTable.productId,
        purchaseCount: sql<number>`COUNT(*)`,
      })
      .from(ordersTable)
      .where(eq(ordersTable.status, "PAID"))
      .groupBy(ordersTable.productId);

    const purchaseCountMap = new Map(
      purchaseCounts.map((row) => [
        row.productId,
        Number(row.purchaseCount),
      ]),
    );

    return res.json(
      products.map((p: any) => {
        const { deliveryValue, ...safe } = p;
        return {
          ...safe,
          purchaseCount: purchaseCountMap.get(p.id) ?? 0,
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
  "/reseller/validate-promo",
  requireReseller,
  h(async (req, res) => {
    const acc = (req as any).reseller;
    const productId = Number(req.body.productId);
    const optionId = Number(req.body.optionId);
    const code = req.body.code;

    if (!code || !productId || !optionId) {
      throw new HttpError(400, "Kode promo, produk, dan durasi wajib diisi");
    }

    const result = await db.transaction(async (tx) => {
      const [product] = await tx
        .select()
        .from(productsTable)
        .where(eq(productsTable.id, productId));

      const [option] = await tx
        .select()
        .from(productOptionsTable)
        .where(eq(productOptionsTable.id, optionId));

      if (!product || !option || option.productId !== product.id) {
        throw new HttpError(400, "Produk atau durasi tidak valid");
      }

      const basePrice = option.resellerPrice ?? option.price;

      const promo = await applyPromo(tx, {
        code,
        audience: "RESELLER",
        userId: acc.userId,
        basePrice,
      });

      return {
        ...promo,
        originalPrice: basePrice,
      };
    });

    return res.json({
      code: result.promo?.code ?? null,
      originalPrice: result.originalPrice,
      discount: result.discount,
      finalPrice: result.finalPrice,
    });
  }),
);

async function createResellerOrder(req: Request, res: Response) {
    const acc = (req as any).reseller;

    await ensureOrdersIdempotencySchema();

    const idempotencyKey =
      typeof req.body.idempotencyKey === "string"
        ? req.body.idempotencyKey.trim()
        : "";

    if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
      throw new HttpError(
        400,
        "Request pembelian tidak valid. Silakan coba lagi.",
      );
    }

    const productId = Number(req.body.productId);
    const optionId = Number(req.body.optionId);
    const promoCode =
      typeof req.body.promoCode === "string"
        ? req.body.promoCode.trim()
        : undefined;

    if (
      !Number.isInteger(productId) ||
      productId <= 0 ||
      !Number.isInteger(optionId) ||
      optionId <= 0
    ) {
      throw new HttpError(400, "Produk atau durasi tidak valid");
    }

    /*
     * IDEMPOTENCY
     * Request dengan key yang sama tidak boleh membuat order/debit kedua.
     */
    const [existingOrder] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.idempotencyKey, idempotencyKey))
      .limit(1);

    if (existingOrder) {
      return res.json({
        ...existingOrder,
        duplicate: true,
      });
    }

    /*
     * ============================================================
     * STEP 1 — VALIDATE + DEBIT + CREATE PENDING ORDER
     * ============================================================
     *
     * Semua harga dan stock dipercaya dari database.
     * Tidak ada harga dari frontend yang digunakan.
     */
    const prepared = await db.transaction(async (tx) => {
      const [product] = await tx
        .select()
        .from(productsTable)
        .where(eq(productsTable.id, productId))
        .limit(1);

      const [option] = await tx
        .select()
        .from(productOptionsTable)
        .where(eq(productOptionsTable.id, optionId))
        .limit(1);

      if (!product || !option || option.productId !== product.id) {
        throw new HttpError(400, "Produk atau durasi tidak valid");
      }

      const isDrip = Boolean(option.dripVariantId);

      /*
       * DRIP memakai stock supplier.
       * Produk lokal memakai stock database.
       */
      if (isDrip) {
        if (Number(option.dripStock ?? 0) <= 0) {
          throw new HttpError(400, "Stok DRIP habis");
        }
      } else if (Number(option.stock ?? 0) <= 0) {
        throw new HttpError(400, "Stok habis");
      }

      /*
       * Harga reseller selalu dihitung dari database.
       */
      const basePrice = Number(
        option.resellerPrice ?? option.price ?? 0,
      );

      if (!Number.isFinite(basePrice) || basePrice < 0) {
        throw new HttpError(400, "Harga produk tidak valid");
      }

      let promoResult;

      try {
        promoResult = await applyPromo(tx, {
          code: promoCode,
          audience: "RESELLER",
          userId: acc.userId,
          basePrice,
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Kode promo tidak valid";

        throw new HttpError(400, message);
      }

      const finalPrice = Number(promoResult.finalPrice);

      if (
        !Number.isFinite(finalPrice) ||
        finalPrice < 0 ||
        finalPrice > basePrice
      ) {
        throw new HttpError(400, "Harga akhir tidak valid");
      }

      /*
       * LINK harus tersedia sebelum wallet didebit.
       */
      let deliveryLink: string | null = null;

      if (product.deliveryType === "LINK") {
        deliveryLink = product.deliveryValue?.trim() || null;

        if (!deliveryLink) {
          throw new HttpError(
            400,
            "Link delivery belum diatur oleh admin",
          );
        }
      }

      /*
       * Wallet reseller harus menggunakan wallet Member
       * yang sudah terhubung.
       */
      const walletUserId = String(
        acc.wallet_user_id || acc.userId,
      );

      if (!walletUserId) {
        throw new HttpError(
          400,
          "Wallet reseller belum terhubung",
        );
      }

      /*
       * ATOMIC DEBIT
       *
       * Walaupun dua request datang bersamaan,
       * database hanya mengizinkan saldo yang benar-benar cukup.
       */
      const debit = rowsOf(
        await tx.execute(sql`
          UPDATE wallets
          SET
            balance = balance - ${finalPrice},
            updated_at = NOW()
          WHERE user_id = ${walletUserId}
            AND balance >= ${finalPrice}
          RETURNING balance
        `),
      )[0];

      if (!debit) {
        throw new HttpError(
          400,
          "Saldo tidak cukup. Top up di halaman Member.",
        );
      }

      /*
       * ATOMIC LOCAL STOCK DEBIT.
       *
       * Kalau stock berubah menjadi 0 di request lain,
       * request ini otomatis gagal dan seluruh transaction rollback,
       * termasuk debit wallet.
       */
      if (!isDrip) {
        const stockRow = rowsOf(
          await tx.execute(sql`
            UPDATE product_options
            SET stock = stock - 1
            WHERE id = ${option.id}
              AND stock > 0
            RETURNING id
          `),
        )[0];

        if (!stockRow) {
          throw new HttpError(
            400,
            "Stok habis atau stok berubah, silakan coba lagi",
          );
        }
      }

      const invoice =
        `RSL-${new Date()
          .toISOString()
          .slice(0, 10)
          .replace(/-/g, "")}-` +
        crypto.randomBytes(5).toString("hex").toUpperCase();

      /*
       * SEMUA pembelian dibuat PENDING dahulu.
       * Baru menjadi PAID setelah delivery benar-benar berhasil.
       */
      const [order] = await tx
        .insert(ordersTable)
        .values({
          invoice,
          idempotencyKey,
          productId: product.id,
          optionId: option.id,
          productName: product.name,
          duration: option.duration,
          amount: finalPrice,
          whatsapp: `reseller:${acc.username}`,
          status: "PENDING",
          paymentRef: null,
        })
        .returning();

      await tx.execute(sql`
        INSERT INTO wallet_transactions
          (user_id, type, amount, reference, description, status)
        VALUES
          (
            ${walletUserId},
            'PURCHASE',
            ${-finalPrice},
            ${invoice},
            ${`[Reseller] ${product.name} - ${option.duration}`},
            'PENDING'
          )
      `);

      if (promoResult.promo) {
        await recordPromoUsage(tx, {
          promoId: promoResult.promo.id,
          userId: acc.userId,
          audience: "RESELLER",
          orderId: order.id,
          discount: promoResult.discount,
        });
      }

      return {
        order,
        product,
        option,
        isDrip,
        walletUserId,
        balance: Number(debit.balance),
        deliveryLink,
        promoId: promoResult.promo?.id ?? null,
        promo: promoResult.promo
          ? {
              id: promoResult.promo.id,
              code: promoResult.promo.code,
              discount: promoResult.discount,
              originalPrice: basePrice,
              finalPrice,
            }
          : null,
      };
    });

    /*
     * ============================================================
     * STEP 2 — DELIVERY
     * ============================================================
     */

    try {
      /*
       * ----------------------------------------------------------
       * DRIP
       * ----------------------------------------------------------
       */
      if (prepared.isDrip) {
        const variantId = Number(
          prepared.option.dripVariantId,
        );

        if (!Number.isInteger(variantId) || variantId <= 0) {
          throw new Error("DRIP variant tidak valid");
        }

        let drip: any;

        try {
          drip = await generateDripKey(variantId, 1);
        } catch (error) {
          console.error(
            "Reseller DRIP generate request failed:",
            error,
          );
          throw new Error("Gagal menghubungi server DRIP");
        }

        if (
          !drip ||
          drip.success !== true ||
          !Array.isArray(drip.keys) ||
          !drip.keys[0]
        ) {
          throw new Error(
            drip?.error ||
              drip?.message ||
              "DRIP gagal membuat key",
          );
        }

        const deliveryKey = String(drip.keys[0]);

        /*
         * Finalize order + transaction secara atomic.
         */
        const [completed] = await db.transaction(async (tx) => {
          const [lockedOrder] = await tx
            .select()
            .from(ordersTable)
            .where(eq(ordersTable.id, prepared.order.id))
            .limit(1);

          if (
            !lockedOrder ||
            lockedOrder.status !== "PENDING"
          ) {
            throw new Error(
              "Order sudah diproses atau status tidak valid",
            );
          }

          const [updatedOrder] = await tx
            .update(ordersTable)
            .set({
              status: "PAID",
              paymentRef: deliveryKey,
            })
            .where(
              and(
                eq(ordersTable.id, prepared.order.id),
                eq(ordersTable.status, "PENDING"),
              ),
            )
            .returning();

          if (!updatedOrder) {
            throw new Error(
              "Order gagal difinalisasi",
            );
          }

          const txRows = rowsOf(
            await tx.execute(sql`
              UPDATE wallet_transactions
              SET status = 'PAID'
              WHERE reference = ${prepared.order.invoice}
                AND status = 'PENDING'
              RETURNING id
            `),
          );

          if (!txRows[0]) {
            throw new Error(
              "Transaksi wallet tidak ditemukan",
            );
          }

          return [updatedOrder];
        });

        return res.json({
          ...completed,
          deliveryKey,
          deliveryLink: null,
          balance: prepared.balance,
          drip: true,
          dripOrderId: drip.order_id ?? null,
          promo: prepared.promo,
        });
      }

      /*
       * ----------------------------------------------------------
       * LOCAL KEY
       * ----------------------------------------------------------
       *
       * Key baru di-claim setelah wallet + stock berhasil.
       * Claim + finalize order dilakukan dalam satu transaction.
       */
      if (prepared.product.deliveryType === "KEY") {
        const finalized = await db.transaction(async (tx) => {
          const claimed = rowsOf(
            await tx.execute(sql`
              UPDATE product_keys
              SET status = 'SOLD'
              WHERE id = (
                SELECT id
                FROM product_keys
                WHERE product_id = ${prepared.product.id}
                  AND option_id = ${prepared.option.id}
                  AND status = 'READY'
                ORDER BY id ASC
                LIMIT 1
                FOR UPDATE SKIP LOCKED
              )
              RETURNING id, key
            `),
          );

          if (!claimed[0]) {
            throw new HttpError(
              400,
              "Key untuk durasi ini habis",
            );
          }

          const deliveryKey = String(claimed[0].key);

          const [updatedOrder] = await tx
            .update(ordersTable)
            .set({
              status: "PAID",
              paymentRef: deliveryKey,
            })
            .where(
              and(
                eq(ordersTable.id, prepared.order.id),
                eq(ordersTable.status, "PENDING"),
              ),
            )
            .returning();

          if (!updatedOrder) {
            throw new Error(
              "Order gagal difinalisasi",
            );
          }

          const txRows = rowsOf(
            await tx.execute(sql`
              UPDATE wallet_transactions
              SET status = 'PAID'
              WHERE reference = ${prepared.order.invoice}
                AND status = 'PENDING'
              RETURNING id
            `),
          );

          if (!txRows[0]) {
            throw new Error(
              "Transaksi wallet tidak ditemukan",
            );
          }

          return {
            order: updatedOrder,
            deliveryKey,
          };
        });

        return res.json({
          ...finalized.order,
          deliveryKey: finalized.deliveryKey,
          deliveryLink: null,
          balance: prepared.balance,
          drip: false,
          promo: prepared.promo,
        });
      }

      /*
       * ----------------------------------------------------------
       * LOCAL LINK
       * ----------------------------------------------------------
       */
      if (prepared.product.deliveryType === "LINK") {
        if (!prepared.deliveryLink) {
          throw new Error(
            "Link delivery belum diatur oleh admin",
          );
        }

        const [completed] = await db.transaction(
          async (tx) => {
            const [updatedOrder] = await tx
              .update(ordersTable)
              .set({
                status: "PAID",
                paymentRef: prepared.deliveryLink,
              })
              .where(
                and(
                  eq(ordersTable.id, prepared.order.id),
                  eq(ordersTable.status, "PENDING"),
                ),
              )
              .returning();

            if (!updatedOrder) {
              throw new Error(
                "Order gagal difinalisasi",
              );
            }

            const txRows = rowsOf(
              await tx.execute(sql`
                UPDATE wallet_transactions
                SET status = 'PAID'
                WHERE reference = ${prepared.order.invoice}
                  AND status = 'PENDING'
                RETURNING id
              `),
            );

            if (!txRows[0]) {
              throw new Error(
                "Transaksi wallet tidak ditemukan",
              );
            }

            return [updatedOrder];
          },
        );

        return res.json({
          ...completed,
          deliveryKey: null,
          deliveryLink: prepared.deliveryLink,
          balance: prepared.balance,
          drip: false,
          promo: prepared.promo,
        });
      }

      throw new Error(
        "Tipe delivery produk tidak valid",
      );
    } catch (error) {
      /*
       * ==========================================================
       * STEP 3 — FULL REFUND
       * ==========================================================
       *
       * Hanya refund kalau order masih PENDING.
       * Ini mencegah double refund.
       */
      console.error(
        "Reseller purchase delivery error:",
        error,
      );

      await db.transaction(async (tx) => {
        const [pending] = await tx
          .select()
          .from(ordersTable)
          .where(eq(ordersTable.id, prepared.order.id))
          .limit(1);

        if (!pending || pending.status !== "PENDING") {
          return;
        }

        /*
         * Restore wallet secara atomic.
         */
        const refund = rowsOf(
          await tx.execute(sql`
            UPDATE wallets
            SET
              balance = balance + ${prepared.order.amount},
              updated_at = NOW()
            WHERE user_id = ${prepared.walletUserId}
            RETURNING balance
          `),
        )[0];

        if (!refund) {
          throw new Error(
            "Refund gagal: wallet reseller tidak ditemukan",
          );
        }

        /*
         * Restore local stock.
         * DRIP tidak pernah mengurangi local stock.
         */
        if (!prepared.isDrip) {
          await tx.execute(sql`
            UPDATE product_options
            SET stock = stock + 1
            WHERE id = ${prepared.option.id}
          `);
        }

        await tx.execute(sql`
          UPDATE wallet_transactions
          SET status = 'REFUNDED'
          WHERE reference = ${prepared.order.invoice}
            AND status = 'PENDING'
        `);

        await tx
          .update(ordersTable)
          .set({
            status: "CANCELLED",
          })
          .where(
            and(
              eq(ordersTable.id, prepared.order.id),
              eq(ordersTable.status, "PENDING"),
            ),
          );

        if (prepared.promoId !== null) {
          await rollbackPromoUsage(tx, {
            promoId: prepared.promoId,
            userId: acc.userId,
            orderId: prepared.order.id,
          });
        }
      });

      if (error instanceof HttpError) {
        throw error;
      }

      throw new HttpError(
        502,
        error instanceof Error
          ? error.message
          : "Pembelian gagal. Saldo sudah dikembalikan.",
      );
    }
}

router.post(
  "/reseller/orders",
  requireReseller,
  h(createResellerOrder),
);

router.post(
  "/reseller/v1/orders",
  requireResellerApi,
  h(createResellerOrder),
);

router.get("/reseller/v1/orders/:id", requireResellerApi, h(async (req, res) => {
  const acc = (req as any).reseller;
  const orderId = Number(req.params.id);

  if (!Number.isInteger(orderId) || orderId <= 0) {
    throw new HttpError(400, "Order ID tidak valid");
  }

  const tag = `reseller:${acc.username}`;

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.id, orderId),
        eq(ordersTable.whatsapp, tag),
      ),
    )
    .limit(1);

  if (!order) {
    throw new HttpError(404, "Order tidak ditemukan");
  }

  return res.json({
    success: true,
    order,
  });
}));

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

router.post(
  "/admin/resellers/manual",
  requireAdmin,
  h(async (req, res) => {
    const email =
      typeof req.body.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";

    const duration = typeof req.body.duration === "string"
      ? req.body.duration
      : "";

    const allowedDays: Record<string, number> = {
      "1": 1,
      "3": 3,
      "7": 7,
      "10": 10,
      "15": 15,
      "30": 30,
    };

    if (!email || !email.includes("@")) {
      throw new HttpError(400, "Email user tidak valid");
    }

    if (duration !== "lifetime" && !allowedDays[duration]) {
      throw new HttpError(400, "Durasi reseller tidak valid");
    }

    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      throw new HttpError(500, "CLERK_SECRET_KEY belum dikonfigurasi di server");
    }

    const clerk = createClerkClient({ secretKey });

    const result = await clerk.users.getUserList({
      limit: 100,
      query: email,
    });

    const user = result.data.find((u) =>
      u.emailAddresses.some(
        (item) => item.emailAddress.toLowerCase() === email,
      ),
    );

    if (!user) {
      throw new HttpError(404, "User dengan email tersebut tidak ditemukan");
    }

    const [existing] = rowsOf(
      await db.execute(sql`
        SELECT id, user_id, plan, expires_at, username, active
        FROM reseller_members
        WHERE user_id = ${user.id}
        LIMIT 1
      `),
    );

    if (duration === "lifetime") {
      if (existing) {
        await db.execute(sql`
          UPDATE reseller_members
          SET plan = 'lifetime',
              expires_at = NULL,
              active = TRUE
          WHERE id = ${existing.id}
        `);
      } else {
        await db.execute(sql`
          INSERT INTO reseller_members
            (user_id, plan, expires_at, active)
          VALUES
            (${user.id}, 'lifetime', NULL, TRUE)
        `);
      }

      return res.json({
        ok: true,
        userId: user.id,
        email,
        duration: "lifetime",
      });
    }

    const days = allowedDays[duration];
    const base = existing?.expires_at &&
      new Date(existing.expires_at).getTime() > Date.now()
      ? new Date(existing.expires_at)
      : new Date();

    base.setUTCDate(base.getUTCDate() + days);

    if (existing) {
      await db.execute(sql`
        UPDATE reseller_members
        SET plan = ${`${days}_days`},
            expires_at = ${base.toISOString()}::timestamptz,
            active = TRUE
        WHERE id = ${existing.id}
      `);
    } else {
      await db.execute(sql`
        INSERT INTO reseller_members
          (user_id, plan, expires_at, active)
        VALUES
          (${user.id}, ${`${days}_days`}, ${base.toISOString()}::timestamptz, TRUE)
      `);
    }

    return res.json({
      ok: true,
      userId: user.id,
      email,
      duration: days,
      expiresAt: base.toISOString(),
    });
  }),
);

router.post(
  "/admin/resellers/giveaway",
  requireAdmin,
  h(async (req, res) => {
    const duration = String(req.body.duration || "30");

    const allowedDays: Record<string, number> = {
      "1": 1,
      "3": 3,
      "7": 7,
      "10": 10,
      "15": 15,
      "30": 30,
    };

    if (duration !== "lifetime" && !allowedDays[duration]) {
      throw new HttpError(400, "Durasi reseller tidak valid");
    }

    const userId = `giveaway_${crypto.randomBytes(12).toString("hex")}`;

    const username = `zhuu_${crypto.randomBytes(4).toString("hex")}`;
    const password = crypto.randomBytes(6).toString("base64url");

    const passwordHash = hashPassword(password);

    let expiresIso: string | null = null;
    let plan = "lifetime";

    if (duration !== "lifetime") {
      const days = allowedDays[duration];
      plan = `${days}_days`;

      const expires = new Date();
      expires.setUTCDate(expires.getUTCDate() + days);
      expiresIso = expires.toISOString();
    }

    await db.execute(sql`
      INSERT INTO reseller_members
        (user_id, plan, expires_at, username, password_hash, active)
      VALUES
        (
          ${userId},
          ${plan},
          ${expiresIso}::timestamptz,
          ${username},
          ${passwordHash},
          TRUE
        )
    `);

    return res.json({
      ok: true,
      username,
      password,
      duration,
      expiresAt: expiresIso,
    });
  }),
);

router.get(
  "/admin/resellers",
  requireAdmin,
  h(async (_req, res) => {
    const rows = rowsOf(
      await db.execute(sql`
        SELECT
          id,
          plan,
          expires_at,
          username,
          active,
          created_at,
          wallet_email,
          wallet_username
        FROM reseller_members
        ORDER BY id DESC
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
