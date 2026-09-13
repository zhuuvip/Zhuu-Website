import { useEffect, useState } from "react";

const WA = "62882005730502";

const API_BASE = "https://zhuuapi.vercel.app";

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedOption, setSelectedOption] = useState<any>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/products`)
      .then(res => res.json())
      .then(data => {
        setProducts(data);
        if (data.length) {
          setSelectedProduct(data[0]);
          setSelectedOption(data[0].options?.[0] ?? null);
        }
      });
  }, []);

  const selectProduct = (product: any) => {
    setSelectedProduct(product);
    setSelectedOption(product.options[0]);
  };

  if (!selectedProduct || !selectedOption) return <main className="min-h-screen px-4 py-10 text-center">Memuat produk...</main>;

  const confirmPayment = () => {
    const orderId = `ZHUU-${Date.now().toString().slice(-6)}`;
    const text = [
      "🔔 KONFIRMASI PEMBAYARAN",
      "",
      "Halo Admin, saya sudah melakukan pembayaran melalui QRIS DANA.",
      "",
      `📦 Produk: ${selectedProduct.name}`,
      `⏱️ Durasi: ${selectedOption.duration}`,
      `💰 Total: Rp${selectedOption.price.toLocaleString("id-ID")}`,
      `📦 Stok: ${selectedOption.stock}`,
      `🧾 Order ID: ${orderId}`,
      "",
      "Mohon dicek pembayaran saya.",
      "Terima kasih 🙏",
    ].join("\n");

    window.open(
      `https://wa.me/${WA}?text=${encodeURIComponent(text)}`,
      "_blank"
    );
  };

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold">🛒 ZHUU STORE</h1>
          <p className="mt-2 opacity-70">Pilih produk yang kamu inginkan</p>
        </div>

        <div className="mb-8 rounded-2xl border p-6 text-center">
          <h2 className="mb-4 text-xl font-bold">💳 Pembayaran QRIS DANA</h2>
          <img
            src="/attached_assets/qr_ID1026531275638_12.09.26_1789202677_1789202677296.jpeg"
            alt="QRIS DANA"
            className="mx-auto h-64 w-64 rounded-xl object-contain"
          />
          <p className="mt-3 text-sm opacity-70">
            Scan QRIS di atas, lalu klik tombol konfirmasi melalui WhatsApp.
          </p>
          <a href="/attached_assets/qr_ID1026531275638_12.09.26_1789202677_1789202677296.jpeg" download="QRIS-DANA-ZhuuVIP.jpeg" className="mx-auto mt-4 inline-flex items-center justify-center rounded-xl border px-5 py-3 font-semibold transition hover:scale-105">
            ⬇️ Download QRIS
          </a>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <div
              key={product.id}
              className={`rounded-2xl border p-5 transition ${
                selectedProduct.id === product.id ? "ring-2" : ""
              }`}
            >
              <div className="mb-4 flex h-16 items-center justify-center rounded-xl border overflow-hidden">
  {product.imageUrl ? (
    <img
      src={product.imageUrl}
      alt={product.name}
      className="h-full w-full object-cover"
    />
  ) : (
    <span className="text-3xl">🛍️</span>
  )}
</div>

              <h3 className="text-xl font-bold">{product.name}</h3>

              <div className="mt-4 space-y-2">
                {product.options.map((option) => (
                  <button
                    key={option.duration}
                    disabled={option.stock <= 0}
                    onClick={() => {
                      selectProduct(product);
                      setSelectedOption(option);
                    }}
                    className={`w-full rounded-xl border p-3 text-left ${
                      selectedProduct.id === product.id &&
                      selectedOption.duration === option.duration
                        ? "ring-2"
                        : ""
                    } ${option.stock <= 0 ? "cursor-not-allowed opacity-40" : ""}`}
                  >
                    <div className="flex justify-between">
                      <span>{option.duration}</span>
                      <span className="font-bold">
                        Rp{option.price.toLocaleString("id-ID")}
                      </span>
                    </div>
                    <div className="mt-1 text-sm opacity-60">
                      Stock: {option.stock}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-8 max-w-xl rounded-2xl border p-6 text-center">
          <p className="text-sm opacity-60">Produk dipilih</p>
          <h2 className="text-2xl font-bold">{selectedProduct.name}</h2>
          <p className="my-2">
            {selectedOption.duration} • Rp
            {selectedOption.price.toLocaleString("id-ID")}
          </p>

          <button
            onClick={confirmPayment}
            disabled={selectedOption.stock <= 0}
            className="mt-4 w-full rounded-xl px-5 py-3 font-bold disabled:opacity-40"
          >
            ✅ Sudah Bayar — Konfirmasi via WhatsApp
          </button>
        </div>
      </div>
    </main>
  );
}
