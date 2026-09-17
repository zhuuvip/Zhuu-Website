import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";

const WA = "62882005730502";

const API_BASE = "https://zhuuapi-oohb6q2xd-hgeming2009-1446s-projects.vercel.app";

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedOption, setSelectedOption] = useState<any>(null);
  const [balance, setBalance] = useState(0);
  const [buying, setBuying] = useState(false);
  const { getToken } = useAuth();

  useEffect(() => {
    getToken().then(token => {
      if (!token) return;
      fetch(`${API_BASE}/api/wallet`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(res => res.json())
        .then(data => setBalance(Number(data.balance || 0)))
        .catch(() => {});
    });
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

  const buyProduct = async () => {
    if (!selectedProduct || !selectedOption || buying) return;

    if (balance < selectedOption.price) {
      alert(
        `Saldo tidak cukup.\\n\\nSaldo: Rp${balance.toLocaleString("id-ID")}\\nHarga: Rp${selectedOption.price.toLocaleString("id-ID")}\\n\\nSilakan deposit terlebih dahulu di halaman Member.`
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

      const r = await fetch(`${API_BASE}/api/orders`, {
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

      const data = await r.json();

      if (!r.ok) {
        alert(data.error || "Gagal membeli produk");
        return;
      }

      setBalance(Number(data.balance || 0));

      alert(
        data.deliveryKey
          ? `Pembelian berhasil!\\n\\nProduk: ${selectedProduct.name}\\nDurasi: ${selectedOption.duration}\\nKey: ${data.deliveryKey}`
          : `Pembelian berhasil!\\n\\nProduk: ${selectedProduct.name}\\nDurasi: ${selectedOption.duration}`
      );

      fetch(`${API_BASE}/api/products`)
        .then(res => res.json())
        .then(data => setProducts(data))
        .catch(() => {});
    } catch {
      alert("Gagal terhubung ke server");
    } finally {
      setBuying(false);
    }
  };

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold">🛒 ZHUU STORE</h1>
          <p className="mt-2 opacity-70">Pilih produk yang kamu inginkan</p>
        </div>

        <div className="mb-8 rounded-2xl border p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm opacity-60">Saldo Wallet</p>
              <h2 className="text-2xl font-bold">
                Rp{balance.toLocaleString("id-ID")}
              </h2>
            </div>
            <a
              href="/member"
              className="rounded-xl border px-5 py-3 text-center font-semibold transition hover:scale-105"
            >
              💳 Deposit Saldo
            </a>
          </div>
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
            onClick={buyProduct}
            disabled={selectedOption.stock <= 0 || buying}
            className="mt-4 w-full rounded-xl px-5 py-3 font-bold disabled:opacity-40"
          >
            {buying
              ? "⏳ Memproses..."
              : `🛒 Beli dengan Saldo — Rp${selectedOption.price.toLocaleString("id-ID")}`}
          </button>
        </div>
      </div>
    </main>
  );
}
