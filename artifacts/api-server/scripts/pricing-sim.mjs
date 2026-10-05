/**
 * Simulasi + self-test + backtest untuk pricing engine.
 *
 *   pnpm --filter @workspace/api-server run pricing:sim
 *   (atau: node scripts/pricing-sim.mjs [--quiet])
 *
 * Exit code 1 jika ada aturan yang dilanggar (aman dipakai di CI).
 * Hanya memakai `esbuild` yang sudah menjadi devDependency api-server.
 */
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const quiet = process.argv.includes("--quiet");

const bundled = await build({
  stdin: {
    contents: `
      export * from "./src/lib/pricing.ts";
      export { DRIP_CATALOG } from "./src/data/dripCatalog.ts";
    `,
    resolveDir: root,
    loader: "ts",
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  logLevel: "error",
});

const {
  calculatePrices,
  priceProductVariants,
  validatePriceLadder,
  parseDuration,
  DRIP_CATALOG,
} = await import(
  "data:text/javascript;base64," + Buffer.from(bundled.outputFiles[0].text).toString("base64")
);

const rp = (n) => "Rp" + Math.round(n).toLocaleString("id-ID");
const pct = (n) => (n * 100).toFixed(0) + "%";
const pad = (v, n) => String(v).padStart(n);
const failures = [];
const fail = (msg) => failures.push(msg);
const log = (...a) => {
  if (!quiet) console.log(...a);
};

const DURATIONS = ["1h", "3h", "6h", "12h", "1d", "3d", "7d", "10d", "15d", "20d", "30d"];
const MODALS = [2000, 3000, 5000, 10000, 20000, 50000, 100000, 250000];

/* ------------------------------------------------------------------ */
/* A. Grid per varian: tiap modal x tiap durasi (independen)           */
/* ------------------------------------------------------------------ */
log("\n=== A. GRID PER VARIAN (modal yang sama dipakai untuk semua durasi) ===");
log("Margin = profit / harga jual. Price/hour & Price/day dihitung dari harga MEMBER.\n");
log(
  ["Dur", "Modal", "Reseller", "Member", "ResProfit", "MemProfit", "ResMgn", "MemMgn", "Mbr/hour", "Mbr/day"]
    .map((h, i) => (i === 0 ? h.padEnd(4) : pad(h, 10)))
    .join(" "),
);

for (const modal of MODALS) {
  for (const duration of DURATIONS) {
    const r = calculatePrices({ modal, duration });
    const hours = parseDuration(duration).hours;
    log(
      [
        duration.padEnd(4),
        pad(rp(modal), 10),
        pad(rp(r.resellerPrice), 10),
        pad(rp(r.memberPrice), 10),
        pad(rp(r.resellerProfit), 10),
        pad(rp(r.memberProfit), 10),
        pad(pct(r.resellerMargin), 10),
        pad(pct(r.memberMargin), 10),
        pad(rp(r.memberPrice / hours), 10),
        pad(rp((r.memberPrice / hours) * 24), 10),
      ].join(" "),
    );

    if (!(r.modalPrice < r.resellerPrice)) fail(`A: reseller <= modal (${modal} ${duration})`);
    if (!(r.resellerPrice < r.memberPrice)) fail(`A: member <= reseller (${modal} ${duration})`);
    if (r.resellerProfit <= 0 || r.memberProfit <= 0) fail(`A: profit <= 0 (${modal} ${duration})`);
    if (r.resellerPrice % 1000 || r.memberPrice % 1000) fail(`A: tidak dibulatkan (${modal} ${duration})`);
  }
  log("");
}

/* ------------------------------------------------------------------ */
/* B. Tangga realistis per produk (modal tiap durasi ikut kurva DRIP)  */
/* ------------------------------------------------------------------ */
// Dari katalog lama: modal(h) ~ modal1d * (h/24)^0.62  (7d ~ 3.3x, 30d ~ 8x modal 1 hari).
const sublinearModal = (m1d) => (h) => m1d * Math.pow(h / 24, 0.62);
// Kasus terburuk: modal jam-jaman LINEAR (3h = 3x 1h), seperti sebagian produk DRIP.
const linearHourlyModal = (m1h) => (h) => (h <= 12 ? m1h * h : m1h * 12 * 1.6 * Math.pow(h / 24, 0.62));

const scenarios = [
  ...[2000, 3000, 5000, 10000, 20000, 50000, 100000, 250000].map((m) => ({
    name: `sublinear, modal 1 hari ${rp(m)}`,
    modalAt: sublinearModal(m),
  })),
  ...[1000, 3000, 8000].map((m) => ({
    name: `HOURLY LINEAR (kasus terburuk), modal 1 jam ${rp(m)}`,
    modalAt: linearHourlyModal(m),
  })),
];

log("\n=== B. TANGGA HARGA REALISTIS (satu produk, semua durasi) ===");
let totalWarnings = 0;

for (const sc of scenarios) {
  const variants = DURATIONS.map((duration) => ({
    duration,
    modal: Math.round(sc.modalAt(parseDuration(duration).hours)),
  }));
  const rows = priceProductVariants(variants, { productName: sc.name });
  const issues = validatePriceLadder(rows);

  log(`\n--- ${sc.name} ---`);
  log(
    ["Dur", "Modal", "Reseller", "Member", "ResProfit", "MemProfit", "ResMgn", "MemMgn", "Mbr/hour", "Mbr/day"]
      .map((h, i) => (i === 0 ? h.padEnd(4) : pad(h, 10)))
      .join(" "),
  );
  for (const row of rows) {
    const p = row.pricing;
    log(
      [
        row.duration.padEnd(4),
        pad(rp(row.modal), 10),
        pad(rp(p.resellerPrice), 10),
        pad(rp(p.memberPrice), 10),
        pad(rp(p.resellerProfit), 10),
        pad(rp(p.memberProfit), 10),
        pad(pct(p.resellerMargin), 10),
        pad(pct(p.memberMargin), 10),
        pad(rp(p.memberPrice / p.hours), 10),
        pad(rp((p.memberPrice / p.hours) * 24), 10),
      ].join(" "),
    );
    totalWarnings += p.warnings.length;
  }
  for (const issue of issues) fail(`B (${sc.name}) ${issue.duration}: ${issue.code} - ${issue.message}`);
}

/* ------------------------------------------------------------------ */
/* C. Anomali spesifik dari brief                                      */
/* ------------------------------------------------------------------ */
log("\n=== C. KASUS ANOMALI ===");
{
  // Modal 1h 3.000; 3h modal 9.000 (linear). Harga lama menghasilkan lompatan ~3x.
  const rows = priceProductVariants([
    { duration: "1 Hour", modal: 3000 },
    { duration: "3 Hours", modal: 9000 },
  ]);
  const [h1, h3] = rows.map((r) => r.pricing);
  log(`1h member ${rp(h1.memberPrice)}  ->  3h member ${rp(h3.memberPrice)}  (rasio ${(h3.memberPrice / h1.memberPrice).toFixed(2)}x, linear = 3.00x)`);
  if (h3.memberPrice / h1.memberPrice >= 3) fail("C: 3h masih >= 3x harga 1h");
  if (h3.memberPrice <= h1.memberPrice) fail("C: 3h tidak lebih mahal dari 1h");

  // Anomali input: modal 1 Day LEBIH MURAH dari 12 Hours.
  const inv = priceProductVariants([
    { duration: "12 Hours", modal: 9000 },
    { duration: "1 Day", modal: 4000 },
    { duration: "3 Days", modal: 4000 },
  ]);
  const prices = inv.map((r) => r.pricing.memberPrice);
  log(`modal terbalik (12h=9k, 1d=4k, 3d=4k) -> member ${prices.map(rp).join(" < ")}`);
  if (!(prices[0] < prices[1] && prices[1] < prices[2])) fail("C: urutan harga rusak pada modal terbalik");
  for (const r of inv) if (r.pricing.resellerPrice <= r.modal) fail("C: harga <= modal");

  // Durasi sama persis, label berbeda (tidak boleh dipaksa naik).
  const same = priceProductVariants([
    { duration: "24 Hours (1 Day)", modal: 7000 },
    { duration: "1 Day", modal: 7000 },
  ]);
  log(`label berbeda, durasi sama: ${same.map((r) => rp(r.pricing.memberPrice)).join(" vs ")}`);
  if (same[0].pricing.memberPrice !== same[1].pricing.memberPrice) fail("C: durasi sama tapi harga beda");

  // Durasi non-waktu.
  const perm = calculatePrices({ modal: 142400, duration: "Permanent" });
  log(`Permanent modal ${rp(142400)} -> reseller ${rp(perm.resellerPrice)}, member ${rp(perm.memberPrice)}`);
  if (perm.resellerProfit <= 0) fail("C: Permanent profit <= 0");

  // Input tidak valid harus ditolak, bukan menghasilkan harga ngawur.
  for (const bad of [0, -5, NaN, Infinity]) {
    try {
      calculatePrices({ modal: bad, duration: "1d" });
      fail(`C: modal ${bad} seharusnya ditolak`);
    } catch {
      /* ok */
    }
  }
}

/* ------------------------------------------------------------------ */
/* D. Backtest terhadap 165 varian katalog DRIP lama                   */
/* ------------------------------------------------------------------ */
log("\n=== D. BACKTEST vs KATALOG LAMA (modal asli DRIP) ===");
{
  const ratios = { res: [], mem: [] };
  const profits = { res: [], mem: [] };
  let n = 0;
  let softWarn = 0;
  const big = [];

  for (const product of DRIP_CATALOG) {
    const rows = priceProductVariants(
      product.variants.map((v) => ({ ...v })),
      { productName: product.name },
    );
    const issues = validatePriceLadder(rows).filter(
      // Katalog lama memuat modal yang tidak monoton (mis. 1 Day = 3 Day), itu murni data.
      (i) => i.code !== "PER_UNIT_NOT_DECREASING",
    );
    for (const issue of issues) fail(`D ${product.name} ${issue.duration}: ${issue.code} - ${issue.message}`);

    for (const row of rows) {
      n++;
      const rr = row.pricing.resellerPrice / row.resellerPrice;
      const mr = row.pricing.memberPrice / row.memberPrice;
      ratios.res.push(rr);
      ratios.mem.push(mr);
      profits.res.push(row.pricing.resellerProfit);
      profits.mem.push(row.pricing.memberProfit);
      softWarn += row.pricing.warnings.length;
      if (rr > 1.3 || rr < 0.85 || mr > 1.3 || mr < 0.85) {
        big.push(
          `${product.name} [${row.duration}] modal ${rp(row.modal)}: reseller ${rp(row.resellerPrice)}->${rp(row.pricing.resellerPrice)}, member ${rp(row.memberPrice)}->${rp(row.pricing.memberPrice)}`,
        );
      }
    }
  }

  const q = (arr, p) => [...arr].sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor(arr.length * p))];
  log(`varian diuji: ${n}`);
  log(`rasio harga baru/lama reseller: p10=${q(ratios.res, 0.1).toFixed(2)} median=${q(ratios.res, 0.5).toFixed(2)} p90=${q(ratios.res, 0.9).toFixed(2)}`);
  log(`rasio harga baru/lama member  : p10=${q(ratios.mem, 0.1).toFixed(2)} median=${q(ratios.mem, 0.5).toFixed(2)} p90=${q(ratios.mem, 0.9).toFixed(2)}`);
  log(`profit reseller baru: min ${rp(Math.min(...profits.res))}, median ${rp(q(profits.res, 0.5))}, max ${rp(Math.max(...profits.res))}`);
  log(`profit member baru  : min ${rp(Math.min(...profits.mem))}, median ${rp(q(profits.mem, 0.5))}, max ${rp(Math.max(...profits.mem))}`);
  log(`varian dengan perubahan harga > +30% / < -15%: ${big.length}`);
  for (const line of big.slice(0, 12)) log("  - " + line);
  if (big.length > 12) log(`  ... dan ${big.length - 12} lainnya`);
  log(`warning koreksi otomatis: ${softWarn}`);
  if (Math.min(...profits.res) <= 0 || Math.min(...profits.mem) <= 0) fail("D: ada profit <= 0");
}

/* ------------------------------------------------------------------ */
console.log(
  failures.length
    ? `\n❌ GAGAL (${failures.length}):\n` + failures.map((f) => " - " + f).join("\n")
    : `\n✅ SEMUA PENGECEKAN LOLOS (warning koreksi otomatis di bagian B: ${totalWarnings})`,
);
process.exit(failures.length ? 1 : 0);
