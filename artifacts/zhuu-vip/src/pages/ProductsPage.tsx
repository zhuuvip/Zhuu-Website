import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/react";

const API_BASE = "https://zhuuapi.vercel.app";
const WA = "62882005730502";

type ProductOption = {
  id: number | string;
  duration: string;
  price: number;
  stock: number;
  dripVariantId?: number | null;
  dripStock?: number | null;
};

type Product = {
  id: number | string;
  name: string;
  description?: string;
  imageUrl?: string;
  image?: string;
  logo?: string;
  options: ProductOption[];
};

const getAvailableStock = (option: ProductOption) =>
  option.dripVariantId
    ? Number(option.dripStock ?? 0)
    : Number(option.stock ?? 0);

export default function ProductsPage() {
  const { getToken } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedOption, setSelectedOption] = useState<ProductOption | null>(null);

  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [walletLoading, setWalletLoading] = useState(true);
  const [error, setError] = useState("");

  const [buying, setBuying] = useState(false);
  const [purchaseResult, setPurchaseResult] = useState<{
    product: string;
    duration: string;
    deliveryKey?: string;
    deliveryLink?: string;
  } | null>(null);

  const [copied, setCopied] = useState(false);

  const formatRupiah = (value: number) =>
    `Rp${Number(value || 0).toLocaleString("id-ID")}`;

  const loadProducts = async () => {
    try {
      setError("");

      const res = await fetch(`${API_BASE}/api/products`, {
        cache: "no-store",
      });

      const data = await res.json().catch(() => []);

      if (!res.ok || !Array.isArray(data)) {
        throw new Error("Gagal mengambil produk.");
      }

      const normalized: Product[] = data.map((product: any) => ({
        ...product,
        options: Array.isArray(product.options) ? product.options : [],
      }));

      setProducts(normalized);

      setSelectedProduct((current) => {
        const next =
          normalized.find((item) => item.id === current?.id) ??
          normalized[0] ??
          null;

        if (next) {
          setSelectedOption((currentOption) => {
            const matching =
              next.options.find((item) => item.id === currentOption?.id) ??
              next.options.find((item) => getAvailableStock(item) > 0) ??
              next.options[0] ??
              null;

            return matching;
          });
        } else {
          setSelectedOption(null);
        }

        return next;
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal memuat produk."
      );
    } finally {
      setLoading(false);
    }
  };

  const loadWallet = async () => {
    try {
      setWalletLoading(true);

      const token = await getToken();
      if (!token) {
        setBalance(0);
        return;
      }

      const res = await fetch(`${API_BASE}/api/wallet`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      if (!res.ok) return;

      const data = await res.json();
      setBalance(Number(data.balance || 0));
    } catch {
      // Wallet gagal dimuat tidak boleh merusak halaman produk.
    } finally {
      setWalletLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
    loadWallet();
  }, []);

  const selectedPrice = Number(selectedOption?.price || 0);

  const canBuy = Boolean(
    selectedProduct &&
      selectedOption &&
      getAvailableStock(selectedOption) > 0 &&
      selectedPrice > 0 &&
      balance >= selectedPrice &&
      !buying
  );

  const totalStock = useMemo(
    () =>
      products.reduce(
        (total, product) =>
          total +
          product.options.reduce(
            (sum, option) => sum + Math.max(0, getAvailableStock(option)),
            0
          ),
        0
      ),
    [products]
  );

  const selectProduct = (product: Product) => {
    setSelectedProduct(product);

    const available =
      product.options.find((option) => getAvailableStock(option) > 0) ??
      product.options[0] ??
      null;

    setSelectedOption(available);
  };

  const selectOption = (option: ProductOption) => {
    if (getAvailableStock(option) <= 0) return;
    setSelectedOption(option);
  };

  const buyProduct = async () => {
    if (!selectedProduct || !selectedOption || buying) return;

    if (getAvailableStock(selectedOption) <= 0) {
      alert("Stok produk ini sudah habis.");
      return;
    }

    if (balance < selectedOption.price) {
      alert(
        [
          "Saldo tidak cukup.",
          "",
          `Saldo: ${formatRupiah(balance)}`,
          `Harga: ${formatRupiah(selectedOption.price)}`,
          `Kurang: ${formatRupiah(selectedOption.price - balance)}`,
          "",
          "Silakan deposit terlebih dahulu.",
        ].join("\n")
      );
      return;
    }

    try {
      setBuying(true);

      const token = await getToken();

      if (!token) {
        alert("Silakan login terlebih dahulu.");
        return;
      }

      const res = await fetch(`${API_BASE}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId: selectedProduct.id,
          optionId: selectedOption.id,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Gagal membeli produk.");
      }

      const newBalance = Number(data.balance);

      if (Number.isFinite(newBalance)) {
        setBalance(newBalance);
      } else {
        await loadWallet();
      }

      setPurchaseResult({
        product: selectedProduct.name,
        duration: selectedOption.duration,
        deliveryKey: data.deliveryKey || undefined,
        deliveryLink: data.deliveryLink || undefined,
      });

      setCopied(false);

      // Refresh stok setelah pembelian.
      await loadProducts();
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "Gagal terhubung ke server."
      );
    } finally {
      setBuying(false);
    }
  };

  const copyKey = async () => {
    if (!purchaseResult?.deliveryKey) return;

    try {
      await navigator.clipboard.writeText(purchaseResult.deliveryKey);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      alert("Gagal menyalin key. Silakan salin secara manual.");
    }
  };

  const contactAdmin = () => {
    const message = [
      "Halo Admin Zhuu Shop 👋",
      "",
      "Saya ingin bertanya mengenai produk.",
      "",
      `Produk: ${selectedProduct?.name || "-"}`,
      `Durasi: ${selectedOption?.duration || "-"}`,
      "",
      "Mohon bantuannya, Admin.",
    ].join("\n");

    window.open(
      `https://wa.me/${WA}?text=${encodeURIComponent(message)}`,
      "_blank"
    );
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-4 py-10 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 space-y-3">
            <div className="mx-auto h-10 w-56 animate-pulse rounded-xl bg-white/10" />
            <div className="mx-auto h-4 w-72 animate-pulse rounded bg-white/5" />
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div
                key={item}
                className="h-80 animate-pulse rounded-3xl border border-white/10 bg-white/[0.03]"
              />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-black px-4 py-16 text-white">
        <div className="mx-auto max-w-xl rounded-3xl border border-red-500/20 bg-red-500/[0.04] p-8 text-center">
          <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-red-500/10 text-2xl">
            !
          </div>

          <h1 className="text-xl font-bold">Produk gagal dimuat</h1>

          <p className="mt-2 text-sm text-white/50">{error}</p>

          <button
            onClick={() => {
              setLoading(true);
              loadProducts();
            }}
            className="mt-6 rounded-xl bg-white px-6 py-3 font-bold text-black transition hover:scale-[1.02] active:scale-[0.98]"
          >
            Coba Lagi
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-purple-600/[0.08] blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[500px] rounded-full bg-blue-600/[0.05] blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        {/* Header */}
        <section className="mb-8 text-center sm:mb-12">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold tracking-widest text-white/60">
            <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.8)]" />
            ZHUU STORE
          </div>

          <h1 className="text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
            Premium{" "}
            <span className="bg-gradient-to-r from-purple-400 via-fuchsia-300 to-blue-400 bg-clip-text text-transparent">
              Products
            </span>
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/45 sm:text-base">
            Pilih produk, tentukan durasi, lalu lakukan pembelian langsung
            menggunakan saldo wallet kamu.
          </p>
        </section>

        {/* Wallet */}
        <section className="mb-8 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-center gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 ring-1 ring-white/10">
                <span className="text-xl">◈</span>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
                  Saldo Wallet
                </p>

                <div className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                  {walletLoading ? (
                    <span className="inline-block h-8 w-36 animate-pulse rounded-lg bg-white/10" />
                  ) : (
                    formatRupiah(balance)
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <a
                href="/member"
                className="flex flex-1 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-bold transition hover:bg-white/[0.08] active:scale-[0.98] sm:flex-none"
              >
                + Deposit
              </a>

              <button
                onClick={loadWallet}
                disabled={walletLoading}
                className="rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-white/60 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
                title="Refresh saldo"
              >
                ↻
              </button>
            </div>
          </div>
        </section>

        {/* Stats */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold sm:text-2xl">Produk</h2>
            <p className="mt-1 text-xs text-white/35">
              {products.length} produk · {totalStock} stok tersedia
            </p>
          </div>

          <button
            onClick={loadProducts}
            className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-white/50 transition hover:bg-white/[0.06] hover:text-white"
          >
            ↻ Refresh
          </button>
        </div>

        {/* Product grid */}
        {products.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center">
            <div className="text-4xl">📦</div>
            <h2 className="mt-4 text-lg font-bold">Belum ada produk</h2>
            <p className="mt-2 text-sm text-white/40">
              Produk akan muncul di sini ketika sudah tersedia.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => {
              const isSelected = selectedProduct?.id === product.id;
              const availableStock = product.options.reduce(
                (sum, option) => sum + Math.max(0, getAvailableStock(option)),
                0
              );
              const logo =
                product.imageUrl || product.image || product.logo || "";

              return (
                <article
                  key={product.id}
                  className={`group relative overflow-hidden rounded-3xl border bg-white/[0.025] p-4 transition duration-300 sm:p-5 ${
                    isSelected
                      ? "border-purple-400/40 bg-purple-500/[0.035] shadow-xl shadow-purple-950/20"
                      : "border-white/10 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.04]"
                  }`}
                >
                  {/* Selected indicator */}
                  {isSelected && (
                    <div className="absolute right-4 top-4 z-10 rounded-full border border-purple-300/20 bg-purple-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-purple-200">
                      Dipilih
                    </div>
                  )}

                  {/* Logo / image */}
                  <button
                    onClick={() => selectProduct(product)}
                    className="relative mb-5 flex h-40 w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/30 transition group-hover:border-white/15"
                  >
                    {logo ? (
                      <img
                        src={logo.trim()}
                        alt={product.name}
                        className="h-full w-full object-contain p-7 transition duration-500 group-hover:scale-105"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-purple-500/15 to-blue-500/15 text-4xl ring-1 ring-white/10">
                        ◈
                      </div>
                    )}

                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 to-transparent" />
                  </button>

                  {/* Product info */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-black">
                        {product.name}
                      </h3>

                      {product.description && (
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/40">
                          {product.description}
                        </p>
                      )}
                    </div>

                    <span
                      className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold ${
                        availableStock > 0
                          ? "bg-emerald-400/10 text-emerald-300"
                          : "bg-red-400/10 text-red-300"
                      }`}
                    >
                      {availableStock > 0
                        ? `${availableStock} STOCK`
                        : "SOLD OUT"}
                    </span>
                  </div>

                  {/* Options */}
                  <div className="mt-5 space-y-2">
                    {product.options.map((option) => {
                      const active =
                        isSelected && selectedOption?.id === option.id;

                      return (
                        <button
                          key={option.id}
                          disabled={getAvailableStock(option) <= 0}
                          onClick={() => {
                            selectProduct(product);
                            selectOption(option);
                          }}
                          className={`w-full rounded-2xl border p-3 text-left transition ${
                            active
                              ? "border-purple-400/40 bg-purple-500/10 shadow-lg shadow-purple-950/20"
                              : "border-white/8 bg-white/[0.025] hover:border-white/15 hover:bg-white/[0.05]"
                          } ${
                            getAvailableStock(option) <= 0
                              ? "cursor-not-allowed opacity-35"
                              : ""
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold">
                                {option.duration}
                              </p>

                              <p className="mt-1 text-[11px] text-white/35">
                                {getAvailableStock(option) > 0
                                  ? `${getAvailableStock(option)} tersedia`
                                  : "Stok habis"}
                              </p>
                            </div>

                            <p className="text-sm font-black">
                              {formatRupiah(option.price)}
                            </p>
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

        {/* Checkout panel */}
        {selectedProduct && selectedOption && (
          <section className="sticky bottom-3 z-20 mx-auto mt-8 max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-black/85 p-4 shadow-2xl shadow-black/60 backdrop-blur-2xl sm:bottom-5 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                  Pilihan kamu
                </p>

                <div className="mt-1 flex items-center gap-2">
                  <h3 className="truncate font-black">
                    {selectedProduct.name}
                  </h3>

                  <span className="shrink-0 rounded-lg bg-white/5 px-2 py-1 text-[10px] font-semibold text-white/45">
                    {selectedOption.duration}
                  </span>
                </div>

                <p className="mt-1 text-lg font-black">
                  {formatRupiah(selectedOption.price)}
                </p>
              </div>

              <button
                onClick={buyProduct}
                disabled={!canBuy}
                className="w-full rounded-2xl bg-gradient-to-r from-purple-500 to-blue-500 px-6 py-4 text-sm font-black shadow-lg shadow-purple-950/30 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/10 disabled:bg-none disabled:text-white/30 disabled:shadow-none sm:w-auto sm:min-w-52"
              >
                {buying
                  ? "Memproses..."
                  : getAvailableStock(selectedOption) <= 0
                    ? "Stok Habis"
                    : balance < selectedOption.price
                      ? "Saldo Tidak Cukup"
                      : "Beli Sekarang →"}
              </button>
            </div>

            {balance < selectedOption.price &&
              getAvailableStock(selectedOption) > 0 &&
              !walletLoading && (
                <div className="mt-3 flex items-center justify-between rounded-xl bg-amber-400/[0.06] px-3 py-2 text-[11px] text-amber-200/70">
                  <span>
                    Saldo kurang {formatRupiah(selectedOption.price - balance)}
                  </span>

                  <a
                    href="/member"
                    className="font-bold text-amber-200 hover:underline"
                  >
                    Deposit →
                  </a>
                </div>
              )}
          </section>
        )}

        {/* Help */}
        <div className="mx-auto mt-8 flex max-w-3xl flex-col items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-4 text-center sm:flex-row sm:text-left">
          <div>
            <p className="text-sm font-bold">Butuh bantuan?</p>
            <p className="mt-1 text-xs text-white/35">
              Hubungi admin jika ada masalah dengan pembelian.
            </p>
          </div>

          <button
            onClick={contactAdmin}
            className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-bold transition hover:bg-white/[0.06]"
          >
            WhatsApp Admin
          </button>
        </div>
      </div>

      {/* Purchase success modal */}
      {purchaseResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-emerald-400/20 bg-[#09090b] shadow-2xl shadow-black/70">
            <div className="p-6 sm:p-7">
              <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-emerald-400/10 text-3xl ring-1 ring-emerald-400/20">
                ✓
              </div>

              <div className="mt-5 text-center">
                <h2 className="text-2xl font-black">Pembelian Berhasil</h2>
                <p className="mt-2 text-sm text-white/40">
                  Pesanan kamu berhasil diproses.
                </p>
              </div>

              <div className="mt-6 space-y-2 rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-white/40">Produk</span>
                  <span className="text-right font-bold">
                    {purchaseResult.product}
                  </span>
                </div>

                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-white/40">Durasi</span>
                  <span className="font-bold">
                    {purchaseResult.duration}
                  </span>
                </div>
              </div>

              {purchaseResult.deliveryKey && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/40">
                    Delivery Key
                  </p>

                  <div className="rounded-2xl border border-purple-400/20 bg-purple-500/[0.06] p-4">
                    <p className="break-all font-mono text-sm leading-6 text-purple-100">
                      {purchaseResult.deliveryKey}
                    </p>

                    <button
                      onClick={copyKey}
                      className="mt-4 w-full rounded-xl bg-white px-4 py-3 text-sm font-black text-black transition hover:bg-white/90 active:scale-[0.98]"
                    >
                      {copied ? "✓ Berhasil Disalin" : "Salin Key"}
                    </button>
                  </div>
                </div>
              )}

              {purchaseResult.deliveryLink && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/40">
                    Delivery Link
                  </p>

                  <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.06] p-4">
                    <a
                      href={purchaseResult.deliveryLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block break-all text-sm leading-6 text-cyan-300 underline"
                    >
                      {purchaseResult.deliveryLink}
                    </a>

                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(
                            purchaseResult.deliveryLink || ""
                          );
                          setCopied(true);
                          window.setTimeout(() => setCopied(false), 1800);
                        } catch {
                          alert("Gagal menyalin link. Silakan salin secara manual.");
                        }
                      }}
                      className="mt-4 w-full rounded-xl bg-white px-4 py-3 text-sm font-black text-black transition hover:bg-white/90 active:scale-[0.98]"
                    >
                      {copied ? "✓ Berhasil Disalin" : "Salin Link"}
                    </button>

                    <a
                      href={purchaseResult.deliveryLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 block w-full rounded-xl bg-cyan-400 px-4 py-3 text-center text-sm font-black text-black transition hover:bg-cyan-300 active:scale-[0.98]"
                    >
                      Buka Link
                    </a>
                  </div>
                </div>
              )}

              <button
                onClick={() => setPurchaseResult(null)}
                className="mt-4 w-full rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-white/70 transition hover:bg-white/[0.06] hover:text-white"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
