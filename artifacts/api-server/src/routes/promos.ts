import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireAdmin } from "../lib/auth.js";

const router = Router();

router.get("/admin/promos", requireAdmin, async (_req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT
        id,
        code,
        audience,
        discount_amount,
        expires_at,
        max_uses,
        used_count,
        active,
        created_at
      FROM promo_codes
      ORDER BY created_at DESC, id DESC
    `);

    return res.json((result as any).rows ?? []);
  } catch (error) {
    console.error("GET /admin/promos error:", error);
    return res.status(500).json({ error: "Gagal mengambil data promo" });
  }
});

router.post("/admin/promos", requireAdmin, async (req, res) => {
  try {
    const code = String(req.body.code || "").trim().toUpperCase();
    const audience =
      String(req.body.audience || "MEMBER").toUpperCase();
    const discountAmount = Number(req.body.discountAmount);
    const maxUses =
      req.body.maxUses === "" ||
      req.body.maxUses === null ||
      req.body.maxUses === undefined
        ? null
        : Number(req.body.maxUses);
    const expiresAt = req.body.expiresAt
      ? new Date(req.body.expiresAt)
      : null;
    const active = req.body.active !== false;

    if (!code) {
      return res.status(400).json({ error: "Kode promo wajib diisi" });
    }

    if (!["MEMBER", "RESELLER"].includes(audience)) {
      return res.status(400).json({ error: "Audience tidak valid" });
    }

    if (!Number.isFinite(discountAmount) || discountAmount <= 0) {
      return res.status(400).json({ error: "Diskon harus lebih dari 0" });
    }

    if (
      maxUses !== null &&
      (!Number.isInteger(maxUses) || maxUses <= 0)
    ) {
      return res.status(400).json({
        error: "Maksimal penggunaan harus bilangan bulat lebih dari 0",
      });
    }

    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      return res.status(400).json({ error: "Tanggal expired tidak valid" });
    }

    const result = await db.execute(sql`
      INSERT INTO promo_codes
        (code, audience, discount_amount, expires_at, max_uses, active)
      VALUES
        (
          ${code},
          ${audience},
          ${discountAmount},
          ${expiresAt},
          ${maxUses},
          ${active}
        )
      RETURNING *
    `);

    return res.status(201).json((result as any).rows?.[0]);
  } catch (error: any) {
    if (error?.code === "23505") {
      return res.status(400).json({
        error: "Kode promo tersebut sudah ada untuk audience ini",
      });
    }

    console.error("POST /admin/promos error:", error);
    return res.status(500).json({ error: "Gagal membuat promo" });
  }
});

router.patch("/admin/promos/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "ID promo tidak valid" });
    }

    const code = String(req.body.code || "").trim().toUpperCase();
    const audience =
      String(req.body.audience || "MEMBER").toUpperCase();
    const discountAmount = Number(req.body.discountAmount);
    const maxUses =
      req.body.maxUses === "" ||
      req.body.maxUses === null ||
      req.body.maxUses === undefined
        ? null
        : Number(req.body.maxUses);
    const expiresAt = req.body.expiresAt
      ? new Date(req.body.expiresAt)
      : null;
    const active = req.body.active !== false;

    if (!code) {
      return res.status(400).json({ error: "Kode promo wajib diisi" });
    }

    if (!["MEMBER", "RESELLER"].includes(audience)) {
      return res.status(400).json({ error: "Audience tidak valid" });
    }

    if (!Number.isFinite(discountAmount) || discountAmount <= 0) {
      return res.status(400).json({ error: "Diskon harus lebih dari 0" });
    }

    if (
      maxUses !== null &&
      (!Number.isInteger(maxUses) || maxUses <= 0)
    ) {
      return res.status(400).json({
        error: "Maksimal penggunaan harus bilangan bulat lebih dari 0",
      });
    }

    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      return res.status(400).json({ error: "Tanggal expired tidak valid" });
    }

    const result = await db.execute(sql`
      UPDATE promo_codes
      SET
        code = ${code},
        audience = ${audience},
        discount_amount = ${discountAmount},
        expires_at = ${expiresAt},
        max_uses = ${maxUses},
        active = ${active}
      WHERE id = ${id}
      RETURNING *
    `);

    const row = (result as any).rows?.[0];

    if (!row) {
      return res.status(404).json({ error: "Promo tidak ditemukan" });
    }

    return res.json(row);
  } catch (error: any) {
    if (error?.code === "23505") {
      return res.status(400).json({
        error: "Kode promo tersebut sudah ada untuk audience ini",
      });
    }

    console.error("PATCH /admin/promos error:", error);
    return res.status(500).json({ error: "Gagal mengubah promo" });
  }
});

router.delete("/admin/promos/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "ID promo tidak valid" });
    }

    await db.transaction(async (tx) => {
      await tx.execute(sql`
        DELETE FROM promo_code_usages
        WHERE promo_code_id = ${id}
      `);

      const result = await tx.execute(sql`
        DELETE FROM promo_codes
        WHERE id = ${id}
        RETURNING id
      `);

      if (!(result as any).rows?.length) {
        throw new Error("PROMO_NOT_FOUND");
      }
    });

    return res.json({ success: true });
  } catch (error: any) {
    if (error instanceof Error && error.message === "PROMO_NOT_FOUND") {
      return res.status(404).json({ error: "Promo tidak ditemukan" });
    }

    console.error("DELETE /admin/promos error:", error);
    return res.status(500).json({ error: "Gagal menghapus promo" });
  }
});

export default router;
