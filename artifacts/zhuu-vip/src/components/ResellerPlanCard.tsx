import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";

const API_BASE = "https://zhuuapi.vercel.app";
const rupiah = (v: number) => `Rp${Number(v || 0).toLocaleString("id-ID")}`;

type Member = {
  plan: string;
  expiresAt: string | null;
  active: boolean;
  username: string | null;
};

export default function ResellerPlanCard() {
  const { getToken, isSignedIn } = useAuth();
  const [prices, setPrices] = useState<{ monthly: number; lifetime: number } | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

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
      const d = await call("/api/reseller/plans");
      setPrices(d.prices);
      setMember(d.member);
      if (d.member?.username) setUsername(d.member.username);
    } catch {
      /* kartu tetap tampil tanpa data */
    }
  };

  useEffect(() => {
    if (isSignedIn) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  const buy = async (plan: string, label: string, price: number) => {
    if (!confirm(`Beli ${label} seharga ${rupiah(price)} dari saldo wallet?`)) return;
    setErr("");
    setMsg("");
    setBusy(plan);
    try {
      await call("/api/reseller/plans/purchase", {
        method: "POST",
        body: JSON.stringify({ plan }),
      });
      setMsg("Paket reseller aktif! Buat username & password di bawah.");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal membeli");
    } finally {
      setBusy(null);
    }
  };

  const saveCreds = async () => {
    setErr("");
    setMsg("");
    setSaving(true);
    try {
      await call("/api/reseller/credentials", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      setPassword("");
      setMsg("Akun reseller tersimpan. Login di /reseller-login");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const plans = prices
    ? [
        { key: "monthly", label: "Reseller Bulanan", price: prices.monthly, note: "Aktif 30 hari, bisa diperpanjang" },
        { key: "lifetime", label: "Reseller Lifetime", price: prices.lifetime, note: "Sekali bayar, selamanya" },
      ]
    : [];

  const isLifetime = member?.plan === "lifetime";
  const expiryText = member?.expiresAt
    ? new Date(member.expiresAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
    : "";

  const inputCls =
    "w-full rounded-xl border border-cyan-300/15 bg-cyan-300/[.03] px-3 py-2.5 text-sm text-cyan-50 outline-none focus:border-purple-400/40";

  return (
    <div className="glass-card rounded-[24px] p-5 sm:p-7">
      <div className="mb-5">
        <p className="text-xs uppercase tracking-[.2em] text-cyan-300/45">Harga khusus produk</p>
        <h3 className="mt-1 text-xl font-bold text-cyan-50">Reseller Products</h3>
      </div>

      {!isSignedIn ? (
        <p className="text-xs text-cyan-100/50">Login dulu untuk membeli rank reseller.</p>
      ) : (
        <>
          {member && (
            <div
              className={`mb-4 rounded-2xl border px-4 py-3 text-xs ${
                member.active
                  ? "border-emerald-400/25 bg-emerald-400/5 text-emerald-300"
                  : "border-rose-400/25 bg-rose-400/5 text-rose-300"
              }`}
            >
              {member.active
                ? isLifetime
                  ? "✓ Reseller Lifetime aktif"
                  : `✓ Reseller aktif sampai ${expiryText}`
                : "Paket reseller kamu sudah habis / dinonaktifkan. Perpanjang di bawah."}
            </div>
          )}

          {msg && <p className="mb-3 text-xs text-emerald-300">{msg}</p>}
          {err && <p className="mb-3 text-xs text-rose-400">{err}</p>}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {plans.map((p) => {
              const disabled = isLifetime || busy !== null;
              const label =
                p.key === "lifetime"
                  ? isLifetime
                    ? "✓ Aktif"
                    : "Beli Sekarang"
                  : isLifetime
                    ? "Tidak perlu"
                    : member?.active
                      ? "Perpanjang +30 hari"
                      : "Beli Sekarang";
              return (
                <div key={p.key} className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[.03] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-cyan-50">{p.label}</span>
                    <span className="text-sm font-black text-cyan-200">{rupiah(p.price)}</span>
                  </div>
                  <ul className="mt-2 space-y-1 text-[11px] text-cyan-100/55">
                    <li>Harga reseller di semua produk</li>
                    <li>{p.note}</li>
                  </ul>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => buy(p.key, p.label, p.price)}
                    className="mt-3 w-full rounded-xl border border-purple-400/25 bg-purple-400/10 px-3 py-2 text-xs font-semibold text-purple-200 transition hover:bg-purple-400/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busy === p.key ? "Memproses…" : label}
                  </button>
                </div>
              );
            })}
          </div>

          {member?.active && (
            <div className="mt-5 rounded-2xl border border-cyan-300/15 bg-cyan-300/[.03] p-4">
              <p className="text-sm font-bold text-cyan-50">Akun Login Reseller</p>
              <p className="mt-1 text-[11px] text-cyan-100/45">
                Buat sendiri username & password. Dipakai untuk masuk di{" "}
                <a href="/reseller-login" className="text-cyan-300 underline">
                  /reseller-login
                </a>
                . Isi lagi untuk mengganti.
              </p>
              <div className="mt-3 space-y-2">
                <input
                  className={inputCls}
                  placeholder="Username (huruf kecil/angka)"
                  autoCapitalize="none"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <input
                  className={inputCls}
                  type="password"
                  placeholder="Password (min 6 karakter)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <button
                type="button"
                disabled={saving || !username || password.length < 6}
                onClick={saveCreds}
                className="mt-3 w-full rounded-xl bg-cyan-400 px-3 py-2.5 text-xs font-bold text-black transition disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? "Menyimpan…" : member.username ? "Perbarui Akun" : "Simpan Akun"}
              </button>
            </div>
          )}
        </>
      )}

      <p className="mt-3 text-[11px] text-cyan-100/35">
        Dibayar dari saldo wallet. Produk dibeli reseller juga memakai saldo wallet yang sama.
      </p>
    </div>
  );
}
