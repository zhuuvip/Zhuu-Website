import { sql } from "drizzle-orm";

export type PromoAudience = "MEMBER" | "RESELLER";

export async function applyPromo(
  tx: any,
  {
    code,
    audience,
    userId,
    basePrice,
  }: {
    code?: string | null;
    audience: PromoAudience;
    userId: string;
    basePrice: number;
  },
) {
  const normalizedCode = String(code || "").trim().toUpperCase();

  if (!normalizedCode) {
    return {
      promo: null,
      discount: 0,
      finalPrice: basePrice,
    };
  }

  const promoRows = await tx.execute(sql`
    SELECT *
    FROM promo_codes
    WHERE UPPER(code) = ${normalizedCode}
      AND audience = ${audience}
      AND active = TRUE
    LIMIT 1
    FOR UPDATE
  `);

  const promo = (promoRows as any).rows?.[0];

  if (!promo) {
    throw new Error("Kode promo tidak valid atau tidak tersedia");
  }

  if (promo.expires_at && new Date(promo.expires_at).getTime() < Date.now()) {
    throw new Error("Kode promo sudah expired");
  }

  if (
    promo.max_uses !== null &&
    Number(promo.used_count) >= Number(promo.max_uses)
  ) {
    throw new Error("Kuota kode promo sudah habis");
  }

  const usedRows = await tx.execute(sql`
    SELECT id
    FROM promo_code_usages
    WHERE promo_code_id = ${Number(promo.id)}
      AND user_id = ${userId}
    LIMIT 1
  `);

  if ((usedRows as any).rows?.length > 0) {
    throw new Error("Kamu sudah pernah menggunakan kode promo ini");
  }

  const discount = Math.min(
    Math.max(0, Number(promo.discount_amount) || 0),
    Math.max(0, basePrice),
  );

  const finalPrice = Math.max(0, basePrice - discount);

  return {
    promo: {
      id: Number(promo.id),
      code: String(promo.code),
    },
    discount,
    finalPrice,
  };
}

export async function recordPromoUsage(
  tx: any,
  {
    promoId,
    userId,
    audience,
    orderId,
    discount,
  }: {
    promoId: number;
    userId: string;
    audience: PromoAudience;
    orderId: number;
    discount: number;
  },
) {
  await tx.execute(sql`
    INSERT INTO promo_code_usages
      (promo_code_id, user_id, audience, order_id, discount_amount)
    VALUES
      (
        ${promoId},
        ${userId},
        ${audience},
        ${orderId},
        ${discount}
      )
  `);

  await tx.execute(sql`
    UPDATE promo_codes
    SET used_count = used_count + 1
    WHERE id = ${promoId}
  `);
}

export async function rollbackPromoUsage(
  tx: any,
  {
    promoId,
    userId,
    orderId,
  }: {
    promoId: number;
    userId: string;
    orderId: number;
  },
) {
  const deleted = await tx.execute(sql`
    DELETE FROM promo_code_usages
    WHERE promo_code_id = ${promoId}
      AND user_id = ${userId}
      AND order_id = ${orderId}
  `);

  const deletedRows = Number(
    (deleted as any).rowCount ??
      (deleted as any).rows?.length ??
      0,
  );

  if (deletedRows > 0) {
    await tx.execute(sql`
      UPDATE promo_codes
      SET used_count = GREATEST(used_count - 1, 0)
      WHERE id = ${promoId}
    `);
  }
}
