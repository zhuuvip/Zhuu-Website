import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";

const API_BASE = "https://zhuuapi.vercel.app";
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
  "w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm outline-none focus:border-cyan-400/40";

export default function AdminResellerTab() {
  const { getToken } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [products, setProducts] = useState<Prod[]>([]);
  const [prices, setPrices] = useState<Record<number, string>>({});
  const [plan, setPlan] = useState({ monthly: "", lifetime: "" });
  const [msg, setMsg] = useState("");

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
      const [mem, prods, pr, set] = await Promise.all([
        call("/api/admin/resellers"),
        fetch(`${API_BASE}/api/products`, { cache: "no-store" }).then((r) => r.json()),
        call("/api/admin/reseller-prices"),
        call("/api/admin/reseller-settings"),
      ]);
      setMembers(Array.isArray(mem) ? mem : []);
      setProducts(Array.isArray(prods) ? prods : []);
      const map: Record<number, string> = {};
      if (Array.isArray(pr)) pr.forEach((x: any) => (map[Number(x.option_id)] = String(x.price)));
      setPrices(map);
      setPlan({ monthly: String(set.monthly ?? ""), lifetime: String(set.lifetime ?? "") });
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
          className="mt-3 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-bold text-black"
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
                  onClick={() => {
                    if (confirm(`Cabut akses reseller ${m.username || m.user_id}?`))
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
                      className="rounded-lg bg-cyan-400 px-3 py-2 text-xs font-bold text-black"
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
