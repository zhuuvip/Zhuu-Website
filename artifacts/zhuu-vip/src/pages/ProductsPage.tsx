import { useState } from "react";

const WA = "62882005730502";

const products = Array.from({ length: 13 }, (_, i) => ({
  id: `PRODUK-${String.fromCharCode(65 + i)}`,
  name: `PRODUK ${String.fromCharCode(65 + i)}`,
  duration: "1 DAY",
  price: 6000,
  stock: 10,
}));

export default function ProductsPage() {
  const [selected, setSelected] = useState(products[0]);

  const confirmPayment = () => {
    const orderId = `ZHUU-${Date.now().toString().slice(-6)}`;
    const text = [
      "🔔 KONFIRMASI PEMBAYARAN",
      "",
      "Halo Admin, saya sudah melakukan pembayaran melalui QRIS DANA.",
      "",
      `📦 Produk: ${selected.name}`,
      `⏱️ Durasi: ${selected.duration}`,
      `💰 Total: Rp${selected.price.toLocaleString("id-ID")}`,
      `📦 Stok: ${selected.stock}`,
      `🧾 Order ID: ${orderId}`,
      "",
      "Mohon dicek pembayaran saya.",
      "Terima kasih 🙏",
    ].join("\n");

    window.open(`https://wa.me/${WA}?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold">🛒 ZHUU STORE</h1>
          <p className="mt-2 opacity-70">Pilih produk yang kamu inginkan</p>
        </div>

        <div className="mb-8 rounded-2xl border p-6 text-center">
          <h2 className="mb-4 text-xl font-bold">💳 Pembayaran <img src="https://files.catbox.moe/7sgry7.jpeg" alt="QRIS DANA" className="mx-auto h-64 w-64 rounded-xl object-contain" /></h2>
          <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-xl border border-dashed opacity-70">
            <img src="https://files.catbox.moe/7sgry7.jpeg" alt="QRIS DANA" className="mx-auto h-64 w-64 rounded-xl object-contain" />
          </div>
          <p className="mt-3 text-sm opacity-70">
            Scan QRIS di atas, lalu klik tombol konfirmasi melalui WhatsApp.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <button
              key={product.id}
              onClick={() => setSelected(product)}
              className={`rounded-2xl border p-5 text-left transition hover:scale-[1.02] ${
                selected.id === product.id ? "ring-2" : ""
              }`}
            >
              <div className="mb-4 flex h-20 items-center justify-center rounded-xl border text-3xl">
                🛍️
              </div>
              <h3 className="text-xl font-bold">{product.name}</h3>
              <p className="mt-1 opacity-70">{product.duration}</p>
              <p className="mt-3 text-2xl font-bold">
                Rp{product.price.toLocaleString("id-ID")}
              </p>
              <p className="mt-2 text-sm">Stok: {product.stock}</p>
            </button>
          ))}
        </div>

        <div className="mx-auto mt-8 max-w-xl rounded-2xl border p-6 text-center">
          <p className="mb-1 text-sm opacity-60">Produk dipilih</p>
          <h2 className="text-2xl font-bold">{selected.name}</h2>
          <p className="my-2">
            {selected.duration} • Rp{selected.price.toLocaleString("id-ID")}
          </p>

          <button
            onClick={confirmPayment}
            className="mt-4 w-full rounded-xl px-5 py-3 font-bold"
          >
            ✅ Sudah Bayar — Konfirmasi via WhatsApp
          </button>
        </div>
      </div>
    </main>
  );
}
