import { useState } from "react";

const API_BASE = "https://zhuuapi.vercel.app";

export default function ResellerLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/reseller/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Login gagal");
      localStorage.setItem("reseller_token", data.token);
      window.location.href = "/reseller";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal terhubung ke server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 text-2xl ring-1 ring-white/10">
            ◈
          </div>
          <h1 className="text-2xl font-black">Reseller Login</h1>
          <p className="mt-1 text-xs text-white/40">Masuk untuk melihat harga reseller</p>
        </div>

        <div className="space-y-3">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            autoCapitalize="none"
            autoComplete="username"
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-purple-400/50"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-purple-400/50"
          />
        </div>

        {error && (
          <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>
        )}

        <button
          onClick={submit}
          disabled={loading || !username || !password}
          className="mt-5 w-full rounded-2xl bg-gradient-to-r from-purple-500 to-blue-500 px-6 py-3.5 text-sm font-black transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Memproses..." : "Masuk"}
        </button>

        <p className="mt-4 text-center text-[11px] text-white/40">
          Belum punya akun? Beli rank Reseller di halaman{" "}
          <a href="/member" className="text-cyan-300 underline">Member</a>.
        </p>
      </div>
    </main>
  );
}
