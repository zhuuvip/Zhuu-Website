import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";

const API_BASE = (import.meta.env.VITE_API_URL || "https://zhuuapi.vercel.app").replace(/\/$/, "");
const rupiah = (v: number) => `Rp${Number(v || 0).toLocaleString("id-ID")}`;

type Member = {
  id: number;
  user_id: string;
  plan: string;
  expires_at: string | null;
  username: string | null;
  active: boolean;
  valid: boolean;
};
type Opt = { id: number; duration: string; price: number };
type Prod = { id: number; name: string; options: Opt[] };

const inputCls =
  "w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm outline-none focus:border-white/20";

export default function AdminResellerTab() {
  const { getToken } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [products, setProducts] = useState<Prod[]>([]);
  const [prices, setPrices] = useState<Record<number, string>>({});
  const [plan, setPlan] = useState({ monthly: "", lifetime: "" });
  const [msg, setMsg] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualDuration, setManualDuration] = useState("30");
  const [addingReseller, setAddingReseller] = useState(false);
  const [giveawayAccount, setGiveawayAccount] = useState<{
    username: string;
    password: string;
    duration: string;
  } | null>(null);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [freePosts, setFreePosts] = useState<any[]>([]);

  const call = async (path: string, init: RequestInit = {}) => {
    const token = await getToken();
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      cache: "no-store",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Terjadi kesalahan");
    return data;
  };

  const load = async () => {
    try {
      const [mem, prods, pr, set, promos, free] = await Promise.all([
        call("/api/admin/resellers"),
        fetch(`${API_BASE}/api/products`, { cache: "no-store" }).then((r) => r.json()),
        call("/api/admin/reseller-prices"),
        call("/api/admin/reseller-settings"),
        call("/api/admin/promotions"),
        call("/api/free/posts"),
      ]);
      setMembers(Array.isArray(mem) ? mem : []);
      setProducts(Array.isArray(prods) ? prods : []);
      const map: Record<number, string> = {};
      if (Array.isArray(pr)) pr.forEach((x: any) => (map[Number(x.option_id)] = String(x.price)));
      setPrices(map);
      setPlan({ monthly: String(set.monthly ?? ""), lifetime: String(set.lifetime ?? "") });
      setPromotions(Array.isArray(promos) ? promos : []);
      setFreePosts(Array.isArray(free?.posts) ? free.posts : []);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Gagal memuat");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (fn: () => Promise<any>, ok?: string) => {
    try {
      setMsg("");
      await fn();
      if (ok) setMsg(ok);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Gagal");
    }
  };

  const fmtDate = (s: string | null) =>
    s ? new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "";

  return (
    <div className="space-y-6">
      {msg && <div className="rounded-xl bg-amber-400/10 px-4 py-2 text-sm text-amber-200">{msg}</div>}

      {/* Harga paket rank */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="mb-1 font-bold">Harga Rank Reseller</h3>
        <p className="mb-3 text-xs text-white/40">Yang tampil di halaman Member.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs text-white/50">Bulanan (30 hari)</p>
            <input
              className={inputCls}
              inputMode="numeric"
              value={plan.monthly}
              onChange={(e) => setPlan({ ...plan, monthly: e.target.value })}
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-white/50">Lifetime</p>
            <input
              className={inputCls}
              inputMode="numeric"
              value={plan.lifetime}
              onChange={(e) => setPlan({ ...plan, lifetime: e.target.value })}
            />
          </div>
        </div>
        <button
          className="mt-3 rounded-xl bg-white px-4 py-2 text-sm font-bold text-black"
          onClick={() =>
            run(
              () =>
                call("/api/admin/reseller-settings", {
                  method: "PUT",
                  body: JSON.stringify({ monthly: Number(plan.monthly), lifetime: Number(plan.lifetime) }),
                }),
              "Harga rank disimpan",
            )
          }
        >
          Simpan Harga Rank
        </button>
      </section>

      {/* Add reseller manual */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-6 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h3 className="mb-1 font-bold">Buat Akun Reseller</h3>
          <p className="mb-4 text-sm text-white/50">
            Buat akun reseller dengan username dan password otomatis.
          </p>

          <div className="grid gap-2 sm:grid-cols-[180px_auto]">
            <select
              className={inputCls}
              value={manualDuration}
              onChange={(e) => setManualDuration(e.target.value)}
            >
              <option value="1">1 Day</option>
              <option value="3">3 Days</option>
              <option value="7">7 Days</option>
              <option value="10">10 Days</option>
              <option value="15">15 Days</option>
              <option value="30">30 Days</option>
              <option value="lifetime">Lifetime</option>
            </select>

            <button
              type="button"
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
              disabled={addingReseller}
              onClick={async () => {
                try {
                  setAddingReseller(true);
                  setMsg("");

                  const result = await call("/api/admin/resellers/giveaway", {
                    method: "POST",
                    body: JSON.stringify({
                      duration: manualDuration,
                    }),
                  });

                  setGiveawayAccount({
                    username: result.username,
                    password: result.password,
                    duration: result.duration,
                  });
                  setMsg("Akun reseller berhasil dibuat.");

                  await load();
                } catch (e: any) {
                  setMsg(e?.message || "Gagal membuat akun giveaway");
                } finally {
                  setAddingReseller(false);
                }
              }}
            >
              {addingReseller ? "Generating..." : "Buat Akun Reseller"}
            </button>
          </div>
        </div>

        {giveawayAccount && (
          <div className="mb-6 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold">Akun Reseller Berhasil Dibuat</h3>
                <p className="text-xs text-white/40">
                  Simpan credential ini sebelum menutup halaman.
                </p>
              </div>
              <button
                type="button"
                className="text-xs text-white/50 hover:text-white"
                onClick={() => setGiveawayAccount(null)}
              >
                Tutup
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="mb-1 text-xs text-white/40">Username</div>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-sm font-semibold">
                    {giveawayAccount.username}
                  </code>
                  <button
                    type="button"
                    className="rounded-md border border-white/10 px-2 py-1 text-xs hover:bg-white/10"
                    onClick={() =>
                      navigator.clipboard.writeText(giveawayAccount.username)
                    }
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="mb-1 text-xs text-white/40">Password</div>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-sm font-semibold">
                    {giveawayAccount.password}
                  </code>
                  <button
                    type="button"
                    className="rounded-md border border-white/10 px-2 py-1 text-xs hover:bg-white/10"
                    onClick={() =>
                      navigator.clipboard.writeText(giveawayAccount.password)
                    }
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-3 text-xs text-white/40">
              Durasi: {giveawayAccount.duration === "lifetime"
                ? "Lifetime"
                : `${giveawayAccount.duration} hari`}
            </div>
          </div>
        )}

        <h3 className="mb-1 font-bold">Tambah Reseller Manual</h3>
        <p className="mb-3 text-xs text-white/40">
          Masukkan email user yang sudah terdaftar di website.
        </p>

        <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
          <input
            className={inputCls}
            type="email"
            placeholder="email user"
            value={manualEmail}
            onChange={(e) => setManualEmail(e.target.value)}
          />

          <select
            className={inputCls}
            value={manualDuration}
            onChange={(e) => setManualDuration(e.target.value)}
          >
            <option value="1">1 Day</option>
            <option value="3">3 Days</option>
            <option value="7">7 Days</option>
            <option value="10">10 Days</option>
            <option value="15">15 Days</option>
            <option value="30">30 Days</option>
            <option value="lifetime">Lifetime</option>
          </select>

          <button
            disabled={addingReseller || !manualEmail.trim()}
            className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-black disabled:opacity-40"
            onClick={async () => {
              try {
                setAddingReseller(true);
                setMsg("");

                await call("/api/admin/resellers/manual", {
                  method: "POST",
                  body: JSON.stringify({
                    email: manualEmail.trim(),
                    duration: manualDuration,
                  }),
                });

                setManualEmail("");
                setMsg(
                  manualDuration === "lifetime"
                    ? "Reseller lifetime berhasil ditambahkan"
                    : `Reseller ${manualDuration} hari berhasil ditambahkan`
                );

                await load();
              } catch (e) {
                setMsg(e instanceof Error ? e.message : "Gagal menambah reseller");
              } finally {
                setAddingReseller(false);
              }
            }}
          >
            {addingReseller ? "Menambahkan..." : "Tambah Reseller"}
          </button>
        </div>
      </section>

      {/* Kelola Promotion */}

      {/* Free Hub Manager */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold">Free Hub</h3>
            <p className="text-xs text-white/40">
              Kelola postingan Free Hub yang sedang tampil.
            </p>
          </div>
          <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/50">
            {freePosts.length} posting
          </span>
        </div>

        <div className="space-y-2">
          {freePosts.map((post) => (
            <div
              key={post.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {post.title || "Tanpa judul"}
                </p>
                <p className="mt-1 text-xs text-white/40">
                  {post.category || "FREE"} · ID #{post.id}
                </p>
              </div>

              <button
                type="button"
                className="shrink-0 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-400/20"
                onClick={() =>
                  run(
                    async () => {
                      const ok = await window.zhuuConfirm?.(
                        `Hapus posting Free Hub "${post.title || "Tanpa judul"}"?`,
                      );
                      if (ok === false) return;

                      await call(`/api/free/posts/${post.id}`, {
                        method: "DELETE",
                      });
                    },
                    "Posting Free Hub dihapus",
                  )
                }
              >
                Hapus
              </button>
            </div>
          ))}

          {freePosts.length === 0 && (
            <div className="rounded-xl border border-white/10 bg-black/10 px-4 py-6 text-center text-sm text-white/35">
              Tidak ada posting Free Hub.
            </div>
          )}
        </div>
      </section>

<section className="rounded-2xl border border-purple-400/20 bg-purple-400/[0.03] p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="font-bold">Kelola Promotion</h3>
            <p className="text-xs text-white/40">
              Khusus owner untuk menghapus promosi.
            </p>
          </div>
          <span className="text-xs text-white/40">
            {promotions.length} promosi
          </span>
        </div>

        <div className="space-y-2">
          {promotions.map((promo) => (
            <div
              key={promo.id}
              className="rounded-xl border border-white/10 bg-black/20 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold">{promo.title}</p>
                  <p className="text-[11px] text-white/35">
                    #{promo.id} · {promo.category} · {promo.durationDays} hari · {promo.status}
                  </p>
                  <p className="truncate text-[11px] text-white/30">
                    {promo.userId}
                  </p>
                </div>

                <button
                  className="shrink-0 rounded-lg border border-red-400/30 px-3 py-1.5 text-xs font-bold text-red-300 hover:bg-red-400/10"
                  onClick={async () => {
                    if (
                      await window.zhuuConfirm(
                        `Hapus promotion "${promo.title}" secara permanen?`
                      )
                    ) {
                      await run(
                        () =>
                          call(`/api/admin/promotions/${promo.id}`, {
                            method: "DELETE",
                          }),
                        "Promotion berhasil dihapus",
                      );
                    }
                  }}
                >
                  Hapus
                </button>
              </div>
            </div>
          ))}

          {promotions.length === 0 && (
            <p className="text-sm text-white/40">
              Belum ada promotion.
            </p>
          )}
        </div>
      </section>

      {/* Member reseller */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="mb-3 font-bold">Member Reseller ({members.length})</h3>
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-bold">{m.username || "(belum buat username)"}</p>
                  <p className="truncate text-[11px] text-white/35">{m.user_id}</p>
                </div>
                <div className="shrink-0 text-right text-xs">
                  <p className={m.valid ? "font-bold text-emerald-300" : "font-bold text-red-300"}>
                    {m.valid ? "Aktif" : m.active ? "Habis" : "Nonaktif"}
                  </p>
                  <p className="text-white/40">
                    {m.plan === "lifetime" ? "Lifetime" : `s/d ${fmtDate(m.expires_at)}`}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex gap-2 text-xs">
                <button
                  className="rounded-lg border border-white/10 px-3 py-1.5"
                  onClick={() =>
                    run(() =>
                      call(`/api/admin/resellers/${m.id}`, {
                        method: "PATCH",
                        body: JSON.stringify({ active: !m.active }),
                      }),
                    )
                  }
                >
                  {m.active ? "Nonaktifkan" : "Aktifkan"}
                </button>
                <button
                  className="rounded-lg border border-red-400/30 px-3 py-1.5 text-red-300"
                  onClick={async () => {
                    if (await window.zhuuConfirm(`Cabut akses reseller ${m.username || m.user_id}?`))
                      run(() => call(`/api/admin/resellers/${m.id}`, { method: "DELETE" }));
                  }}
                >
                  Cabut Akses
                </button>
              </div>
            </div>
          ))}
          {members.length === 0 && <p className="text-sm text-white/40">Belum ada member reseller.</p>}
        </div>
      </section>

      {/* Harga produk reseller */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="mb-1 font-bold">Harga Produk untuk Reseller</h3>
        <p className="mb-3 text-xs text-white/40">
          Kosongkan lalu Simpan untuk kembali ke harga normal.
        </p>
        <div className="space-y-4">
          {products.map((p) => (
            <div key={p.id}>
              <p className="mb-2 text-sm font-bold">{p.name}</p>
              <div className="space-y-2">
                {(p.options || []).map((o) => (
                  <div key={o.id} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{o.duration}</p>
                      <p className="text-[11px] text-white/35">Normal {rupiah(o.price)}</p>
                    </div>
                    <input
                      className={`${inputCls} !w-28`}
                      inputMode="numeric"
                      placeholder="Harga"
                      value={prices[o.id] ?? ""}
                      onChange={(e) => setPrices({ ...prices, [o.id]: e.target.value })}
                    />
                    <button
                      className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-black"
                      onClick={() =>
                        run(
                          () =>
                            call(`/api/admin/reseller-prices/${o.id}`, {
                              method: "PUT",
                              body: JSON.stringify({ price: prices[o.id] || null }),
                            }),
                          "Harga disimpan",
                        )
                      }
                    >
                      Simpan
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
