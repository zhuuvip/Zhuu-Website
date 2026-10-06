import { useEffect, useMemo, useState } from "react";
import { getImageUrl } from "../lib/imageUrl";

const API_BASE = (import.meta.env.VITE_API_URL || "https://zhuuapi.vercel.app").replace(/\/$/, "");
const WA = "62882005730502";
const TOKEN_KEY = "reseller_token";

type ProductOption = {
  id: number | string;
  duration: string;
  price: number;
  normalPrice?: number;
  hasResellerPrice?: boolean;
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

export default function ResellerDashboardPage() {

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedOption, setSelectedOption] = useState<ProductOption | null>(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");

  const [balance, setBalance] = useState(0);
  const [username, setUsername] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [walletEmail, setWalletEmail] = useState("");
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [walletLoading, setWalletLoading] = useState(true);
  const [error, setError] = useState("");

  const [buying, setBuying] = useState(false);

  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState<{
    code: string;
    discount: number;
    originalPrice: number;
    finalPrice: number;
  } | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState("");

  const [purchaseResult, setPurchaseResult] = useState<{
    product: string;
    duration: string;
    deliveryKey?: string;
    deliveryLink?: string;
  } | null>(null);

  const [copied, setCopied] = useState(false);

  const [apiKeyPrefix, setApiKeyPrefix] = useState("");
  const [apiKeyEnabled, setApiKeyEnabled] = useState(false);
  const [apiKeyCreatedAt, setApiKeyCreatedAt] = useState("");
  const [newApiKey, setNewApiKey] = useState("");
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);
  const [apiKeyMsg, setApiKeyMsg] = useState("");

  const formatRupiah = (value: number) =>
    `Rp${Number(value || 0).toLocaleString("id-ID")}`;

  const resellerApi = async (endpoint: string, init: RequestInit = {}) => {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
      window.location.href = "/reseller-login";
      throw new Error("Belum login.");
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...init,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init.headers || {}),
      },
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = "/reseller-login";
      throw new Error("Sesi reseller berakhir.");
    }

    if (!res.ok) {
      throw new Error(data.error || "Terjadi kesalahan.");
    }

    return data;
  };

  const loadProducts = async () => {
    try {
      setError("");

      const data = await resellerApi("/api/reseller/products");

      const normalized: Product[] = Array.isArray(data)
        ? data.map((product: any) => ({
            ...product,
            options: Array.isArray(product.options)
              ? product.options
              : [],
          }))
        : [];

      setProducts(normalized);

      setSelectedProduct((current) => {
        const next =
          current?.id
          ? normalized.find((item) => item.id === current.id) ?? null
          : null;

        if (next) {
          setSelectedOption((currentOption) => {
            return (
              next.options.find(
                (item) => item.id === currentOption?.id
              ) ??
              next.options.find(
                (item) => getAvailableStock(item) > 0
              ) ??
              next.options[0] ??
              null
            );
          });
        } else {
          setSelectedOption(null);
        }

        return next;
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal memuat produk."
      );
    } finally {
      setLoading(false);
    }
  };

  const loadWallet = async () => {
    try {
      setWalletLoading(true);

      const me = await resellerApi("/api/reseller/me");

      setUsername(String(me.username || ""));
      setBalance(Number(me.balance || 0));
      setWalletEmail(String(me.walletEmail || ""));
    } catch {
      setBalance(0);
    } finally {
      setWalletLoading(false);
    }
  };

  const loadApiKey = async () => {
    try {
      const data = await resellerApi("/api/reseller/api-key");
      setApiKeyPrefix(String(data.prefix || ""));
      setApiKeyEnabled(Boolean(data.enabled));
      setApiKeyCreatedAt(String(data.createdAt || ""));
    } catch {
      setApiKeyPrefix("");
      setApiKeyEnabled(false);
      setApiKeyCreatedAt("");
    }
  };

  const generateApiKey = async () => {
    if (
      !window.confirm(
        apiKeyEnabled
          ? "Generate API Key baru? API Key lama akan langsung tidak berlaku."
          : "Generate API Key untuk akun reseller ini?"
      )
    ) {
      return;
    }

    try {
      setApiKeyLoading(true);
      setApiKeyMsg("");
      setNewApiKey("");

      const data = await resellerApi("/api/reseller/api-key", {
        method: "POST",
      });

      setNewApiKey(String(data.apiKey || ""));
      setApiKeyPrefix(String(data.prefix || ""));
      setApiKeyEnabled(Boolean(data.enabled));
      setApiKeyCreatedAt(new Date().toISOString());
      setApiKeyCopied(false);
      setApiKeyMsg("API Key berhasil dibuat. Simpan sekarang, key lengkap hanya ditampilkan sekali.");
    } catch (err) {
      setApiKeyMsg(
        err instanceof Error ? err.message : "Gagal membuat API Key."
      );
    } finally {
      setApiKeyLoading(false);
    }
  };

  const copyApiKey = async () => {
    if (!newApiKey) return;

    try {
      await navigator.clipboard.writeText(newApiKey);
      setApiKeyCopied(true);
      window.setTimeout(() => setApiKeyCopied(false), 2000);
    } catch {
      setApiKeyMsg("Gagal menyalin API Key.");
    }
  };

  const revokeApiKey = async () => {
    if (!window.confirm("Revoke API Key? Semua request dengan key ini akan ditolak.")) {
      return;
    }

    try {
      setApiKeyLoading(true);
      setApiKeyMsg("");

      await resellerApi("/api/reseller/api-key", {
        method: "DELETE",
      });

      setNewApiKey("");
      setApiKeyPrefix("");
      setApiKeyEnabled(false);
      setApiKeyCreatedAt("");
      setApiKeyMsg("API Key berhasil di-revoke.");
    } catch (err) {
      setApiKeyMsg(
        err instanceof Error ? err.message : "Gagal revoke API Key."
      );
    } finally {
      setApiKeyLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const data = await resellerApi("/api/reseller/orders");
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      setHistory([]);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
      window.location.href = "/reseller-login";
      return;
    }

    loadProducts();
    loadWallet();
    loadHistory();
    loadApiKey();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const checkSession = window.setInterval(() => {
      resellerApi("/api/reseller/me").catch(() => {});
    }, 10000);

    return () => window.clearInterval(checkSession);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getProductLogo = (product: Product) =>
    getImageUrl(product.imageUrl || product.image || product.logo || "");

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

  const categories = useMemo(() => {
    const values = products.map((product) => getCategory(product.name));
    return ["ALL", ...Array.from(new Set(values))];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory =
        category === "ALL" || getCategory(product.name) === category;

      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        getCategory(product.name).toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [products, search, category]);

  const selectedPrice = Number(selectedOption?.price || 0);

  const finalPrice =
    promoApplied && promoApplied.originalPrice === selectedPrice
      ? promoApplied.finalPrice
      : selectedPrice;

  const canBuy = Boolean(
    selectedProduct &&
      selectedOption &&
      getAvailableStock(selectedOption) > 0 &&
      finalPrice > 0 &&
      balance >= finalPrice &&
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
    setPromoApplied(null);
    setPromoError("");
    setSelectedProduct(product);

    const available =
      product.options.find((option) => getAvailableStock(option) > 0) ??
      product.options[0] ??
      null;

    setSelectedOption(available);
  };

  const selectOption = (option: ProductOption) => {
    if (getAvailableStock(option) <= 0) return;
    setPromoApplied(null);
    setPromoError("");
    setSelectedOption(option);
  };

  const applyPromoCode = async () => {
    const code = promoCode.trim();

    if (!selectedProduct || !selectedOption || !code || promoLoading) {
      return;
    }

    try {
      setPromoLoading(true);
      setPromoError("");

      const data = await resellerApi("/api/reseller/validate-promo", {
        method: "POST",
        body: JSON.stringify({
          code,
          productId: selectedProduct.id,
          optionId: selectedOption.id,
        }),
      });

      setPromoApplied({
        code: String(data.code || code).toUpperCase(),
        discount: Number(data.discount || 0),
        originalPrice: Number(data.originalPrice || selectedPrice),
        finalPrice: Number(data.finalPrice || selectedPrice),
      });
    } catch (err) {
      setPromoApplied(null);
      setPromoError(
        err instanceof Error
          ? err.message
          : "Kode promo tidak valid."
      );
    } finally {
      setPromoLoading(false);
    }
  };

  const buyProduct = async () => {
    if (!selectedProduct || !selectedOption || buying) return;

    const stock = getAvailableStock(selectedOption);

    if (stock <= 0) {
      alert("Stok produk ini sudah habis.");
      return;
    }

    const purchasePrice =
      promoApplied &&
      promoApplied.originalPrice === Number(selectedOption.price)
        ? promoApplied.finalPrice
        : Number(selectedOption.price);

    if (balance < purchasePrice) {
      alert([
        "Saldo tidak cukup.",
        "",
        `Saldo: ${formatRupiah(balance)}`,
        `Harga: ${formatRupiah(purchasePrice)}`,
        `Kurang: ${formatRupiah(purchasePrice - balance)}`,
        "",
        "Silakan isi saldo terlebih dahulu.",
      ].join("\n"));
      return;
    }

    try {
      setBuying(true);

      const idempotencyKey =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

      const data = await resellerApi("/api/reseller/orders", {
        method: "POST",
        body: JSON.stringify({
          productId: selectedProduct.id,
          optionId: selectedOption.id,
          promoCode: promoApplied?.code || undefined,
          idempotencyKey,
        }),
      });

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

      await Promise.all([
        loadProducts(),
        loadHistory(),
      ]);
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "Gagal membeli produk."
      );
    } finally {
      setBuying(false);
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = "/reseller-login";
  };

  const openSettings = () => {
    setNewUsername(username);
    setNewPassword("");
    setWalletEmail(walletEmail);
    setSettingsMsg("");
    setSettingsOpen(true);
  };

  const saveSettings = async () => {
    const cleanUsername = newUsername.trim().toLowerCase();

    if (!cleanUsername && !newPassword && !walletEmail.trim()) {
      setSettingsMsg("Isi username, password, atau email Member.");
      return;
    }

    if (cleanUsername && !/^[a-z0-9_]{3,24}$/.test(cleanUsername)) {
      setSettingsMsg("Username 3-24 karakter: huruf kecil, angka, atau underscore.");
      return;
    }

    if (newPassword && (newPassword.length < 6 || newPassword.length > 72)) {
      setSettingsMsg("Password harus 6-72 karakter.");
      return;
    }

    try {
      setSettingsLoading(true);
      setSettingsMsg("");

      const data = await resellerApi("/api/reseller/credentials", {
        method: "POST",
        body: JSON.stringify({
          username: cleanUsername || username,
          password: newPassword || undefined,
          walletEmail: walletEmail.trim().toLowerCase() || undefined,
        }),
      });

      if (data.token) {
        localStorage.setItem("reseller_token", String(data.token));
      }

      setUsername(String(data.username || cleanUsername || username));
      setWalletEmail(
        String(data.walletEmail || walletEmail.trim().toLowerCase() || ""),
      );
      setNewPassword("");
      setSettingsMsg("Pengaturan berhasil disimpan.");
    } catch (err) {
      setSettingsMsg(
        err instanceof Error ? err.message : "Gagal menyimpan pengaturan.",
      );
    } finally {
      setSettingsLoading(false);
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
      <main className="min-h-dvh bg-black px-4 py-10 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 space-y-3">
            <div className="mx-auto h-10 w-56 animate-pulse rounded-xl bg-white/[0.035]" />
            <div className="mx-auto h-4 w-72 animate-pulse rounded bg-white/[0.018]" />
          </div>

          <div className="grid gap-4 sm:p-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div
                key={item}
                className="h-80 animate-pulse rounded-2xl border border-white/[0.07] bg-white/[0.03]"
              />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-dvh bg-black px-4 py-16 text-white">
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
            className="mt-6 rounded-xl bg-white px-4 sm:px-6 py-3 font-bold text-black transition hover:scale-[1.02] active:scale-[0.98]"
          >
            Coba Lagi
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-black text-white">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-purple-600/[0.08] blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[500px] rounded-full bg-blue-600/[0.05] blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-4 sm:px-6 sm:py-12 lg:px-8">
        {/* Header */}
        <section className="mb-8 text-center sm:mb-12">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.04] px-4 py-2 text-xs font-semibold tracking-widest text-white/60">
            <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.8)]" />
            ZHUU STORE
          </div>

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Reseller{" "}
            <span className="bg-gradient-to-r from-purple-400 via-fuchsia-300 to-blue-400 bg-clip-text text-transparent">
              Products
            </span>
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/45 sm:text-base">
            Pilih produk, tentukan durasi, lalu lakukan pembelian langsung
            menggunakan saldo reseller kamu.
          </p>
        </section>

        {/* Wallet */}
        <section className="mb-8 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.035] shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="flex flex-col gap-4 sm:p-5 p-4 sm:p-5 sm:flex-row sm:items-center sm:justify-between sm:p-4 sm:p-6">
            <div className="flex items-center gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 ring-1 ring-white/10">
                <span className="text-xl">◈</span>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/40">
                  Saldo Reseller
                </p>

                <div className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                  {walletLoading ? (
                    <span className="inline-block h-8 w-36 animate-pulse rounded-lg bg-white/[0.035]" />
                  ) : (
                    formatRupiah(balance)
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <span className="hidden items-center px-2 text-xs font-semibold text-white/35 sm:flex">
                {username || "Reseller"}
              </span>

              <button
                  onClick={openSettings}
                  className="rounded-xl border border-white/[0.07] px-4 py-3 text-sm font-bold text-white/60 transition hover:bg-white/[0.06] hover:text-white"
                  title="Pengaturan akun"
                >
                  ⚙ Pengaturan
                </button>
                <button
                onClick={logout}
                className="rounded-xl border border-red-400/20 px-4 py-3 text-sm font-bold text-red-300 transition hover:bg-red-500/10"
              >
                Keluar
              </button>

              <button
                onClick={loadWallet}
                disabled={walletLoading}
                className="rounded-xl border border-white/[0.07] px-4 py-3 text-sm font-bold text-white/60 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
                title="Refresh saldo"
              >
                ↻
              </button>
            </div>
          </div>
        </section>

        {/* Reseller API Key */}
        <section className="mb-8 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.035] shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="flex flex-col gap-5 p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/40">
                  Developer Access
                </p>
                <h2 className="mt-1 text-xl font-bold">
                  Reseller API Key
                </h2>
                <p className="mt-1 text-sm leading-6 text-white/40">
                  Gunakan API Key untuk mengakses produk, saldo, dan order reseller.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                    apiKeyEnabled
                      ? "bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/20"
                      : "bg-white/[0.05] text-white/35 ring-1 ring-white/[0.07]"
                  }`}
                >
                  {apiKeyEnabled ? "● Aktif" : "○ Belum aktif"}
                </span>
              </div>
            </div>

            {apiKeyEnabled && (
              <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs text-white/35">API Key</p>
                    <p className="mt-1 truncate font-mono text-sm text-white/70">
                      {apiKeyPrefix || "zhuu_live_••••••••"}
                    </p>
                    {apiKeyCreatedAt && (
                      <p className="mt-1 text-xs text-white/25">
                        Dibuat {new Date(apiKeyCreatedAt).toLocaleString("id-ID")}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={generateApiKey}
                    disabled={apiKeyLoading}
                    className="shrink-0 rounded-xl border border-purple-400/20 bg-purple-500/10 px-4 py-3 text-sm font-bold text-purple-200 transition hover:bg-purple-500/15 disabled:opacity-40"
                  >
                    {apiKeyLoading ? "Memproses..." : "Generate Baru"}
                  </button>
                </div>
              </div>
            )}

            {newApiKey && (
              <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-300/80">
                  Simpan API Key sekarang
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <code className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-white/[0.07] bg-black/30 px-4 py-3 text-xs text-white/75">
                    {newApiKey}
                  </code>
                  <button
                    onClick={copyApiKey}
                    className="shrink-0 rounded-xl border border-white/[0.07] px-4 py-3 text-sm font-bold text-white/70 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    {apiKeyCopied ? "✓ Disalin" : "Salin Key"}
                  </button>
                </div>
                <p className="mt-3 text-xs leading-5 text-amber-200/50">
                  Key lengkap hanya ditampilkan setelah dibuat. Jangan bagikan key ini kepada orang lain.
                </p>
              </div>
            )}

            {!apiKeyEnabled && !newApiKey && (
              <button
                onClick={generateApiKey}
                disabled={apiKeyLoading}
                className="w-full rounded-xl border border-purple-400/20 bg-purple-500/10 px-4 py-3 text-sm font-bold text-purple-200 transition hover:bg-purple-500/15 disabled:opacity-40"
              >
                {apiKeyLoading ? "Membuat API Key..." : "Generate API Key"}
              </button>
            )}

            {apiKeyEnabled && (
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  onClick={revokeApiKey}
                  disabled={apiKeyLoading}
                  className="rounded-xl border border-red-400/20 px-4 py-3 text-sm font-bold text-red-300 transition hover:bg-red-500/10 disabled:opacity-40"
                >
                  Revoke API Key
                </button>
              </div>
            )}

            {apiKeyMsg && (
              <p className="text-sm leading-5 text-white/50">
                {apiKeyMsg}
              </p>
            )}
          </div>
        </section>

        {/* Catalog */}
        <section>
          <div className="mb-5 flex flex-col gap-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold sm:text-2xl">
                  Product Catalog
                </h2>
                <p className="mt-1 text-xs text-white/35">
                  {filteredProducts.length} produk · {totalStock} stok tersedia
                </p>
              </div>

              <button
                onClick={loadProducts}
                className="rounded-xl border border-white/[0.07] px-3 py-2 text-xs font-semibold text-white/50 transition hover:bg-white/[0.06] hover:text-white"
              >
                ↻ Refresh
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari produk..."
                className="w-full rounded-2xl border border-white/[0.07] bg-white/[0.035] px-4 py-3.5 pl-11 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-purple-400/40 focus:bg-white/[0.05]"
              />

              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/35">
                ⌕
              </span>

              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs text-white/35 hover:bg-white/[0.035] hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Categories */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categories.map((item) => (
                <button
                  key={item}
                  onClick={() => setCategory(item)}
                  className={`shrink-0 rounded-xl border px-3.5 py-2 text-[11px] font-bold transition ${
                    category === item
                      ? "border-purple-400/30 bg-purple-500/15 text-purple-200"
                      : "border-white/[0.07] bg-white/[0.025] text-white/45 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  {item === "ALL" ? "SEMUA" : item}
                </button>
              ))}
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-12 text-center">
              <div className="text-4xl">⌕</div>
              <h2 className="mt-4 text-lg font-bold">
                Produk tidak ditemukan
              </h2>
              <p className="mt-2 text-sm text-white/35">
                Coba gunakan kata pencarian atau kategori lain.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
              {filteredProducts.map((product) => {
                const availableStock = product.options.reduce(
                  (sum, option) =>
                    sum + Math.max(0, getAvailableStock(option)),
                  0
                );

                const logo = getProductLogo(product);

                const startingPrice = product.options.length
                  ? Math.min(
                      ...product.options.map((option) =>
                        Number(option.price || 0)
                      )
                    )
                  : 0;

                const productCategory = getCategory(product.name);

                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => selectProduct(product)}
                    className="group relative flex min-h-[250px] flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3 text-left transition duration-300 hover:-translate-y-1 hover:border-purple-400/25 hover:bg-white/[0.045] active:scale-[0.98] sm:min-h-[280px] sm:rounded-3xl sm:p-4"
                  >
                    {/* Logo */}
                    <div className="relative flex h-32 w-full items-center justify-center overflow-hidden rounded-xl border border-white/8 bg-black/30 sm:h-40 sm:rounded-2xl">
                      {logo ? (
                        <img
                          src={logo.trim()}
                          alt={product.name}
                          className="h-full w-full object-contain p-4 sm:p-5 transition duration-500 group-hover:scale-105 sm:p-7"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/15 to-blue-500/15 text-3xl ring-1 ring-white/10">
                          ◈
                        </div>
                      )}

                      <div className="absolute left-2 top-2 rounded-lg border border-white/[0.07] bg-black/60 px-2 py-1 text-[9px] font-bold tracking-[0.12em] text-white/60 backdrop-blur">
                        {productCategory}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="mt-3 min-w-0 flex-1">
                      <h3 className="line-clamp-2 text-sm font-bold leading-5 sm:text-base">
                        {product.name}
                      </h3>

                      <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-white/30">
                        Harga mulai dari
                      </p>

                      <p className="mt-0.5 text-sm font-bold text-white sm:text-base">
                        {startingPrice > 0
                          ? formatRupiah(startingPrice)
                          : "Hubungi Admin"}
                      </p>
                    </div>

                    {/* Bottom */}
                    <div className="mt-3 flex items-center justify-between border-t border-white/8 pt-3">
                      <span
                        className={`text-[10px] font-bold ${
                          availableStock > 0
                            ? "text-emerald-300"
                            : "text-red-300"
                        }`}
                      >
                        {availableStock > 0
                          ? `${availableStock} STOCK`
                          : "SOLD OUT"}
                      </span>

                      <span className="text-xs font-bold text-white/35 transition group-hover:translate-x-0.5 group-hover:text-white">
                        Detail →
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* HISTORY */}
      {history.length > 0 && (
        <section
            id="riwayat-pembelian"
            className="relative mx-auto max-w-7xl px-4 pb-10 sm:px-4 sm:px-6 lg:px-8"
          >
          <div className="mx-auto mt-10 max-w-4xl">
            <div className="mb-4">
              <h2 className="text-xl font-bold sm:text-2xl">
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
                  className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">
                        {order.productName || order.product || "-"} ·{" "}
                        {order.duration || "-"}
                      </p>

                      <p className="mt-1 text-[11px] text-white/35">
                        {order.invoice || "-"} ·{" "}
                        {order.createdAt
                          ? new Date(order.createdAt).toLocaleString("id-ID")
                          : "-"}
                      </p>
                    </div>

                    <p className="shrink-0 text-sm font-bold text-emerald-300">
                      {formatRupiah(Number(order.amount || 0))}
                    </p>
                  </div>

                  {order.paymentRef && (
                    <div className="mt-3 flex items-center gap-2 rounded-xl bg-black/30 p-2">
                      <p className="min-w-0 flex-1 break-all font-mono text-xs text-purple-100">
                        {order.paymentRef}
                      </p>

                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              String(order.paymentRef)
                            );
                            setCopied(true);
                            window.setTimeout(
                              () => setCopied(false),
                              1800
                            );
                          } catch {
                            alert("Gagal menyalin.");
                          }
                        }}
                        className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-black"
                      >
                        Salin
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Product Detail Modal */}
        {selectedProduct && !purchaseResult && (
          <div
            className="product-detail-modal fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto overscroll-contain bg-black/75 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] backdrop-blur-md sm:items-center sm:p-4"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setSelectedProduct(null);
                setSelectedOption(null);
              }
            }}
          >
            <div className="relative my-auto w-[calc(100%_-_2rem)] max-w-[26rem] sm:w-full sm:max-w-[28rem] lg:max-w-[38rem] overflow-hidden rounded-2xl border border-white/[0.07] bg-[#09090b] shadow-2xl shadow-black/80">
                {/* Header */}
                <div className="relative shrink-0 p-3.5 sm:p-4 lg:p-6">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProduct(null);
                      setSelectedOption(null);
                    }}
                    className="absolute right-3 top-3 z-50 flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-black/80 text-sm text-white/70 shadow-lg backdrop-blur-md transition hover:bg-white/[0.035] hover:text-white"
                  >
                    ✕
                  </button>

                  <div className="flex gap-4 pr-10 lg:gap-5">
                    <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border lg:size-20 lg:rounded-2xl border-white/[0.07] bg-black/40 sm:size-16">
                      {getProductLogo(selectedProduct) ? (
                        <img
                          src={getProductLogo(selectedProduct)}
                          alt={selectedProduct.name}
                          className="h-full w-full object-contain p-3"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="text-3xl">◈</span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <span className="inline-flex rounded-lg bg-purple-500/10 px-2 py-1 text-[9px] font-bold tracking-[0.12em] text-purple-200">
                        {getCategory(selectedProduct.name)}
                      </span>

                      <h2 className="mt-2 text-lg font-bold leading-6 sm:text-xl lg:text-2xl lg:leading-7">
                        {selectedProduct.name}
                      </h2>

                      {selectedProduct.description && (
                        <div className="mt-1 max-h-16 overflow-y-auto overscroll-contain pr-1 lg:max-h-20">
                          <p className="text-xs leading-5 text-white/35">
                            {selectedProduct.description}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Duration */}
                <div className="flex flex-col border-t border-white/8 px-5 py-5 sm:px-4 sm:px-6 lg:px-6 lg:py-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold">Pilih Durasi</p>
                      <p className="mt-1 text-[11px] text-white/30">
                        Pilih paket yang ingin kamu beli.
                      </p>
                    </div>
                  </div>

                  <div className="max-h-40 space-y-2 overflow-y-auto overscroll-contain pr-1 lg:grid lg:max-h-56 lg:grid-cols-2 lg:gap-3 lg:space-y-0">
                    {selectedProduct.options.map((option) => {
                      const stock = getAvailableStock(option);
                      const active = selectedOption?.id === option.id;

                      return (
                        <button
                          key={option.id}
                          type="button"
                          disabled={stock <= 0}
                          onClick={() => selectOption(option)}
                          className={`w-full rounded-2xl border p-3.5 text-left transition lg:p-4 ${
                            active
                              ? "border-purple-400/40 bg-purple-500/10 shadow-lg shadow-purple-950/20"
                              : "border-white/8 bg-white/[0.025] hover:border-white/15 hover:bg-white/[0.05]"
                          } ${
                            stock <= 0
                              ? "cursor-not-allowed opacity-35"
                              : ""
                          }`}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-sm font-bold">
                                {option.duration}
                              </p>
                              <p className="mt-1 text-[10px] text-white/30">
                                {stock > 0
                                  ? `${stock} stok tersedia`
                                  : "Stok habis"}
                              </p>
                            </div>

                            <div className="text-right">
                              <p className="text-sm font-bold">
                                {formatRupiah(option.price)}
                              </p>

                              {active && (
                                <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-purple-300">
                                  Dipilih ✓
                                </p>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Wallet + Checkout */}
                {selectedOption && (
                  <div className="border-t border-white/8 bg-white/[0.018] p-3.5 sm:p-4 lg:p-5">
                    <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 p-3.5 lg:p-4 lg:p-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.12em] text-white/30">
                          Saldo Reseller
                        </p>
                        <p className="mt-1 text-sm font-bold">
                          {walletLoading
                            ? "Memuat..."
                            : formatRupiah(balance)}
                        </p>
                      </div>

                      <a
                        href="/member"
                        className="rounded-xl border border-white/[0.07] px-3 py-2 text-xs font-bold text-white/60 transition hover:bg-white/[0.035] hover:text-white"
                      >
                        + Deposit
                      </a>
                    </div>

                                          <div className="mb-3 rounded-2xl border border-white/8 bg-black/20 p-4 lg:p-5">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white/35">
                          Kode Promo
                        </p>

                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={promoCode}
                            onChange={(e) => {
                              setPromoCode(e.target.value.toUpperCase());
                              setPromoApplied(null);
                              setPromoError("");
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                applyPromoCode();
                              }
                            }}
                            placeholder="Masukkan kode promo"
                            className="min-w-0 flex-1 rounded-xl border border-white/[0.07] bg-white/[0.04] px-3 py-2.5 text-xs font-bold uppercase outline-none transition placeholder:text-white/20 focus:border-purple-400/50"
                          />

                          <button
                            type="button"
                            onClick={applyPromoCode}
                            disabled={!promoCode.trim() || promoLoading}
                            className="rounded-xl bg-white/[0.035] px-4 py-2.5 text-xs font-bold transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            {promoLoading ? "..." : "Gunakan"}
                          </button>
                        </div>

                        {promoError && (
                          <p className="mt-2 text-[10px] font-bold text-red-300">
                            {promoError}
                          </p>
                        )}

                        {promoApplied && (
                          <div className="mt-3 space-y-1.5 text-xs">
                            <div className="flex justify-between text-white/40">
                              <span>Harga normal</span>
                              <span className="line-through">
                                {formatRupiah(promoApplied.originalPrice)}
                              </span>
                            </div>

                            <div className="flex justify-between text-emerald-300">
                              <span>Diskon ({promoApplied.code})</span>
                              <span>-{formatRupiah(promoApplied.discount)}</span>
                            </div>

                            <div className="flex justify-between border-t border-white/8 pt-2 text-sm font-bold text-white">
                              <span>Total bayar</span>
                              <span>{formatRupiah(promoApplied.finalPrice)}</span>
                            </div>
                          </div>
                        )}
                      </div>

{balance < finalPrice &&
                      getAvailableStock(selectedOption) > 0 &&
                      !walletLoading && (
                        <div className="mb-3 rounded-xl bg-amber-400/[0.06] px-3 py-2.5 text-[11px] text-amber-200/70">
                          Saldo kurang{" "}
                          {formatRupiah(
                            finalPrice - balance
                          )}
                        </div>
                      )}

                    <button
                      type="button"
                      onClick={buyProduct}
                      disabled={!canBuy}
                      className="w-full rounded-2xl bg-gradient-to-r from-purple-500 to-blue-500 px-4 py-3 text-sm font-bold shadow-lg shadow-purple-950/30 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/[0.035] disabled:bg-none disabled:text-white/30 disabled:shadow-none"
                    >
                      {buying
                        ? "Memproses..."
                        : getAvailableStock(selectedOption) <= 0
                          ? "Stok Habis"
                          : balance < finalPrice
                            ? "Saldo Tidak Cukup"
                            : "Beli Sekarang →"}
                    </button>

                    <button
                      type="button"
                      onClick={contactAdmin}
                      className="mt-2 w-full rounded-xl border border-white/[0.07] px-4 py-3 text-xs font-bold text-white/50 transition hover:bg-white/[0.06] hover:text-white"
                    >
                      Tanya Admin via WhatsApp
                    </button>
                  </div>
                )}
              </div>
            </div>
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
            className="rounded-xl border border-white/[0.07] px-4 py-2.5 text-xs font-bold transition hover:bg-white/[0.06]"
          >
            WhatsApp Admin
          </button>
        </div>
      </div>

      {/* Purchase success modal */}
      {purchaseResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-black/75 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] backdrop-blur-md">
          <div className="my-auto w-full max-w-md overflow-hidden rounded-3xl border border-emerald-400/20 bg-[#09090b] shadow-2xl shadow-black/70">
            <div className="p-4 sm:p-6 sm:p-7">
              <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-emerald-400/10 text-3xl ring-1 ring-emerald-400/20">
                ✓
              </div>

              <div className="mt-5 text-center">
                <h2 className="text-2xl font-bold">Pembelian Berhasil</h2>
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
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-white/40">
                    Delivery Key
                  </p>

                  <div className="rounded-2xl border border-purple-400/20 bg-purple-500/[0.06] p-4">
                    <p className="break-all font-mono text-sm leading-6 text-purple-100">
                      {purchaseResult.deliveryKey}
                    </p>

                    <button
                      onClick={copyKey}
                      className="mt-4 w-full rounded-xl bg-white px-4 py-3 text-sm font-bold text-black transition hover:bg-white/90 active:scale-[0.98]"
                    >
                      {copied ? "✓ Berhasil Disalin" : "Salin Key"}
                    </button>
                  </div>
                </div>
              )}

              {purchaseResult.deliveryLink && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-white/40">
                    Delivery Link
                  </p>

                  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-4">
                    <a
                      href={purchaseResult.deliveryLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block break-all text-sm leading-6 text-zinc-200 underline"
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
                      className="mt-4 w-full rounded-xl bg-white px-4 py-3 text-sm font-bold text-black transition hover:bg-white/90 active:scale-[0.98]"
                    >
                      {copied ? "✓ Berhasil Disalin" : "Salin Link"}
                    </button>

                    <a
                      href={purchaseResult.deliveryLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 block w-full rounded-xl bg-white px-4 py-3 text-center text-sm font-bold text-black transition hover:bg-zinc-200 active:scale-[0.98]"
                    >
                      Buka Link
                    </a>
                  </div>
                </div>
              )}

              <button
                onClick={() => setPurchaseResult(null)}
                className="mt-4 w-full rounded-xl border border-white/[0.07] px-4 py-3 text-sm font-bold text-white/70 transition hover:bg-white/[0.06] hover:text-white"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-black/70 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] backdrop-blur-sm">
          <div className="my-auto w-full max-w-md rounded-2xl border border-white/10 bg-[#0b0b0f] p-4 shadow-2xl sm:p-6">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">Pengaturan Akun</h2>
                <p className="mt-1 text-sm text-white/40">
                  Kelola username, password, dan wallet Member reseller.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="rounded-lg px-2 py-1 text-white/40 transition hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold text-white/50">
                  Username
                </label>
                <input
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  maxLength={24}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none transition focus:border-purple-400/50"
                  placeholder="username"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-white/50">
                  Email Wallet Member
                </label>
                <input
                  type="email"
                  value={walletEmail}
                  onChange={(e) => setWalletEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none transition focus:border-purple-400/50"
                  placeholder="email Member kamu"
                />
                <p className="mt-2 text-xs leading-relaxed text-white/35">
                  Saldo reseller akan mengikuti wallet dari akun Member dengan email ini.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-white/50">
                  Password Baru
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  maxLength={72}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none transition focus:border-purple-400/50"
                  placeholder="Kosongkan jika tidak ingin mengubah"
                />
              </div>

              {settingsMsg && (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/60">
                  {settingsMsg}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(false);
                  window.setTimeout(() => {
                    document
                      .getElementById("riwayat-pembelian")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }, 100);
                }}
                className="w-full rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-white/70 transition hover:bg-white/[0.06] hover:text-white"
              >
                Riwayat Pembelian
              </button>

              <button
                type="button"
                onClick={saveSettings}
                disabled={settingsLoading}
                className="w-full rounded-xl bg-white px-4 py-3 text-sm font-bold text-black transition hover:bg-white/90 disabled:opacity-50"
              >
                {settingsLoading ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
