import { useEffect, useState } from "react";

const API_BASE = "https://zhuuapi.vercel.app";
const TOKEN_KEY = "reseller_token";

type Option = {
  id: number;
  duration: string;
  price: number;
  normalPrice: number;
  hasResellerPrice: boolean;
  stock: number;
};

type Product = {
  id: number;
  name: string;
  imageUrl?: string | null;
  options: Option[];
};

type Result = {
  product: string;
  duration: string;
  deliveryKey?: string;
  deliveryLink?: string;
};

const rupiah = (v: number) => `Rp${Number(v || 0).toLocaleString("id-ID")}`;

export default function ResellerDashboardPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selProduct, setSelProduct] = useState<Product | null>(null);
  const [selOption, setSelOption] = useState<Option | null>(null);
  const [username, setUsername] = useState("");
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [buying, setBuying] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = "/reseller-login";
  };

  const api = async (path: string, init: RequestInit = {}) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      logout();
      throw new Error("Belum login");
    }
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      logout();
      throw new Error(data.error || "Sesi berakhir");
    }
    if (!res.ok) throw new Error(data.error || "Terjadi kesalahan");
    return data;
  };

  const load = async () => {
    try {
      setError("");
      const [me, list] = await Promise.all([api("/api/reseller/me"), api("/api/reseller/products")]);
      setUsername(me.username);
      setBalance(Number(me.balance || 0));
      try {
        const hist = await api("/api/reseller/orders");
        setHistory(Array.isArray(hist) ? hist : []);
      } catch {
        /* riwayat gagal dimuat tidak boleh merusak halaman */
      }
      const items: Product[] = Array.isArray(list)
        ? list.map((p: any) => ({ ...p, options: Array.isArray(p.options) ? p.options : [] }))
        : [];
      setProducts(items);
      setSelProduct((cur) => {
        const next = items.find((p) => p.id === cur?.id) ?? items[0] ?? null;
        setSelOption((curOpt) =>
          next
            ? (next.options.find((o) => o.id === curOpt?.id) ??
              next.options.find((o) => o.stock > 0) ??
              next.options[0] ??
              null)
            : null,
        );
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      window.location.href = "/reseller-login";
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (p: Product, o?: Option) => {
    setSelProduct(p);
    setSelOption(o ?? p.options.find((x) => x.stock > 0) ?? p.options[0] ?? null);
  };

  const canBuy = !!selProduct && !!selOption && selOption.stock > 0 && balance >= selOption.price && !buying;

  const buy = async () => {
    if (!selProduct || !selOption || buying) return;
    try {
      setBuying(true);
      const data = await api("/api/reseller/orders", {
        method: "POST",
        body: JSON.stringify({ productId: selProduct.id, optionId: selOption.id }),
      });
      if (Number.isFinite(Number(data.balance))) setBalance(Number(data.balance));
      setResult({
        product: selProduct.name,
        duration: selOption.duration,
        deliveryKey: data.deliveryKey || undefined,
        deliveryLink: data.deliveryLink || undefined,
      });
      setCopied(false);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal membeli produk");
    } finally {
      setBuying(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      alert("Gagal menyalin, salin manual.");
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-sm text-white/50">
        Memuat...
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-black px-4 py-16 text-white">
        <div className="mx-auto max-w-xl rounded-3xl border border-red-500/20 bg-red-500/[0.04] p-8 text-center">
          <h1 className="text-xl font-bold">Gagal dimuat</h1>
          <p className="mt-2 text-sm text-white/50">{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              load();
            }}
            className="mt-6 rounded-xl bg-white px-6 py-3 font-bold text-black"
          >
            Coba Lagi
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-purple-600/[0.08] blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[500px] rounded-full bg-blue-600/[0.05] blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <section className="mb-8 text-center sm:mb-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold tracking-widest text-white/60">
            <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.8)]" />
            RESELLER AREA
          </div>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
            Reseller{" "}
            <span className="bg-gradient-to-r from-purple-400 via-fuchsia-300 to-blue-400 bg-clip-text text-transparent">
              Products
            </span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/45">
            Harga khusus reseller. Pembelian memakai saldo reseller kamu.
          </p>
        </section>

        <section className="mb-8 rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
                Saldo Wallet · {username}
              </p>
              <p className="mt-1 text-2xl font-black sm:text-3xl">{rupiah(balance)}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={load}
                className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-white/60 hover:bg-white/[0.06] sm:flex-none"
              >
                ↻ Refresh
              </button>
              <button
                onClick={logout}
                className="flex-1 rounded-xl border border-red-400/20 px-4 py-3 text-sm font-bold text-red-300 hover:bg-red-500/10 sm:flex-none"
              >
                Keluar
              </button>
            </div>
          </div>
        </section>

        {products.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center text-sm text-white/40">
            Belum ada produk.
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => {
              const isSel = selProduct?.id === p.id;
              const stock = p.options.reduce((s, o) => s + Math.max(0, Number(o.stock || 0)), 0);
              const logo = p.imageUrl || "";
              return (
                <article
                  key={p.id}
                  className={`relative overflow-hidden rounded-3xl border bg-white/[0.025] p-4 transition sm:p-5 ${
                    isSel
                      ? "border-purple-400/40 bg-purple-500/[0.035]"
                      : "border-white/10 hover:border-white/20"
                  }`}
                >
                  <button
                    onClick={() => pick(p)}
                    className="mb-5 flex h-36 w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/30"
                  >
                    {logo ? (
                      <img
                        src={logo.trim()}
                        alt={p.name}
                        className="h-full w-full object-contain p-6"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <span className="text-4xl">◈</span>
                    )}
                  </button>

                  <div className="flex items-start justify-between gap-3">
                    <h3 className="truncate text-lg font-black">{p.name}</h3>
                    <span
                      className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold ${
                        stock > 0 ? "bg-emerald-400/10 text-emerald-300" : "bg-red-400/10 text-red-300"
                      }`}
                    >
                      {stock > 0 ? `${stock} STOCK` : "SOLD OUT"}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2">
                    {p.options.map((o) => {
                      const active = isSel && selOption?.id === o.id;
                      return (
                        <button
                          key={o.id}
                          disabled={o.stock <= 0}
                          onClick={() => pick(p, o)}
                          className={`w-full rounded-2xl border p-3 text-left transition ${
                            active
                              ? "border-purple-400/40 bg-purple-500/10"
                              : "border-white/10 bg-white/[0.025] hover:border-white/20"
                          } ${o.stock <= 0 ? "cursor-not-allowed opacity-35" : ""}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold">{o.duration}</p>
                              <p className="mt-1 text-[11px] text-white/35">
                                {o.stock > 0 ? `${o.stock} tersedia` : "Stok habis"}
                              </p>
                            </div>
                            <div className="text-right">
                              {o.hasResellerPrice && o.normalPrice > o.price && (
                                <p className="text-[11px] text-white/30 line-through">
                                  {rupiah(o.normalPrice)}
                                </p>
                              )}
                              <p className="text-sm font-black text-emerald-300">{rupiah(o.price)}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {history.length > 0 && (
          <section className="mx-auto mt-10 max-w-3xl">
            <h2 className="mb-3 text-xl font-bold">Riwayat Pembelian</h2>
            <div className="space-y-2">
              {history.slice(0, 20).map((o: any) => (
                <div key={o.id} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">
                        {o.productName} · {o.duration}
                      </p>
                      <p className="mt-1 text-[11px] text-white/35">
                        {o.invoice} · {new Date(o.createdAt).toLocaleString("id-ID")}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-black text-emerald-300">{rupiah(o.amount)}</p>
                  </div>
                  {o.paymentRef && (
                    <div className="mt-3 flex items-center gap-2 rounded-xl bg-black/30 p-2">
                      <p className="min-w-0 flex-1 break-all font-mono text-xs text-purple-100">
                        {o.paymentRef}
                      </p>
                      <button
                        onClick={() => copy(o.paymentRef)}
                        className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-black text-black"
                      >
                        Salin
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {selProduct && selOption && (
          <section className="sticky bottom-3 z-20 mx-auto mt-8 max-w-3xl rounded-3xl border border-white/10 bg-black/85 p-4 shadow-2xl shadow-black/60 backdrop-blur-2xl sm:bottom-5 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                  Pilihan kamu
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <h3 className="truncate font-black">{selProduct.name}</h3>
                  <span className="shrink-0 rounded-lg bg-white/5 px-2 py-1 text-[10px] font-semibold text-white/45">
                    {selOption.duration}
                  </span>
                </div>
                <p className="mt-1 text-lg font-black">{rupiah(selOption.price)}</p>
              </div>
              <button
                onClick={buy}
                disabled={!canBuy}
                className="w-full rounded-2xl bg-gradient-to-r from-purple-500 to-blue-500 px-6 py-4 text-sm font-black transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/10 disabled:bg-none disabled:text-white/30 sm:w-auto sm:min-w-52"
              >
                {buying
                  ? "Memproses..."
                  : selOption.stock <= 0
                    ? "Stok Habis"
                    : balance < selOption.price
                      ? "Saldo Tidak Cukup"
                      : "Beli Sekarang →"}
              </button>
            </div>
            {balance < selOption.price && selOption.stock > 0 && (
              <p className="mt-3 rounded-xl bg-amber-400/[0.06] px-3 py-2 text-[11px] text-amber-200/70">
                Saldo kurang {rupiah(selOption.price - balance)}. Isi saldo lewat halaman{" "}<a href="/member" className="font-bold underline">Member</a>.
              </p>
            )}
          </section>
        )}
      </div>

      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl border border-emerald-400/20 bg-[#09090b] p-6 shadow-2xl sm:p-7">
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-emerald-400/10 text-3xl ring-1 ring-emerald-400/20">
              ✓
            </div>
            <h2 className="mt-5 text-center text-2xl font-black">Pembelian Berhasil</h2>

            <div className="mt-6 space-y-2 rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-white/40">Produk</span>
                <span className="font-bold">{result.product}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-white/40">Durasi</span>
                <span className="font-bold">{result.duration}</span>
              </div>
            </div>

            {result.deliveryKey && (
              <div className="mt-4 rounded-2xl border border-purple-400/20 bg-purple-500/[0.06] p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/40">
                  Delivery Key
                </p>
                <p className="break-all font-mono text-sm leading-6 text-purple-100">
                  {result.deliveryKey}
                </p>
                <button
                  onClick={() => copy(result.deliveryKey || "")}
                  className="mt-4 w-full rounded-xl bg-white px-4 py-3 text-sm font-black text-black"
                >
                  {copied ? "✓ Berhasil Disalin" : "Salin Key"}
                </button>
              </div>
            )}

            {result.deliveryLink && (
              <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.06] p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/40">
                  Delivery Link
                </p>
                <a
                  href={result.deliveryLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block break-all text-sm text-cyan-300 underline"
                >
                  {result.deliveryLink}
                </a>
                <button
                  onClick={() => copy(result.deliveryLink || "")}
                  className="mt-4 w-full rounded-xl bg-white px-4 py-3 text-sm font-black text-black"
                >
                  {copied ? "✓ Berhasil Disalin" : "Salin Link"}
                </button>
              </div>
            )}

            <button
              onClick={() => setResult(null)}
              className="mt-4 w-full rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-white/70 hover:bg-white/[0.06]"
            >
              Selesai
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
