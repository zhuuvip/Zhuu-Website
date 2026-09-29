import React, { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";

const API = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

type Package = {
  durationDays: number;
  price: number;
};

type Promotion = {
  id: number;
  title: string;
  description?: string | null;
  category: string;
  link?: string | null;
  imageUrl?: string | null;
  durationDays: number;
  price: number;
  status: string;
  startsAt?: string | null;
  expiresAt?: string | null;
};

const categories = [
  ["PRODUCT", "Product"],
  ["SERVICE", "Service"],
  ["WEBSITE", "Website"],
  ["APP", "App"],
  ["COMMUNITY", "Community"],
  ["OTHER", "Other"],
];

const formatRupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

export default function PromotionPage() {
  const { getToken, isSignedIn } = useAuth();

  const [packages, setPackages] = useState<Package[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [balance, setBalance] = useState(0);
  const [selectedDays, setSelectedDays] = useState(1);
  const [category, setCategory] = useState("PRODUCT");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      const token = await getToken();
      const headers = token
        ? { Authorization: `Bearer ${token}` }
        : undefined;

      const [pkgRes, walletRes, promoRes] = await Promise.all([
        fetch(`${API}/api/promotions/packages`, { headers }),
        fetch(`${API}/api/wallet`, { headers }),
        fetch(`${API}/api/promotions/mine`, { headers }),
      ]);

      if (pkgRes.ok) {
        const data = await pkgRes.json();
        setPackages(data.packages || []);
      }

      if (walletRes.ok) {
        const data = await walletRes.json();
        setBalance(Number(data.balance || 0));
      }

      if (promoRes.ok) {
        const data = await promoRes.json();
        setPromotions(Array.isArray(data) ? data : data.promotions || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSignedIn) loadData();
    else setLoading(false);
  }, [isSignedIn]);

  const selectedPackage = packages.find(
    (item) => item.durationDays === selectedDays,
  );

  const submitPromotion = async () => {
    if (!isSignedIn) {
      window.alert("Silakan login terlebih dahulu.");
      return;
    }

    if (!title.trim()) {
      window.alert("Judul promosi wajib diisi.");
      return;
    }

    if (!selectedPackage) {
      window.alert("Pilih durasi promosi terlebih dahulu.");
      return;
    }

    if (balance < selectedPackage.price) {
      window.alert(
        `Saldo tidak cukup. Dibutuhkan ${formatRupiah(selectedPackage.price)}.`,
      );
      return;
    }

    setSubmitting(true);

    try {
      const token = await getToken();

      const res = await fetch(`${API}/api/promotions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          link: link.trim(),
          imageUrl: imageUrl.trim(),
          durationDays: selectedDays,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal membuat promosi.");
      }

      setBalance(Number(data.balance || 0));
      setPromotions((current) => [data.promotion, ...current]);
      setTitle("");
      setDescription("");
      setLink("");
      setImageUrl("");

      window.alert(
        "Promosi berhasil dibuat dan langsung aktif.",
      );
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Gagal membuat promosi.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!isSignedIn) {
    return (
      <div className="min-h-screen px-4 py-10">
        <div className="max-w-3xl mx-auto glass-card rounded-3xl p-8 text-center">
          <h1 className="text-3xl font-black text-zinc-200">
            Paid Promotion
          </h1>
          <p className="mt-3 text-zinc-400/50">
            Silakan login untuk membeli slot promosi.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-3 sm:px-4 py-5 pb-28">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <span className="text-xs font-black uppercase tracking-[0.25em] text-zinc-200">
            ZhuuSite Promotion
          </span>
          <h1 className="mt-2 text-3xl sm:text-4xl font-black text-zinc-100">
            Paid Promotion
          </h1>
          <p className="mt-2 text-sm text-zinc-400/50">
            Promosikan produk, website, aplikasi, layanan, atau komunitas kamu
            di platform ZhuuSite.
          </p>
        </div>

        <div className="glass-card rounded-3xl p-5 mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-zinc-400/40">
              Saldo Wallet
            </p>
            <p className="text-2xl font-black text-zinc-200">
              {formatRupiah(balance)}
            </p>
          </div>
          <a
            href="/member"
            className="rounded-xl px-4 py-2 bg-white/5 border border-white/10 text-zinc-200 text-sm font-bold"
          >
            Isi Saldo
          </a>
        </div>

        {promotions.length > 0 && (
          <div className="glass-card rounded-3xl p-5 sm:p-6 mb-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-black text-zinc-100">
                Promosi Saya
              </h2>
              <span className="text-xs text-zinc-400/30">
                {promotions.length} promosi
              </span>
            </div>

            <div className="space-y-3">
              {promotions.map((promo) => (
                <div
                  key={promo.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black text-zinc-200">
                        {promo.title}
                      </h3>
                      <p className="mt-1 text-xs text-zinc-400/40">
                        {promo.category} · {promo.durationDays} hari
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-black ${
                        promo.status === "ACTIVE"
                          ? "bg-emerald-400/10 text-emerald-300"
                          : "bg-white/10 text-zinc-400/50"
                      }`}
                    >
                      {promo.status}
                    </span>
                  </div>

                  {promo.expiresAt && (
                    <p className="mt-3 text-xs text-zinc-400/40">
                      Berakhir:{" "}
                      {new Date(promo.expiresAt).toLocaleString("id-ID")}
                    </p>
                  )}

                  {promo.link && (
                    <a
                      href={promo.link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block mt-3 text-sm font-bold text-zinc-200 hover:text-zinc-200"
                    >
                      Buka Link →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="glass-card rounded-3xl p-5 sm:p-6">
          <h2 className="text-lg font-black text-zinc-100 mb-4">
            Pilih Durasi
          </h2>

          {loading ? (
            <div className="text-sm text-zinc-400/40">Memuat paket...</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {packages.map((item) => (
                <button
                  key={item.durationDays}
                  type="button"
                  onClick={() => setSelectedDays(item.durationDays)}
                  className={`rounded-2xl p-4 text-left border transition ${
                    selectedDays === item.durationDays
                      ? "bg-white/[0.08] border-white/20 shadow-lg shadow-black/20"
                      : "bg-white/5 border-white/10 hover:border-white/15"
                  }`}
                >
                  <div className="text-sm font-black text-zinc-200">
                    {item.durationDays} Hari
                  </div>
                  <div className="mt-1 text-sm font-bold text-zinc-200">
                    {formatRupiah(item.price)}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="mt-6">
            <label className="block text-sm font-bold text-zinc-200 mb-2">
              Kategori
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-zinc-200"
            >
              {categories.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-bold text-zinc-200 mb-2">
              Judul Promosi
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={150}
              placeholder="Contoh: Zhuu Hosting - VPS Murah"
              className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-zinc-200 outline-none focus:border-white/20"
            />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-bold text-zinc-200 mb-2">
              Deskripsi
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="Jelaskan produk atau layanan kamu..."
              className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-zinc-200 outline-none resize-none focus:border-white/20"
            />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-bold text-zinc-200 mb-2">
              Link
            </label>
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-zinc-200 outline-none focus:border-white/20"
            />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-bold text-zinc-200 mb-2">
              URL Gambar
            </label>
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-zinc-200 outline-none focus:border-white/20"
            />
          </div>

          <div className="mt-6 rounded-2xl bg-white/5 border border-white/10 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-400/50">
                Total pembayaran
              </span>
              <span className="text-xl font-black text-zinc-200">
                {formatRupiah(selectedPackage?.price || 0)}
              </span>
            </div>
            <p className="mt-2 text-xs text-zinc-400/30">
              Pembayaran dipotong otomatis dari saldo wallet.
            </p>
          </div>

          <button
            type="button"
            onClick={submitPromotion}
            disabled={submitting || !selectedPackage}
            className="w-full mt-5 rounded-2xl bg-white text-black font-black py-4 disabled:opacity-40"
          >
            {submitting ? "Memproses..." : "Bayar & Aktifkan Promosi"}
          </button>
        </div>
      </div>
    </div>
  );
}
