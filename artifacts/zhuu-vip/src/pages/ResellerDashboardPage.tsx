import { useEffect, useMemo, useState } from "react";

const API_BASE = "https://zhuuapi.vercel.app";
const TOKEN_KEY = "reseller_token";

type Option = {
  id: number;
  duration: string;
  price: number;
  normalPrice: number;
  hasResellerPrice: boolean;
  stock: number;
  dripVariantId?: number | null;
  dripStock?: number | null;
};

type Product = {
  id: number;
  name: string;
  imageUrl?: string | null;
  options: Option[];
};

const getAvailableStock = (option: Option) =>
  option.dripVariantId
    ? Number(option.dripStock ?? 0)
    : Number(option.stock ?? 0);

const rupiah = (v: number) =>
  `Rp${Number(v || 0).toLocaleString("id-ID")}`;

const getCategory = (name: string) => {
  const upper = name.toUpperCase();

  if (upper.includes("DRIP")) return "DRIP";
  if (upper.includes("HG")) return "HG";
  if (upper.includes("FLURIOTE")) return "FLURIOTE";
  if (upper.includes("MIGUL")) return "MIGUL";
  if (upper.includes("PATO")) return "PATO";
  if (upper.includes("SILENT")) return "SILENT";
  if (upper.includes("ROOT")) return "ROOT";
  if (upper.includes("IOS")) return "IOS";
  if (upper.includes("ANDROID")) return "ANDROID";
  if (upper.includes("FF")) return "FF";

  return "OTHER";
};

type Result = {
  product: string;
  duration: string;
  deliveryKey?: string;
  deliveryLink?: string;
};

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

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");

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

    if (!res.ok) {
      throw new Error(data.error || "Terjadi kesalahan");
    }

    return data;
  };

  const load = async () => {
    try {
      setError("");

      const [me, list] = await Promise.all([
        api("/api/reseller/me"),
        api("/api/reseller/products"),
      ]);

      setUsername(me.username);
      setBalance(Number(me.balance || 0));

      try {
        const hist = await api("/api/reseller/orders");
        setHistory(Array.isArray(hist) ? hist : []);
      } catch {
        // history gagal dimuat tidak merusak halaman
      }

      const items: Product[] = Array.isArray(list)
        ? list.map((p: any) => ({
            ...p,
            options: Array.isArray(p.options) ? p.options : [],
          }))
        : [];

      setProducts(items);

      setSelProduct((current) => {
        const next =
          items.find((p) => p.id === current?.id) ??
          null;

        if (next) {
          setSelOption((currentOption) =>
            next.options.find((o) => o.id === currentOption?.id) ??
            next.options.find((o) => getAvailableStock(o) > 0) ??
            next.options[0] ??
            null,
          );
        } else {
          setSelOption(null);
        }

        return next;
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Gagal memuat data",
      );
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

  const categories = useMemo(() => {
    const values = products.map((product) =>
      getCategory(product.name),
    );

    return [
      "ALL",
      ...Array.from(new Set(values)),
    ];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const productCategory = getCategory(product.name);

      const matchesCategory =
        category === "ALL" ||
        productCategory === category;

      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        productCategory.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [products, search, category]);

  const pick = (product: Product) => {
    setSelProduct(product);

    setSelOption(
      product.options.find(
        (option) => getAvailableStock(option) > 0,
      ) ??
        product.options[0] ??
        null,
    );
  };

  const selectOption = (option: Option) => {
    setSelOption(option);
  };

  const canBuy =
    !!selProduct &&
    !!selOption &&
    getAvailableStock(selOption) > 0 &&
    balance >= selOption.price &&
    !buying;

  const buy = async () => {
    if (!selProduct || !selOption || buying) return;

    try {
      setBuying(true);

      const data = await api("/api/reseller/orders", {
        method: "POST",
        body: JSON.stringify({
          productId: selProduct.id,
          optionId: selOption.id,
        }),
      });

      if (Number.isFinite(Number(data.balance))) {
        setBalance(Number(data.balance));
      }

      setResult({
        product: selProduct.name,
        duration: selOption.duration,
        deliveryKey: data.deliveryKey || undefined,
        deliveryLink: data.deliveryLink || undefined,
      });

      setCopied(false);

      await load();
    } catch (e) {
      alert(
        e instanceof Error
          ? e.message
          : "Gagal membeli produk",
      );
    } finally {
      setBuying(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1800);
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
          <h1 className="text-xl font-bold">
            Gagal dimuat
          </h1>

          <p className="mt-2 text-sm text-white/50">
            {error}
          </p>

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

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {/* HEADER */}
        <section className="mb-7 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold tracking-widest text-white/60">
            <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.8)]" />
            RESELLER STORE
          </div>

          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
            Reseller{" "}
            <span className="bg-gradient-to-r from-purple-400 via-fuchsia-300 to-blue-400 bg-clip-text text-transparent">
              Products
            </span>
          </h1>

          <p className="mx-auto mt-3 max-w-xl text-sm text-white/45">
            Pilih produk, tentukan durasi, lalu lakukan pembelian menggunakan saldo reseller kamu.
          </p>
        </section>

        {/* WALLET */}
        <section className="mb-7 rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
                Saldo Reseller · {username}
              </p>

              <p className="mt-1 text-2xl font-black sm:text-3xl">
                {rupiah(balance)}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setLoading(true);
                  load();
                }}
                className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-white/60 transition hover:bg-white/[0.06] sm:flex-none"
              >
                ↻ Refresh
              </button>

              <button
                onClick={logout}
                className="flex-1 rounded-xl border border-red-400/20 px-4 py-3 text-sm font-bold text-red-300 transition hover:bg-red-500/10 sm:flex-none"
              >
                Keluar
              </button>
            </div>
          </div>
        </section>

        {/* PRODUCT CATALOG */}
        <section>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-black sm:text-2xl">
                Product Catalog
              </h2>

              <p className="mt-1 text-xs text-white/35">
                {filteredProducts.length} produk ·{" "}
                {products.reduce(
                  (total, product) =>
                    total +
                    product.options.reduce(
                      (sum, option) =>
                        sum + getAvailableStock(option),
                      0,
                    ),
                  0,
                )}{" "}
                stok tersedia
              </p>
            </div>
          </div>

          {/* SEARCH */}
          <div className="mb-3">
            <div className="flex items-center rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3 transition focus-within:border-purple-400/40">
              <span className="mr-3 text-sm text-white/35">
                ⌕
              </span>

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Cari produk..."
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/25"
              />

              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="text-xs text-white/35 hover:text-white/70"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* CATEGORIES */}
          <div className="mb-5 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">
            {categories.map((item) => {
              const active = category === item;

              return (
                <button
                  key={item}
                  onClick={() => setCategory(item)}
                  className={`shrink-0 rounded-full border px-4 py-2 text-[11px] font-bold transition ${
                    active
                      ? "border-purple-400/40 bg-purple-500/20 text-purple-200"
                      : "border-white/10 bg-white/[0.025] text-white/45 hover:border-white/20 hover:text-white/70"
                  }`}
                >
                  {item === "ALL" ? "SEMUA" : item}
                </button>
              );
            })}
          </div>

          {/* PRODUCTS */}
          {filteredProducts.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center">
              <p className="text-sm font-bold text-white/50">
                Produk tidak ditemukan
              </p>

              <button
                onClick={() => {
                  setSearch("");
                  setCategory("ALL");
                }}
                className="mt-4 rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-white/60 hover:bg-white/[0.06]"
              >
                Reset Filter
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
              {filteredProducts.map((product) => {
                const stock = product.options.reduce(
                  (sum, option) =>
                    sum + getAvailableStock(option),
                  0,
                );

                const logo = product.imageUrl || "";

                const availablePrices = product.options
                  .filter(
                    (option) =>
                      getAvailableStock(option) > 0,
                  )
                  .map((option) => option.price);

                const allPrices = product.options.map(
                  (option) => option.price,
                );

                const prices =
                  availablePrices.length > 0
                    ? availablePrices
                    : allPrices;

                const startingPrice =
                  prices.length > 0
                    ? Math.min(...prices)
                    : 0;

                return (
                  <article
                    key={product.id}
                    className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] p-2.5 transition hover:-translate-y-0.5 hover:border-purple-400/30 hover:bg-white/[0.04] sm:rounded-3xl sm:p-3"
                  >
                    <button
                      onClick={() => pick(product)}
                      className="block w-full text-left"
                    >
                      <div className="relative flex h-32 w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/30 sm:h-40 sm:rounded-2xl">
                        {logo ? (
                          <img
                            src={logo.trim()}
                            alt={product.name}
                            className="h-full w-full object-contain p-3 transition duration-300 group-hover:scale-[1.03] sm:p-5"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={(event) => {
                              event.currentTarget.style.display =
                                "none";
                            }}
                          />
                        ) : (
                          <span className="text-3xl text-white/20">
                            ◈
                          </span>
                        )}

                        <span className="absolute left-2 top-2 rounded-md border border-white/10 bg-black/70 px-2 py-1 text-[8px] font-bold text-white/55 backdrop-blur">
                          {getCategory(product.name)}
                        </span>
                      </div>

                      <div className="px-1 pb-1 pt-3 sm:px-1.5 sm:pt-4">
                        <h3 className="truncate text-sm font-black sm:text-base">
                          {product.name}
                        </h3>

                        <p className="mt-2 text-[9px] font-medium uppercase tracking-wider text-white/30 sm:text-[10px]">
                          Harga mulai dari
                        </p>

                        <p className="mt-0.5 text-sm font-black text-white sm:text-base">
                          {rupiah(startingPrice)}
                        </p>

                        <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/5 pt-3">
                          <span
                            className={`text-[9px] font-bold sm:text-[10px] ${
                              stock > 0
                                ? "text-emerald-300"
                                : "text-red-300"
                            }`}
                          >
                            {stock > 0
                              ? `${stock} STOCK`
                              : "SOLD OUT"}
                          </span>

                          <span className="text-[10px] font-bold text-white/35 transition group-hover:text-purple-300 sm:text-xs">
                            Detail →
                          </span>
                        </div>
                      </div>
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* HISTORY */}
        {history.length > 0 && (
          <section className="mx-auto mt-10 max-w-4xl">
            <div className="mb-4">
              <h2 className="text-xl font-black">
                Riwayat Pembelian
              </h2>

              <p className="mt-1 text-xs text-white/35">
                20 transaksi terakhir
              </p>
            </div>

            <div className="space-y-2">
              {history.slice(0, 20).map((order: any) => (
                <div
                  key={order.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">
                        {order.productName} ·{" "}
                        {order.duration}
                      </p>

                      <p className="mt-1 text-[11px] text-white/35">
                        {order.invoice} ·{" "}
                        {new Date(
                          order.createdAt,
                        ).toLocaleString("id-ID")}
                      </p>
                    </div>

                    <p className="shrink-0 text-sm font-black text-emerald-300">
                      {rupiah(order.amount)}
                    </p>
                  </div>

                  {order.paymentRef && (
                    <div className="mt-3 flex items-center gap-2 rounded-xl bg-black/30 p-2">
                      <p className="min-w-0 flex-1 break-all font-mono text-xs text-purple-100">
                        {order.paymentRef}
                      </p>

                      <button
                        onClick={() =>
                          copy(order.paymentRef)
                        }
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
      </div>

      {/* PRODUCT DETAIL MODAL */}
      {selProduct && !result && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-3 backdrop-blur-md sm:p-5"
          onClick={() => {
            setSelProduct(null);
            setSelOption(null);
          }}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-[#08080b] shadow-2xl shadow-black/70"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="max-h-[90vh] overflow-y-auto">
              {/* MODAL HEADER */}
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#08080b]/95 px-5 py-4 backdrop-blur-xl sm:px-6">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-purple-300/70">
                    {getCategory(selProduct.name)}
                  </p>

                  <h2 className="mt-1 text-xl font-black sm:text-2xl">
                    {selProduct.name}
                  </h2>
                </div>

                <button
                  onClick={() => {
                    setSelProduct(null);
                    setSelOption(null);
                  }}
                  className="flex size-9 items-center justify-center rounded-xl border border-white/10 text-white/45 transition hover:bg-white/[0.06] hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 sm:p-6">
                {/* PRODUCT IMAGE */}
                <div className="mb-5 flex h-44 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/30 sm:h-56">
                  {selProduct.imageUrl ? (
                    <img
                      src={selProduct.imageUrl.trim()}
                      alt={selProduct.name}
                      className="h-full w-full object-contain p-6"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="text-5xl text-white/20">
                      ◈
                    </span>
                  )}
                </div>

                {/* OPTIONS */}
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-white/35">
                        Pilih Durasi
                      </p>

                      <p className="mt-1 text-sm text-white/50">
                        Harga khusus reseller
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    {selProduct.options.map((option) => {
                      const stock =
                        getAvailableStock(option);

                      const active =
                        selOption?.id === option.id;

                      return (
                        <button
                          key={option.id}
                          disabled={stock <= 0}
                          onClick={() =>
                            selectOption(option)
                          }
                          className={`w-full rounded-2xl border p-4 text-left transition ${
                            active
                              ? "border-purple-400/50 bg-purple-500/10"
                              : "border-white/10 bg-white/[0.025] hover:border-white/20"
                          } ${
                            stock <= 0
                              ? "cursor-not-allowed opacity-35"
                              : ""
                          }`}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-sm font-black">
                                {option.duration}
                              </p>

                              <p className="mt-1 text-[11px] text-white/35">
                                {stock > 0
                                  ? `${stock} tersedia`
                                  : "Stok habis"}
                              </p>
                            </div>

                            <div className="text-right">
                              {option.hasResellerPrice &&
                                option.normalPrice >
                                  option.price && (
                                  <p className="text-[10px] text-white/25 line-through">
                                    {rupiah(
                                      option.normalPrice,
                                    )}
                                  </p>
                                )}

                              <p className="text-sm font-black text-emerald-300">
                                {rupiah(option.price)}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* PURCHASE */}
                {selOption && (
                  <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-white/30">
                          Total
                        </p>

                        <p className="mt-1 text-xl font-black">
                          {rupiah(selOption.price)}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wider text-white/30">
                          Saldo
                        </p>

                        <p className="mt-1 text-sm font-bold text-white/70">
                          {rupiah(balance)}
                        </p>
                      </div>
                    </div>

                    {balance < selOption.price &&
                      getAvailableStock(selOption) >
                        0 && (
                        <p className="mt-3 rounded-xl bg-amber-400/[0.06] px-3 py-2 text-[11px] text-amber-200/70">
                          Saldo kurang{" "}
                          {rupiah(
                            selOption.price -
                              balance,
                          )}
                          . Isi saldo lewat halaman{" "}
                          <a
                            href="/member"
                            className="font-bold underline"
                          >
                            Member
                          </a>
                          .
                        </p>
                      )}

                    <button
                      onClick={buy}
                      disabled={!canBuy}
                      className="mt-4 w-full rounded-2xl bg-gradient-to-r from-purple-500 to-blue-500 px-6 py-4 text-sm font-black transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-white/10 disabled:bg-none disabled:text-white/30"
                    >
                      {buying
                        ? "Memproses..."
                        : getAvailableStock(
                              selOption,
                            ) <= 0
                          ? "Stok Habis"
                          : balance <
                              selOption.price
                            ? "Saldo Tidak Cukup"
                            : "Beli Sekarang →"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS MODAL */}
      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl border border-emerald-400/20 bg-[#09090b] p-6 shadow-2xl sm:p-7">
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-emerald-400/10 text-3xl ring-1 ring-emerald-400/20">
              ✓
            </div>

            <h2 className="mt-5 text-center text-2xl font-black">
              Pembelian Berhasil
            </h2>

            <div className="mt-6 space-y-2 rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-white/40">
                  Produk
                </span>

                <span className="font-bold">
                  {result.product}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-white/40">
                  Durasi
                </span>

                <span className="font-bold">
                  {result.duration}
                </span>
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
                  onClick={() =>
                    copy(result.deliveryKey || "")
                  }
                  className="mt-4 w-full rounded-xl bg-white px-4 py-3 text-sm font-black text-black"
                >
                  {copied
                    ? "✓ Berhasil Disalin"
                    : "Salin Key"}
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
                  onClick={() =>
                    copy(result.deliveryLink || "")
                  }
                  className="mt-4 w-full rounded-xl bg-white px-4 py-3 text-sm font-black text-black"
                >
                  {copied
                    ? "✓ Berhasil Disalin"
                    : "Salin Link"}
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
