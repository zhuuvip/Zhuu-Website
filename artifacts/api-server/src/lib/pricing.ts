/**
 * AUTO PRICE CALCULATOR
 * =====================
 * Satu-satunya tempat perhitungan harga jual produk DRIP/CIT.
 * Modul ini murni (tanpa DB / network / import), sehingga mudah diuji.
 *
 * Alur:
 *   1. parseDuration()         label durasi apa pun  -> total jam
 *   2. calculatePrices()       modal + durasi        -> harga reseller & member (per varian)
 *   3. priceProductVariants()  semua varian 1 produk -> harga + pengecekan konsistensi antar durasi
 *
 * Rumus per varian (untuk reseller DAN member, parameter berbeda):
 *
 *     profit = max( minProfit(durasi), modal * markup(durasi) )
 *     harga  = ceil1000( modal + profit )
 *
 * `minProfit` dan `markup` TIDAK hardcode per durasi. Keduanya diinterpolasi (skala log-jam)
 * dari beberapa titik jangkar (ANCHORS), sehingga durasi apa pun (2h, 5d, 14d, 31d, ...)
 * mendapat parameter yang mulus, tanpa lompatan tier.
 *
 * Karakter kurva (inilah yang menghilangkan harga absurd "1h = 7k, 3h = 21k"):
 *   - minProfit naik PELAN (cekung)  -> profit per jam / per hari makin kecil untuk durasi panjang
 *   - markup % turun saat durasi naik -> durasi panjang lebih efisien, produk mahal tetap sehat
 *
 * Catatan istilah:
 *   - markup  = profit / modal          (dipakai di config)
 *   - margin  = profit / harga jual     (dilaporkan di hasil)
 */

/* ------------------------------------------------------------------ */
/* Tipe                                                                */
/* ------------------------------------------------------------------ */

export type DurationTier = "HOURLY" | "DAILY" | "WEEKLY" | "MONTHLY" | "UNKNOWN";

export interface ParsedDuration {
  /** Teks asli dari DRIP. */
  raw: string;
  /** Total jam, atau null jika label bukan durasi waktu (mis. "Permanent", "Premium"). */
  hours: number | null;
  /** Total hari (hours / 24), atau null. */
  days: number | null;
  /** Label ringkas ter-normalisasi, mis. "3h", "7d". "?" jika tidak dikenali. */
  label: string;
  tier: DurationTier;
}

export interface PriceInput {
  /** Harga modal DRIP dalam Rupiah. */
  modal: number;
  /** Label durasi, mis. "3 Hours", "7 Day", "24 Hours (1 Day)". */
  duration: string;
  /** Opsional, hanya dipakai untuk pesan warning. */
  productName?: string;
  /** Opsional, hanya dipakai untuk pesan warning. */
  category?: string;
}

export interface PriceResult {
  modalPrice: number;
  resellerPrice: number;
  memberPrice: number;
  resellerProfit: number;
  memberProfit: number;
  /** profit / harga jual (0..1) */
  resellerMargin: number;
  /** profit / harga jual (0..1) */
  memberMargin: number;
  tier: DurationTier;
  hours: number | null;
  /** Pesan koreksi/peringatan dari validasi (kosong jika semuanya normal). */
  warnings: string[];
}

export interface PricingWarning {
  duration: string;
  code: string;
  message: string;
}

/* ------------------------------------------------------------------ */
/* Konfigurasi (satu tempat untuk tuning)                              */
/* ------------------------------------------------------------------ */

interface Anchor {
  hours: number;
  /** markup reseller (profit / modal) */
  resMarkup: number;
  /** profit minimum reseller (Rp) */
  resMin: number;
  /** markup member (profit / modal) */
  memMarkup: number;
  /** profit minimum member (Rp) */
  memMin: number;
}

/**
 * Titik jangkar. Dikalibrasi dari 165 varian di katalog DRIP lama
 * (data/dripCatalog.ts): profit lama reseller ~4k @1d, ~10k @7d, ~16k @15d, ~20k @30d.
 * Di antara dua titik nilai diinterpolasi (log-jam), di luar rentang di-clamp.
 */
const ANCHORS: readonly Anchor[] = [
  { hours: 1, resMarkup: 0.3, resMin: 3500, memMarkup: 0.55, memMin: 5500 },
  { hours: 3, resMarkup: 0.28, resMin: 3600, memMarkup: 0.5, memMin: 5600 },
  { hours: 6, resMarkup: 0.26, resMin: 3700, memMarkup: 0.46, memMin: 6000 },
  { hours: 12, resMarkup: 0.24, resMin: 3800, memMarkup: 0.42, memMin: 6800 },
  { hours: 24, resMarkup: 0.22, resMin: 4000, memMarkup: 0.38, memMin: 7000 },
  { hours: 72, resMarkup: 0.18, resMin: 4500, memMarkup: 0.32, memMin: 9500 },
  { hours: 168, resMarkup: 0.15, resMin: 10000, memMarkup: 0.27, memMin: 15000 },
  { hours: 240, resMarkup: 0.13, resMin: 12500, memMarkup: 0.24, memMin: 18500 },
  { hours: 360, resMarkup: 0.12, resMin: 16000, memMarkup: 0.22, memMin: 24000 },
  { hours: 720, resMarkup: 0.11, resMin: 20000, memMarkup: 0.2, memMin: 28000 },
];

/** Jam yang dipakai untuk label non-waktu ("Permanent", "Premium", "1 Basic"). */
const UNKNOWN_DURATION_HOURS = 168;

export const PRICING_CONFIG = {
  roundTo: 1000,
  /**
   * Efisiensi durasi: harga durasi lebih panjang tidak boleh melebihi
   *   harga_sebelumnya * (jam_baru / jam_sebelumnya) ^ exponent
   * exponent < 1  =>  harga PER JAM / PER HARI selalu turun saat durasi naik.
   */
  ladderExponent: 0.9,
  /** Kenaikan minimum antar durasi yang berdekatan. */
  ladderMinStep: 1000,
  /**
   * Batas bawah mutlak (tidak boleh dilanggar oleh diskon durasi):
   *   harga >= modal + max(hardMinProfitAbs, modal * hardMinProfitPct)
   */
  hardMinProfitAbs: 1000,
  hardMinProfitPct: 0.06,
  /** Selisih minimum member di atas reseller. */
  gapAbs: 1000,
  gapPct: 0.03,
} as const;

/* ------------------------------------------------------------------ */
/* Util                                                                */
/* ------------------------------------------------------------------ */

/** Pembulatan ke atas ke kelipatan 1.000 (tahan error floating point). */
export function ceilToStep(value: number, step: number = PRICING_CONFIG.roundTo): number {
  const clean = Math.round(value * 100) / 100;
  return Math.ceil(clean / step) * step;
}

function floorToStep(value: number, step: number = PRICING_CONFIG.roundTo): number {
  const clean = Math.round(value * 100) / 100;
  return Math.floor(clean / step) * step;
}

function interpolate(hours: number, pick: (a: Anchor) => number): number {
  const first = ANCHORS[0];
  const last = ANCHORS[ANCHORS.length - 1];
  if (hours <= first.hours) return pick(first);
  if (hours >= last.hours) return pick(last);

  for (let i = 1; i < ANCHORS.length; i++) {
    const hi = ANCHORS[i];
    if (hours <= hi.hours) {
      const lo = ANCHORS[i - 1];
      const t = Math.log(hours / lo.hours) / Math.log(hi.hours / lo.hours);
      return pick(lo) + (pick(hi) - pick(lo)) * t;
    }
  }
  return pick(last);
}

function tierOf(hours: number | null): DurationTier {
  if (hours === null) return "UNKNOWN";
  if (hours < 24) return "HOURLY";
  if (hours < 168) return "DAILY";
  if (hours < 720) return "WEEKLY";
  return "MONTHLY";
}

/* ------------------------------------------------------------------ */
/* 1. Parser durasi                                                    */
/* ------------------------------------------------------------------ */

function unitToHours(word: string): number | null {
  const w = word.toLowerCase();
  if (/^(h|hr|hrs|hour|hours|jam)$/.test(w)) return 1;
  if (/^(d|dy|day|days|daya|hari)$/.test(w)) return 24;
  if (/^(w|wk|wks|week|weeks|minggu)$/.test(w)) return 168;
  if (/^(mo|mos|month|months|bulan)$/.test(w)) return 720;
  if (/^(y|yr|yrs|year|years|yer|yers|tahun)$/.test(w)) return 8760;
  return null;
}

/**
 * Mengubah label durasi apa pun menjadi total jam.
 *
 * Contoh: "1h"->1, "3 Hours"->3, "1Day"->24, "7 Daya"->168, "30day"->720,
 *         "24 Hours (1 Day)"->24 (angka+unit pertama menang), "Certificate 1 Yers"->8760,
 *         "Permanent"->null.
 *
 * Sengaja TIDAK memakai /(\d+)/ saja: itu membuat "3h" terbaca "3 hari".
 */
export function parseDuration(input: unknown): ParsedDuration {
  const raw = typeof input === "string" ? input : input == null ? "" : String(input);
  const re = /(\d+(?:[.,]\d+)?)[\s\-_]*([a-zA-Z]+)/g;

  let match: RegExpExecArray | null;
  while ((match = re.exec(raw)) !== null) {
    const factor = unitToHours(match[2]);
    if (factor === null) continue;

    const amount = Number(match[1].replace(",", "."));
    const hours = amount * factor;

    if (Number.isFinite(hours) && hours > 0) {
      const label =
        hours >= 24 && hours % 24 === 0 ? `${hours / 24}d` : `${Number(hours.toFixed(2))}h`;
      return { raw, hours, days: hours / 24, label, tier: tierOf(hours) };
    }
  }

  return { raw, hours: null, days: null, label: "?", tier: "UNKNOWN" };
}

/* ------------------------------------------------------------------ */
/* 2. Kalkulator per varian                                            */
/* ------------------------------------------------------------------ */

function hardFloor(modal: number): number {
  const { hardMinProfitAbs, hardMinProfitPct } = PRICING_CONFIG;
  return ceilToStep(modal + Math.max(hardMinProfitAbs, modal * hardMinProfitPct));
}

function minGap(modal: number): number {
  const { gapAbs, gapPct } = PRICING_CONFIG;
  return ceilToStep(Math.max(gapAbs, modal * gapPct));
}

/**
 * Harga satu varian dari modal-nya sendiri.
 * Untuk konsistensi antar durasi dalam satu produk, pakai priceProductVariants().
 */
export function calculatePrices(input: PriceInput): PriceResult {
  const modal = Number(input.modal);
  if (!Number.isFinite(modal) || modal <= 0) {
    throw new Error(`Modal tidak valid: ${String(input.modal)}`);
  }

  const parsed = parseDuration(input.duration);
  const hours = parsed.hours ?? UNKNOWN_DURATION_HOURS;
  const warnings: string[] = [];

  if (parsed.hours === null) {
    warnings.push(
      `Durasi "${parsed.raw}" bukan durasi waktu; memakai margin setara ${UNKNOWN_DURATION_HOURS} jam.`,
    );
  }

  const resProfit = Math.max(
    interpolate(hours, (a) => a.resMin),
    modal * interpolate(hours, (a) => a.resMarkup),
  );
  const memProfit = Math.max(
    interpolate(hours, (a) => a.memMin),
    modal * interpolate(hours, (a) => a.memMarkup),
  );

  let resellerPrice = ceilToStep(modal + resProfit);
  let memberPrice = ceilToStep(modal + memProfit);

  return finalizeSingle(
    modal,
    parsed,
    resellerPrice,
    memberPrice,
    warnings,
    input.productName,
  );
}

/** Menjamin invarian dasar: modal < reseller < member dan margin positif. */
function finalizeSingle(
  modal: number,
  parsed: ParsedDuration,
  resellerPrice: number,
  memberPrice: number,
  warnings: string[],
  productName?: string,
): PriceResult {
  const where = productName ? `${productName} [${parsed.raw}]` : `[${parsed.raw}]`;
  const floor = hardFloor(modal);

  if (resellerPrice < floor) {
    warnings.push(`${where}: harga reseller di bawah batas minimum, dikoreksi ke ${floor}.`);
    resellerPrice = floor;
  }

  const minMember = resellerPrice + minGap(modal);
  if (memberPrice < minMember) {
    warnings.push(`${where}: harga member <= reseller, dikoreksi ke ${minMember}.`);
    memberPrice = minMember;
  }

  return buildResult(modal, parsed, resellerPrice, memberPrice, warnings);
}

function buildResult(
  modal: number,
  parsed: ParsedDuration,
  resellerPrice: number,
  memberPrice: number,
  warnings: string[],
): PriceResult {
  const resellerProfit = resellerPrice - modal;
  const memberProfit = memberPrice - modal;
  return {
    modalPrice: Math.round(modal),
    resellerPrice,
    memberPrice,
    resellerProfit: Math.round(resellerProfit),
    memberProfit: Math.round(memberProfit),
    resellerMargin: resellerPrice > 0 ? resellerProfit / resellerPrice : 0,
    memberMargin: memberPrice > 0 ? memberProfit / memberPrice : 0,
    tier: parsed.tier,
    hours: parsed.hours,
    warnings,
  };
}

/* ------------------------------------------------------------------ */
/* 3. Konsistensi antar durasi dalam satu produk                       */
/* ------------------------------------------------------------------ */

type Priced<T> = T & { pricing: PriceResult };

/**
 * Hitung harga SEMUA varian satu produk lalu rapikan antar durasi:
 *   - harga naik seiring durasi (min. +ladderMinStep)
 *   - harga per jam/hari TURUN seiring durasi (diskon durasi alami)
 *   - reseller < member, keduanya > modal
 * Penyesuaian turun tidak pernah menembus batas minimum (hardFloor); jika tertahan,
 * hasilnya diberi warning, bukan dipaksa rugi.
 *
 * Urutan array input dipertahankan.
 */
export function priceProductVariants<T extends { duration: string; modal: number }>(
  variants: readonly T[],
  context: { productName?: string; category?: string } = {},
): Array<Priced<T>> {
  const base = variants.map((variant) =>
    calculatePrices({
      modal: variant.modal,
      duration: variant.duration,
      productName: context.productName,
      category: context.category,
    }),
  );

  // Varian ber-durasi-waktu, diurut naik. Varian non-waktu (Permanent, dst.) tidak ikut tangga.
  const ladder = base
    .map((result, index) => ({ index, hours: result.hours as number | null }))
    .filter((entry): entry is { index: number; hours: number } => entry.hours !== null)
    .sort((a, b) => a.hours - b.hours || a.index - b.index);

  applyLadder(base, variants, ladder, "resellerPrice", context.productName);

  // Member harus tetap di atas reseller setelah reseller disesuaikan.
  for (let i = 0; i < base.length; i++) {
    const result = base[i];
    const need = result.resellerPrice + minGap(result.modalPrice);
    if (result.memberPrice < need) result.memberPrice = need;
  }

  applyLadder(base, variants, ladder, "memberPrice", context.productName, "resellerPrice");

  return variants.map((variant, i) => {
    const r = base[i];
    const parsed = parseDuration(variant.duration);
    const final = buildResult(r.modalPrice, parsed, r.resellerPrice, r.memberPrice, r.warnings);
    return { ...variant, pricing: final };
  });
}

function applyLadder<T extends { duration: string; modal: number }>(
  results: PriceResult[],
  variants: readonly T[],
  ladder: Array<{ index: number; hours: number }>,
  field: "resellerPrice" | "memberPrice",
  productName?: string,
  lowerBoundField?: "resellerPrice",
): void {
  const { ladderExponent, ladderMinStep } = PRICING_CONFIG;
  const tag = productName ? `${productName} ` : "";
  const label = field === "resellerPrice" ? "reseller" : "member";

  for (let i = 1; i < ladder.length; i++) {
    const prev = ladder[i - 1];
    const cur = ladder[i];
    const prevPrice = results[prev.index][field];
    const curRes = results[cur.index];
    const duration = variants[cur.index].duration;
    const prevDuration = variants[prev.index].duration;

    // Batas bawah mutlak untuk varian ini.
    let lowest = hardFloor(curRes.modalPrice);
    if (lowerBoundField) {
      lowest = Math.max(lowest, curRes[lowerBoundField] + minGap(curRes.modalPrice));
    }

    const monotonicMin = prevPrice + ladderMinStep;
    const efficiencyCap = floorToStep(
      prevPrice * Math.pow(cur.hours / prev.hours, ladderExponent),
    );

    let price = curRes[field];

    // 1) Terlalu mahal dibanding durasi sebelumnya -> turunkan sampai batas efisiensi (tidak < lowest).
    if (cur.hours > prev.hours && price > efficiencyCap) {
      const target = Math.max(efficiencyCap, lowest, monotonicMin);
      if (target < price) {
        curRes.warnings.push(
          `${tag}[${duration}] harga ${label} ${price} terlalu tinggi dibanding [${prevDuration}] (${prevPrice}); dikoreksi ke ${target}.`,
        );
        price = target;
      }
    }

    // 2) Tidak lebih mahal dari durasi sebelumnya -> naikkan.
    if (cur.hours > prev.hours && price < monotonicMin) {
      curRes.warnings.push(
        `${tag}[${duration}] harga ${label} ${price} tidak lebih tinggi dari [${prevDuration}] (${prevPrice}); dikoreksi ke ${monotonicMin}.`,
      );
      price = monotonicMin;
    }

    // 3) Durasi sama persis (mis. "1 Day" vs "24 Hours"): jangan dipaksa naik, cukup tidak lebih murah.
    if (cur.hours === prev.hours && price < prevPrice) {
      price = prevPrice;
    }

    // 4) Laporkan jika harga per unit tidak turun karena terhalang batas minimum / langkah minimum.
    if (cur.hours > prev.hours) {
      const perPrev = prevPrice / prev.hours;
      const perCur = price / cur.hours;
      if (perCur >= perPrev) {
        curRes.warnings.push(
          `${tag}[${duration}] harga ${label} per jam (${perCur.toFixed(0)}) belum lebih murah dari [${prevDuration}] (${perPrev.toFixed(0)}); tertahan batas minimum profit.`,
        );
      }
    }

    curRes[field] = price;
  }
}

/* ------------------------------------------------------------------ */
/* 4. Validasi mandiri (untuk test & audit)                            */
/* ------------------------------------------------------------------ */

/**
 * Memeriksa sekumpulan varian satu produk yang sudah dihitung.
 * Mengembalikan daftar masalah (kosong = lolos semua aturan).
 */
export function validatePriceLadder(
  rows: ReadonlyArray<{ duration: string; modal: number; pricing: PriceResult }>,
): PricingWarning[] {
  const issues: PricingWarning[] = [];
  const add = (duration: string, code: string, message: string) =>
    issues.push({ duration, code, message });

  for (const row of rows) {
    const p = row.pricing;
    if (p.resellerPrice <= row.modal) add(row.duration, "RESELLER_LTE_MODAL", "reseller <= modal");
    if (p.memberPrice <= p.resellerPrice) add(row.duration, "MEMBER_LTE_RESELLER", "member <= reseller");
    if (p.resellerProfit <= 0 || p.memberProfit <= 0) add(row.duration, "NON_POSITIVE_PROFIT", "profit <= 0");
    if (p.resellerPrice % PRICING_CONFIG.roundTo !== 0 || p.memberPrice % PRICING_CONFIG.roundTo !== 0) {
      add(row.duration, "NOT_ROUNDED", "harga tidak kelipatan 1.000");
    }
  }

  const timed = rows
    .filter((r) => r.pricing.hours !== null)
    .map((r) => ({ r, hours: r.pricing.hours as number }))
    .sort((a, b) => a.hours - b.hours);

  for (let i = 1; i < timed.length; i++) {
    const a = timed[i - 1];
    const b = timed[i];
    if (b.hours === a.hours) continue;

    for (const field of ["resellerPrice", "memberPrice"] as const) {
      const pa = a.r.pricing[field];
      const pb = b.r.pricing[field];
      if (pb <= pa) {
        add(b.r.duration, "NOT_INCREASING", `${field}: ${b.r.duration}=${pb} <= ${a.r.duration}=${pa}`);
      }
      if (pb / b.hours >= pa / a.hours) {
        add(
          b.r.duration,
          "PER_UNIT_NOT_DECREASING",
          `${field}: harga/jam ${b.r.duration} (${(pb / b.hours).toFixed(0)}) >= ${a.r.duration} (${(pa / a.hours).toFixed(0)})`,
        );
      }
    }
  }

  return issues;
}
