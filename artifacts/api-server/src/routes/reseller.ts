import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { db } from "@workspace/db";
import { productsTable, productOptionsTable, ordersTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import { requireAdmin } from "../lib/auth.js";

const router = Router();
const rowsOf = (r: any): any[] => r?.rows ?? r ?? [];

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let tablesReady: Promise<void> | null = null;
export function ensureResellerTables(): Promise<void> {
  if (!tablesReady) {
    tablesReady = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS reseller_accounts (
          id SERIAL PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          balance INTEGER NOT NULL DEFAULT 0,
          active BOOLEAN NOT NULL DEFAULT TRUE,
          note TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS reseller_prices (
          option_id INTEGER PRIMARY KEY,
          price INTEGER NOT NULL
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
function signToken(id: number) {
  const body = Buffer.from(
    JSON.stringify({ id, exp: Date.now() + 7 * 24 * 3600 * 1000 }),
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}
function readToken(token: string): number | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(body));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    if (typeof p.id !== "number" || p.exp < Date.now()) return null;
    return p.id;
  } catch {
    return null;
  }
}

/* ---------- helper akun (dipakai juga oleh orders.ts) ---------- */
export async function createResellerAccount(
  ex: any = db,
  opts: { username?: string; password?: string; balance?: number; note?: string } = {},
) {
  await ensureResellerTables();
  const password = opts.password || crypto.randomBytes(8).toString("base64url");
  for (let i = 0; i < 5; i++) {
    const username = (opts.username || `rs${crypto.randomBytes(3).toString("hex")}`).toLowerCase();
    const r = await ex.execute(sql`
      INSERT INTO reseller_accounts (username, password_hash, balance, note)
      VALUES (${username}, ${hashPassword(password)}, ${opts.balance ?? 0}, ${opts.note ?? null})
      ON CONFLICT (username) DO NOTHING
      RETURNING id, username
    `);
    const row = rowsOf(r)[0];
    if (row) return { id: row.id as number, username: row.username as string, password };
    if (opts.username) throw new HttpError(400, "Username sudah dipakai");
  }
  throw new Error("Gagal membuat username unik");
}

/* ---------- util ---------- */
const h =
  (fn: (req: Request, res: Response) => Promise<any>) =>
  async (req: Request, res: Response) => {
    try {
      await ensureResellerTables();
      await fn(req, res);
    } catch (e) {
      if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
      console.error(e);
      return res.status(500).json({ error: "Terjadi kesalahan server" });
    }
  };

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
    const id = token ? readToken(token) : null;
    if (!id) return res.status(401).json({ error: "Login reseller diperlukan" });
    const rows = rowsOf(
      await db.execute(sql`SELECT id, username, balance, active FROM reseller_accounts WHERE id = ${id}`),
    );
    if (!rows[0] || !rows[0].active) {
      return res.status(401).json({ error: "Akun reseller tidak aktif" });
    }
    (req as any).reseller = rows[0];
    next();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
}

/* ================= RESELLER ================= */
router.post(
  "/reseller/login",
  h(async (req, res) => {
    const ip = String(req.headers["x-forwarded-for"] || req.ip || "x").split(",")[0].trim();
    if (tooMany(ip)) throw new HttpError(429, "Terlalu banyak percobaan, coba lagi 15 menit lagi");

    const username = String(req.body.username || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const acc = rowsOf(
      await db.execute(sql`SELECT * FROM reseller_accounts WHERE username = ${username}`),
    )[0];

    if (!acc || !acc.active || !verifyPassword(password, acc.password_hash)) {
      throw new HttpError(401, "Username atau password salah");
    }
    attempts.delete(ip);
    return res.json({ token: signToken(acc.id), username: acc.username, balance: acc.balance });
  }),
);

router.get("/reseller/me", requireReseller, (req, res) => {
  const a = (req as any).reseller;
  res.json({ username: a.username, balance: a.balance });
});

router.get(
  "/reseller/products",
  requireReseller,
  h(async (_req, res) => {
    const products = await db.select().from(productsTable);
    const options = await db.select().from(productOptionsTable);
    const prices = rowsOf(await db.execute(sql`SELECT option_id, price FROM reseller_prices`));
    const map = new Map<number, number>(prices.map((p) => [Number(p.option_id), Number(p.price)]));

    return res.json(
      products.map((p: any) => {
        const { deliveryValue, ...safe } = p;
        return {
          ...safe,
          options: options
            .filter((o) => o.productId === p.id)
            .map((o) => ({
              ...o,
              normalPrice: o.price,
              price: map.get(o.id) ?? o.price,
              hasResellerPrice: map.has(o.id),
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
    const wa = req.body.whatsapp ? String(req.body.whatsapp).slice(0, 30) : "";

    const result = await db.transaction(async (tx) => {
      const [product] = await tx.select().from(productsTable).where(eq(productsTable.id, productId));
      const [option] = await tx
        .select()
        .from(productOptionsTable)
        .where(eq(productOptionsTable.id, optionId));

      if (!product || !option || option.productId !== product.id) {
        throw new HttpError(400, "Produk atau durasi tidak valid");
      }
      if (product.deliveryType === "RESELLER") {
        throw new HttpError(400, "Produk ini tidak tersedia untuk reseller");
      }
      if (option.stock <= 0) throw new HttpError(400, "Stok habis");

      const pr = rowsOf(
        await tx.execute(sql`SELECT price FROM reseller_prices WHERE option_id = ${option.id}`),
      )[0];
      const price = pr ? Number(pr.price) : option.price;

      let deliveryKey: string | null = null;
      let deliveryLink: string | null = null;

      if (product.deliveryType === "KEY") {
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
          UPDATE reseller_accounts SET balance = balance - ${price}
          WHERE id = ${acc.id} AND active = TRUE AND balance >= ${price}
          RETURNING balance
        `),
      )[0];
      if (!debit) throw new HttpError(400, "Saldo reseller tidak cukup");

      const stockRow = rowsOf(
        await tx.execute(sql`
          UPDATE product_options SET stock = stock - 1
          WHERE id = ${option.id} AND stock > 0 RETURNING id
        `),
      )[0];
      if (!stockRow) throw new HttpError(400, "Stok habis, coba lagi");

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
          whatsapp: `reseller:${acc.username}` + (wa ? ` | ${wa}` : ""),
          status: "PAID",
          paymentRef: deliveryKey || deliveryLink || null,
        })
        .returning();

      return { order, deliveryKey, deliveryLink, balance: Number(debit.balance) };
    });

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
      .where(sql`(${ordersTable.whatsapp} = ${tag} OR ${ordersTable.whatsapp} LIKE ${tag + " |%"})`)
      .orderBy(desc(ordersTable.createdAt));
    return res.json(rows);
  }),
);

/* ================= ADMIN ================= */
router.get(
  "/admin/resellers",
  requireAdmin,
  h(async (_req, res) => {
    const rows = rowsOf(
      await db.execute(sql`
        SELECT id, username, balance, active, note, created_at
        FROM reseller_accounts ORDER BY id DESC
      `),
    );
    return res.json(rows);
  }),
);

router.post(
  "/admin/resellers",
  requireAdmin,
  h(async (req, res) => {
    const username = req.body.username ? String(req.body.username).trim().toLowerCase() : undefined;
    const password = req.body.password ? String(req.body.password) : undefined;
    if (username && !/^[a-z0-9]{3,24}$/.test(username)) {
      throw new HttpError(400, "Username hanya huruf kecil/angka, 3-24 karakter");
    }
    if (password && password.length < 6) throw new HttpError(400, "Password minimal 6 karakter");

    const acc = await createResellerAccount(db, {
      username,
      password,
      balance: Math.max(0, Math.trunc(Number(req.body.balance) || 0)),
      note: req.body.note ? String(req.body.note) : undefined,
    });
    // password hanya ditampilkan SEKALI di response ini
    return res.json({ id: acc.id, username: acc.username, password: acc.password });
  }),
);

router.patch(
  "/admin/resellers/:id",
  requireAdmin,
  h(async (req, res) => {
    const id = Number(req.params.id);
    const b = req.body;

    if (typeof b.active === "boolean") {
      await db.execute(sql`UPDATE reseller_accounts SET active = ${b.active} WHERE id = ${id}`);
    }
    if (b.note !== undefined) {
      await db.execute(sql`UPDATE reseller_accounts SET note = ${String(b.note)} WHERE id = ${id}`);
    }
    if (b.password) {
      if (String(b.password).length < 6) throw new HttpError(400, "Password minimal 6 karakter");
      await db.execute(
        sql`UPDATE reseller_accounts SET password_hash = ${hashPassword(String(b.password))} WHERE id = ${id}`,
      );
    }
    if (b.addBalance !== undefined) {
      const n = Math.trunc(Number(b.addBalance));
      if (!Number.isFinite(n)) throw new HttpError(400, "Nominal saldo tidak valid");
      const r = rowsOf(
        await db.execute(sql`
          UPDATE reseller_accounts SET balance = balance + ${n}
          WHERE id = ${id} AND balance + ${n} >= 0 RETURNING id
        `),
      );
      if (!r[0]) throw new HttpError(400, "Saldo tidak boleh minus");
    }
    return res.json({ ok: true });
  }),
);

router.delete(
  "/admin/resellers/:id",
  requireAdmin,
  h(async (req, res) => {
    await db.execute(sql`DELETE FROM reseller_accounts WHERE id = ${Number(req.params.id)}`);
    return res.json({ ok: true });
  }),
);

router.get(
  "/admin/reseller-prices",
  requireAdmin,
  h(async (_req, res) => {
    return res.json(rowsOf(await db.execute(sql`SELECT option_id, price FROM reseller_prices`)));
  }),
);

// kirim price kosong/null untuk menghapus harga reseller (kembali ke harga normal)
router.put(
  "/admin/reseller-prices/:optionId",
  requireAdmin,
  h(async (req, res) => {
    const optionId = Number(req.params.optionId);
    const raw = req.body.price;
    if (raw === null || raw === "" || raw === undefined) {
      await db.execute(sql`DELETE FROM reseller_prices WHERE option_id = ${optionId}`);
      return res.json({ ok: true, price: null });
    }
    const price = Math.trunc(Number(raw));
    if (!Number.isFinite(price) || price < 0) throw new HttpError(400, "Harga tidak valid");
    await db.execute(sql`
      INSERT INTO reseller_prices (option_id, price) VALUES (${optionId}, ${price})
      ON CONFLICT (option_id) DO UPDATE SET price = EXCLUDED.price
    `);
    return res.json({ ok: true, price });
  }),
);

export default router;
