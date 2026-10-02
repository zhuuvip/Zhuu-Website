import { useEffect, useState } from "react";

const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

const getTestimonialImageUrl = (imageUrl?: string | null) => {
  if (!imageUrl) return "";

  if (imageUrl.startsWith("testimonials/")) {
    return `${API_BASE}/api/testimonial-image?pathname=${encodeURIComponent(imageUrl)}`;
  }

  return imageUrl;
};

type Testimonial = {
  id: number;
  customerName: string;
  productName: string;
  duration: string;
  rating: number;
  message: string;
  imageUrl?: string | null;
  createdAt: string;
};

export default function TestimonialsPage() {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/testimonials`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setItems(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="zhuu-page-bg min-h-screen px-4 pb-28 pt-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 text-center">
          <div className="mb-3 text-4xl">⭐</div>
          <h1 className="text-4xl font-black tracking-tight">
            Testimoni Pembelian
          </h1>
          <p className="mt-2 text-sm text-white/40">
            Pengalaman customer setelah menggunakan produk Zhuu.
          </p>
        </div>

        {loading ? (
          <div className="py-20 text-center text-sm text-white/30">
            Memuat testimoni...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-10 text-center">
            <p className="text-sm text-white/40">
              Belum ada testimoni yang dipublikasikan.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 backdrop-blur-xl transition duration-200 hover:border-white/[0.12] hover:bg-white/[0.04]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-white">
                      {item.customerName}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-white/35">
                      {item.productName} · {item.duration}
                    </p>
                  </div>

                  <div className="shrink-0 text-sm text-amber-400">
                    {"★".repeat(Math.max(0, Math.min(5, item.rating)))}
                  </div>
                </div>

                {item.imageUrl && (
                  <img
                    src={getTestimonialImageUrl(item.imageUrl)}
                    alt="Foto testimoni"
                    className="mt-4 max-h-64 w-full rounded-xl object-cover"
                    loading="lazy"
                  />
                )}

                <p className="mt-4 text-sm leading-6 text-white/65">
                  “{item.message}”
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
