# Daftar perbaikan

## Bug kritis
- **pnpm install gagal di Linux/Vercel**: `@rollup/rollup-android-arm64` & `@tailwindcss/oxide-android-arm64` ada di devDependencies → dipindah ke optionalDependencies (package.json + lockfile).
- **pnpm-workspace.yaml**: `allowBuilds` berisi teks placeholder, `lib/*` duplikat, path `lib/integrations/*` tidak ada → dirapikan.
- **Testimoni gagal kirim & upload di production**: `ProductsPage` memanggil `/api/testimonials` dan `/api/testimonial-upload` tanpa base URL API (frontend & API beda domain Vercel) → pakai `API_BASE`.
- **Balasan AI hilang dari riwayat (Vercel)**: pesan asisten disimpan *setelah* `res.end()` → sekarang disimpan sebelum response ditutup.
- **Chat AI error di percakapan panjang**: seluruh riwayat dikirim lewat URL GET → dibatasi (12 pesan, 5000 karakter).
- **Regex pembersih respons AI salah escape** (`\\n` di regex literal) → `:::writing` tidak pernah terhapus. Diperbaiki.
- **XSS di AIPage**: balasan AI dirender sebagai HTML mentah → sekarang di-escape.
- **Tabel `announcements` tidak dibuat di DB baru** (hanya ada di drizzle/schema.ts hasil introspeksi) → dibuat otomatis (`CREATE TABLE IF NOT EXISTS`).
- **SQL string-concatenation** di `settings.ts` (announcements) & `links.ts` (click) → pakai query terparameter, warna divalidasi hex.

## Bug menengah / aneh
- Speed test mengukur ping ke domain frontend (bukan API) → pakai API base + cache-buster.
- `post-merge.sh`: `--filter db` tidak cocok nama paket → `@workspace/db`.
- `export default router` di tengah file (links, settings, feedback) → dipindah ke akhir.
- Service worker: `respondWith(undefined)` saat offline, ikon `/favicon.ico` tidak ada, ikut mencegat POST → diperbaiki.
- Ikon PWA: `icon-192.png`/`icon-512.png` aslinya 1254px 2.4 MB (identik) → di-resize benar; ditambah `apple-touch-icon.png`, `icon-maskable-512.png`, `favicon.png`; `favicon.svg` 3.2 MB → 45 KB; manifest & index.html diperbarui (iOS tidak mendukung SVG untuk apple-touch-icon).
- Logo yang di-bundle (`attached_assets/file_…png`) 2.4 MB → 256px (120 KB).
- Vite dev langsung crash jika `PORT` tidak di-set → default 5173.
- `.gitignore` (`.env*`) membuang `.env.production` (berisi `VITE_API_URL`) → ditambah pengecualian.
- Link Markdown `javascript:` di DevTools diblokir.
- Suara AI: bahasa dikunci `en-US` → ikut bahasa browser.
- `rateLimit` timer di-`unref`, handler error JSON di `app.ts`.
- Root `pnpm dev`/`preview` sekarang menjalankan app yang benar (`@workspace/zhuu-vip`).

## Dihapus (sampah)
`Detected`, `node` (file kosong), `newtools.txt`, semua `.bak*`/`backup`/`before-limit`, serta folder `src/` + `vite.config.ts` di root (app lama yang tidak pernah bisa build: import komponen yang tidak ada, tidak ada index.html).

## Ditambah
`artifacts/api-server/.env.example` dan `artifacts/zhuu-vip/.env.example` (daftar env dari kode; catatan: `CLERK_PUBLISHABLE_KEY` juga wajib di API).
