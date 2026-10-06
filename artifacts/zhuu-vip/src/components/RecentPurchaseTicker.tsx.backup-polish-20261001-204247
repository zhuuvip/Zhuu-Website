import { useEffect, useMemo, useState } from "react";
import { ShoppingBag } from "lucide-react";

const API_BASE = (
  import.meta.env.VITE_API_URL || "https://zhuuapi.vercel.app"
).replace(/\/$/, "");

type Purchase = {
  productId: number;
  productName: string;
  amount: number;
  createdAt: string;
  imageUrl?: string;
  username: string;
};

type Product = {
  id: number;
  imageUrl?: string;
};

function formatPrice(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function timeAgo(value: string) {
  const diff = Math.max(
    0,
    Date.now() - new Date(value).getTime(),
  );

  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${hours} jam lalu`;

  return `${Math.floor(hours / 24)} hari lalu`;
}

export default function RecentPurchaseTicker() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [purchaseRes, productRes] = await Promise.all([
          fetch(`${API_BASE}/api/orders/recent`, {
            cache: "no-store",
          }),
          fetch(`${API_BASE}/api/products`, {
            cache: "no-store",
          }),
        ]);

        if (!purchaseRes.ok) return;

        const purchaseData = await purchaseRes.json();
        const productData = productRes.ok
          ? await productRes.json()
          : [];

        if (cancelled) return;

        setPurchases(
          Array.isArray(purchaseData) ? purchaseData : [],
        );

        setProducts(
          Array.isArray(productData)
            ? productData
            : Array.isArray(productData?.products)
              ? productData.products
              : [],
        );

        setActiveIndex(0);
      } catch {
        if (!cancelled) {
          setPurchases([]);
        }
      }
    };

    load();

    const refreshTimer = window.setInterval(load, 45000);

    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
    };
  }, []);

  useEffect(() => {
    if (purchases.length <= 1) return;

    const timer = window.setInterval(() => {
      setVisible(false);

      window.setTimeout(() => {
        setActiveIndex((index) => (index + 1) % purchases.length);
        setVisible(true);
      }, 250);
    }, 4500);

    return () => window.clearInterval(timer);
  }, [purchases.length]);

  const purchase = purchases[activeIndex];

  const productImage = useMemo(() => {
    if (!purchase) return "";

    if (purchase.imageUrl) {
      return purchase.imageUrl;
    }

    const product = products.find(
      (item) => Number(item.id) === Number(purchase.productId),
    );

    return product?.imageUrl || "";
  }, [purchase, products]);

  if (!purchase) {
    return null;
  }

  return (
    <div
      data-testid="recent-purchase-ticker"
      aria-hidden="true"
      className={[
        "pointer-events-none fixed right-4 z-30",
        "bottom-24 sm:bottom-6",
        "w-[min(300px,calc(100vw-32px))]",
        "transition-all duration-300",
        visible
          ? "translate-y-0 opacity-100"
          : "translate-y-1 opacity-0",
        "hidden sm:block",
        "lg:w-[310px]",
      ].join(" ")}
    >
      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-black/65 px-3 py-2.5 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.05]">
            {productImage ? (
              <img
                src={productImage}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ) : (
              <ShoppingBag className="h-4 w-4 text-white/55" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[11px] font-medium text-white/90">
                {purchase.productName}
              </span>

              <span className="shrink-0 rounded-full bg-emerald-400/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-emerald-300">
                Paid
              </span>
            </div>

            <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[10px] text-white/45">
              <span className="truncate">
                {purchase.username}
              </span>

              <span className="text-white/20">•</span>

              <span className="shrink-0">
                {timeAgo(purchase.createdAt)}
              </span>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="text-[10px] font-semibold text-white/85">
              {formatPrice(purchase.amount)}
            </div>
            <div className="mt-0.5 text-[8px] text-white/30">
              pembelian
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
