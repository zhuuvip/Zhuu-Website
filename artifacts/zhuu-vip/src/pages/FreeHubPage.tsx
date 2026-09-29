import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";

type Promotion = {
  id: number;
  userId: string;
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

type FreePost = {
  id: number;
  userId: string;
  title: string;
  description?: string | null;
  category: string;
  link?: string | null;
  imageUrl?: string | null;
  pinned: boolean;
  createdAt: string;
  username?: string;
  imageUrlProfile?: string;
};

const API = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

const categories = [
  "FREE_PRODUCT",
  "FREE_SOURCE",
  "FREE_KEY",
  "FREE_PROMO_CODE",
  "GIVEAWAY",
];

export default function FreeHubPage() {
  const { getToken, isSignedIn } = useAuth();
  const [posts, setPosts] = useState<FreePost[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState("ALL");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [postCategory, setPostCategory] = useState("FREE_PRODUCT");
  const [link, setLink] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [posting, setPosting] = useState(false);

  async function loadPosts() {
    try {
      setLoading(true);

      const [postsRes, promotionsRes] = await Promise.all([
        fetch(`${API}/api/free/posts`),
        fetch(`${API}/api/promotions`),
      ]);

      const postsData = await postsRes.json();
      const promotionsData = await promotionsRes.json();

      setPosts(Array.isArray(postsData) ? postsData : []);
      setPromotions(Array.isArray(promotionsData) ? promotionsData : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPosts();
  }, []);

  async function createPost() {
    if (!title.trim()) {
      alert("Judul wajib diisi.");
      return;
    }

    try {
      setPosting(true);
      const token = await getToken();

      const res = await fetch(`${API}/api/free/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          category: postCategory,
          link: link.trim() || null,
          imageUrl: imageUrl.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data?.error || "Gagal membuat postingan.");
        return;
      }

      setTitle("");
      setDescription("");
      setPostCategory("FREE_PRODUCT");
      setLink("");
      setImageUrl("");
      setShowForm(false);
      await loadPosts();
    } catch {
      alert("Gagal terhubung ke server.");
    } finally {
      setPosting(false);
    }
  }

  const filtered =
    category === "ALL"
      ? posts
      : posts.filter((post) => post.category === category);

  return (
    <div className="min-h-screen px-3 sm:px-4 pt-4 pb-28">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl sm:text-4xl font-black gradient-text">
                Free Hub
              </h1>
              <p className="text-sm text-cyan-100/45 mt-1">
                Tempat berbagi produk, source, key, giveaway, tools, dan hal gratis.
              </p>
            </div>

            {isSignedIn && (
              <button
                onClick={() => setShowForm((v) => !v)}
                className="shrink-0 rounded-2xl px-4 py-2.5 bg-cyan-400 text-black font-bold hover:bg-cyan-300 transition"
              >
                + Bagikan
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-amber-300/15 bg-amber-300/[0.04] p-4">
          <div className="flex items-start gap-3">
            <div className="text-lg">📜</div>

            <div className="min-w-0">
              <p className="text-sm font-bold text-amber-200">
                Syarat & Ketentuan Free Hub
              </p>

              <ul className="mt-2 space-y-1 text-xs leading-relaxed text-cyan-100/55">
                <li>• Hanya bagikan sesuatu yang benar-benar gratis.</li>
                <li>• Dilarang promosi atau iklan produk/jasa berbayar.</li>
                <li>• Dilarang konten pornografi, seksual, atau 18+.</li>
                <li>• Dilarang konten kekerasan, ancaman, atau eksploitasi.</li>
                <li>• Dilarang penipuan, phishing, malware, scam, dan link berbahaya.</li>
                <li>• Dilarang spam, flood, atau posting berulang yang mengganggu.</li>
                <li>• Jangan membagikan data pribadi atau informasi sensitif orang lain.</li>
                <li>• Postingan yang melanggar aturan dapat dihapus.</li>
              </ul>

              <a
                href="/promote"
                className="inline-flex mt-3 rounded-xl px-3 py-2 bg-purple-400/10 border border-purple-300/20 text-purple-200 text-xs font-bold hover:bg-purple-400/20 transition"
              >
                📢 Mau promosi? Buka Promotion →
              </a>
            </div>
          </div>
        </div>

        {promotions.length > 0 && (
          <section className="mb-7">
            <div className="flex items-end justify-between gap-3 mb-3">
              <div>
                <div className="text-[11px] font-black tracking-[0.18em] text-cyan-300 uppercase">
                  Paid Promotion
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  Promosi Berbayar
                </h2>
                <p className="text-xs text-cyan-100/40 mt-1">
                  Konten dari member yang membeli slot promosi.
                </p>
              </div>

              <a
                href="/promote"
                className="shrink-0 rounded-xl px-3 py-2 bg-cyan-400/10 border border-cyan-300/20 text-cyan-300 text-xs font-bold"
              >
                Promosikan →
              </a>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {promotions.map((promotion) => (
                <article
                  key={promotion.id}
                  className="glass-card rounded-3xl overflow-hidden border border-cyan-300/15"
                >
                  {promotion.imageUrl && (
                    <img
                      src={promotion.imageUrl}
                      alt=""
                      className="w-full aspect-video object-cover"
                    />
                  )}

                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-cyan-400/10 text-cyan-300">
                        PROMOTED
                      </span>
                      <span className="text-[10px] font-bold text-cyan-100/40">
                        {promotion.category}
                      </span>
                    </div>

                    <h2 className="font-bold text-lg">
                      {promotion.title}
                    </h2>

                    {promotion.description && (
                      <p className="text-sm text-cyan-100/50 mt-2 whitespace-pre-wrap line-clamp-4">
                        {promotion.description}
                      </p>
                    )}

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="text-xs text-cyan-100/30">
                        {promotion.durationDays} hari
                      </span>

                      {promotion.link && (
                        <a
                          href={promotion.link}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl px-3 py-2 bg-cyan-400 text-black text-sm font-bold"
                        >
                          Buka →
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {showForm && (
          <div className="glass-card rounded-3xl p-4 sm:p-5 mb-6">
            <h2 className="font-bold text-lg mb-4">Bagikan sesuatu</h2>

            <div className="space-y-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={150}
                placeholder="Judul"
                className="w-full rounded-2xl bg-black/20 border border-cyan-200/10 px-4 py-3 outline-none focus:border-cyan-300/40"
              />

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                placeholder="Deskripsi"
                rows={4}
                className="w-full rounded-2xl bg-black/20 border border-cyan-200/10 px-4 py-3 outline-none focus:border-cyan-300/40 resize-none"
              />

              <div className="grid sm:grid-cols-2 gap-3">
                <select
                  value={postCategory}
                  onChange={(e) => setPostCategory(e.target.value)}
                  className="rounded-2xl bg-black/30 border border-cyan-200/10 px-4 py-3"
                >
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {item
                        .replace("FREE_PRODUCT", "Free Product")
                        .replace("FREE_SOURCE", "Free Source")
                        .replace("FREE_KEY", "Free Key")
                        .replace("FREE_PROMO_CODE", "Free Promo Code")
                        .replace("GIVEAWAY", "Giveaway")}
                    </option>
                  ))}
                </select>

                <input
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="Link (opsional)"
                  className="rounded-2xl bg-black/20 border border-cyan-200/10 px-4 py-3 outline-none"
                />
              </div>

              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="URL gambar (opsional)"
                className="w-full rounded-2xl bg-black/20 border border-cyan-200/10 px-4 py-3 outline-none"
              />

              <div className="flex justify-end">
                <button
                  onClick={createPost}
                  disabled={posting}
                  className="rounded-2xl px-5 py-3 bg-cyan-400 text-black font-bold disabled:opacity-50"
                >
                  {posting ? "Mengirim..." : "Publish"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-2 mb-5">
          <button
            onClick={() => setCategory("ALL")}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${
              category === "ALL"
                ? "bg-cyan-400 text-black"
                : "bg-white/5 text-cyan-100/60"
            }`}
          >
            Semua
          </button>

          {categories.map((item) => (
            <button
              key={item
                      .replace("FREE_PRODUCT", "Free Product")
                      .replace("FREE_SOURCE", "Free Source")
                      .replace("FREE_KEY", "Free Key")
                      .replace("FREE_PROMO_CODE", "Free Promo Code")
                      .replace("GIVEAWAY", "Giveaway")}
              onClick={() => setCategory(item)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${
                category === item
                  ? "bg-cyan-400 text-black"
                  : "bg-white/5 text-cyan-100/60"
              }`}
            >
              {item
                      .replace("FREE_PRODUCT", "Free Product")
                      .replace("FREE_SOURCE", "Free Source")
                      .replace("FREE_KEY", "Free Key")
                      .replace("FREE_PROMO_CODE", "Free Promo Code")
                      .replace("GIVEAWAY", "Giveaway")}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-cyan-100/40">
            Memuat Free Hub...
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card rounded-3xl p-10 text-center text-cyan-100/40">
            Belum ada postingan.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((post) => (
              <article
                key={post.id}
                className="glass-card rounded-3xl overflow-hidden border border-white/5"
              >
                {post.imageUrl && (
                  <img
                    src={post.imageUrl}
                    alt=""
                    className="w-full aspect-video object-cover"
                  />
                )}

                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-cyan-400/10 text-cyan-300">
                      {post.category
      .replace("FREE_PRODUCT", "Free Product")
      .replace("FREE_SOURCE", "Free Source")
      .replace("FREE_KEY", "Free Key")
      .replace("FREE_PROMO_CODE", "Free Promo Code")
      .replace("GIVEAWAY", "Giveaway")}
                    </span>

                    {post.pinned && (
                      <span className="text-[11px] font-bold text-yellow-300">
                        📌 Pinned
                      </span>
                    )}
                  </div>

                  <h2 className="font-bold text-lg">{post.title}</h2>

                  {post.description && (
                    <p className="text-sm text-cyan-100/50 mt-2 whitespace-pre-wrap line-clamp-4">
                      {post.description}
                    </p>
                  )}

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-xs text-cyan-100/30">
                      {post.username || "Member"}
                    </span>

                    {post.link && (
                      <a
                        href={post.link}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl px-3 py-2 bg-white/5 text-cyan-300 text-sm font-bold"
                      >
                        Buka →
                      </a>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
