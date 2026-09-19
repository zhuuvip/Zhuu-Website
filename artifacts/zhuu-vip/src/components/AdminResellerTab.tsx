import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";

const API_BASE = "https://zhuuapi.vercel.app";
const rupiah = (v: number) => `Rp${Number(v || 0).toLocaleString("id-ID")}`;

type Account = {
  id: number;
  username: string;
  balance: number;
  active: boolean;
  note: string | null;
};

type Opt = { id: number; duration: string; price: number };
type Prod = { id: number; name: string; options: Opt[] };

const inputCls =
  "w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm outline-none focus:border-cyan-400/40";

export default function AdminResellerTab() {
  const { getToken } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [products, setProducts] = useState<Prod[]>([]);
  const [prices, setPrices] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState("");
  const [created, setCreated] = useState<{ username: string; password: string } | null>(null);
  const [f, setF] = useState({ username: "", password: "", balance: "", note: "" });

  const call = async (path: string, init: RequestInit = {}) => {
    const token = await getToken();
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Terjadi kesalahan");
    return data;
  };

  const load = async () => {
    try {
      const [acc, prods, pr] = await Promise.all([
        call("/api/admin/resellers"),
        fetch(`${API_BASE}/api/products`, { cache: "no-store" }).then((r) => r.json()),
        call("/api/admin/reseller-prices"),
      ]);
      setAccounts(Array.isArray(acc) ? acc : []);
      setProducts(Array.isArray(prods) ? prods : []);
      const map: Record<number, string> = {};
      if (Array.isArray(pr)) pr.forEach((x: any) => (map[Number(x.option_id)] = String(x.price)));
      setPrices(map);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Gagal memuat");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (fn: () => Promise<void>, ok?: string) => {
    try {
      setMsg("");
      await fn();
      if (ok) setMsg(ok);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Gagal");
    }
  };

  const createAccount = () =>
    run(async () => {
      const data = await call("/api/admin/resellers", {
        method: "POST",
        body: JSON.stringify({
          username: f.username || undefined,
          password: f.password || undefined,
          balance: Number(f.balance) || 0,
          note: f.note || undefined,
        }),
      });
      setCreated({ username: data.username, password: data.password });
      setF({ username: "", password: "", balance: "", note: "" });
    });

  return (
    <div className="space-y-6">
      {msg && (
        <div className="rounded-xl bg-amber-400/10 px-4 py-2 text-sm text-amber-200">{msg}</div>
      )}

      {/* Buat akun */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="mb-3 font-bold">Buat Akun Reseller</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            className={inputCls}
            placeholder="Username (kosong = acak)"
            value={f.username}
            onChange={(e) => setF({ ...f, username: e.target.value })}
          />
          <input
            className={inputCls}
            placeholder="Password (kosong = acak)"
            value={f.password}
            onChange={(e) => setF({ ...f, password: e.target.value })}
          />
          <input
            className={inputCls}
            placeholder="Saldo awal (Rp)"
            inputMode="numeric"
            value={f.balance}
            onChange={(e) => setF({ ...f, balance: e.target.value })}
          />
          <input
            className={inputCls}
            placeholder="Catatan (nama/WA)"
            value={f.note}
            onChange={(e) => setF({ ...f, note: e.target.value })}
          />
        </div>
        <button
          onClick={createAccount}
          className="mt-3 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-bold text-black"
        >
          Buat Akun
        </button>

        {created && (
          <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm">
            <p className="font-bold text-emerald-300">Akun dibuat. Simpan sekarang, password tidak ditampilkan lagi.</p>
            <p className="mt-1 break-all font-mono">
              Username: {created.username} | Password: {created.password}
            </p>
            <button
              onClick={() =>
                navigator.clipboard.writeText(
                  `Username: ${created.username} | Password: ${created.password}`,
                )
              }
              className="mt-2 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-black"
            >
              Salin
            </button>
          </div>
        )}
      </section>

      {/* Daftar akun */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="mb-3 font-bold">Akun Reseller ({accounts.length})</h3>
        <div className="space-y-2">
          {accounts.map((a) => (
            <div key={a.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-bold">
                    {a.username}{" "}
                    {!a.active && <span className="text-xs text-red-300">(nonaktif)</span>}
                  </p>
                  {a.note && <p className="truncate text-xs text-white/40">{a.note}</p>}
                </div>
                <p className="shrink-0 font-black text-emerald-300">{rupiah(a.balance)}</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <button
                  className="rounded-lg border border-white/10 px-3 py-1.5"
                  onClick={() => {
                    const v = prompt("Tambah saldo (negatif untuk kurangi):");
                    if (v)
                      run(
                        () =>
                          call(`/api/admin/resellers/${a.id}`, {
                            method: "PATCH",
                            body: JSON.stringify({ addBalance: Number(v) }),
                          }),
                        "Saldo diperbarui",
                      );
                  }}
                >
                  + Saldo
                </button>
                <button
                  className="rounded-lg border border-white/10 px-3 py-1.5"
                  onClick={() => {
                    const v = prompt("Password baru (min 6 karakter):");
                    if (v)
                      run(
                        () =>
                          call(`/api/admin/resellers/${a.id}`, {
                            method: "PATCH",
                            body: JSON.stringify({ password: v }),
                          }),
                        "Password diganti",
                      );
                  }}
                >
                  Reset Password
                </button>
                <button
                  className="rounded-lg border border-white/10 px-3 py-1.5"
                  onClick={() =>
                    run(() =>
                      call(`/api/admin/resellers/${a.id}`, {
                        method: "PATCH",
                        body: JSON.stringify({ active: !a.active }),
                      }),
                    )
                  }
                >
                  {a.active ? "Nonaktifkan" : "Aktifkan"}
                </button>
                <button
                  className="rounded-lg border border-red-400/30 px-3 py-1.5 text-red-300"
                  onClick={() => {
                    if (confirm(`Hapus akun ${a.username}?`))
                      run(() => call(`/api/admin/resellers/${a.id}`, { method: "DELETE" }));
                  }}
                >
                  Hapus
                </button>
              </div>
            </div>
          ))}
          {accounts.length === 0 && <p className="text-sm text-white/40">Belum ada akun.</p>}
        </div>
      </section>

      {/* Harga reseller */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="mb-1 font-bold">Harga Reseller</h3>
        <p className="mb-3 text-xs text-white/40">
          Kosongkan lalu Simpan untuk kembali ke harga normal.
        </p>
        <div className="space-y-4">
          {products.map((p) => (
            <div key={p.id}>
              <p className="mb-2 text-sm font-bold">{p.name}</p>
              <div className="space-y-2">
                {p.options.map((o) => (
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
