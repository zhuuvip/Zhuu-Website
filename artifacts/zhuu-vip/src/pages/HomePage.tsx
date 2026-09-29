import { Link } from "wouter";
import { useEffect } from "react";
import { Show } from "@clerk/react";
import {
  ArrowRight,
  Bot,
  Gift,
  Gauge,
  MessageSquare,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Users,
} from "lucide-react";
import logoPath from "@assets/file_000000003e9c72078d0f388bef03af6a_1778462394630.png";
import VerifiedBadge from "@/components/ui/VerifiedBadge";

const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

const QUICK_LINKS = [
  {
    path: "/products",
    title: "Products",
    description: "Lihat produk, paket, dan layanan yang tersedia.",
    Icon: ShoppingBag,
  },
  {
    path: "/free",
    title: "Free Hub",
    description: "Temukan resource, key, promo, dan postingan gratis.",
    Icon: Gift,
  },
  {
    path: "/member",
    title: "Member",
    description: "Kelola akun member dan akses fitur premium.",
    Icon: Sparkles,
  },
];

const FEATURES = [
  {
    path: "/speedtest",
    title: "Speed Test",
    description: "Uji download, upload, dan latency koneksi kamu.",
    Icon: Gauge,
  },
  {
    path: "/ai",
    title: "Zhuu AI",
    description: "Asisten AI untuk ngobrol, bertanya, dan membantu pekerjaan.",
    Icon: Bot,
  },
  {
    path: "/community",
    title: "Community",
    description: "Tempat berbagi, berdiskusi, dan terhubung dengan pengguna lain.",
    Icon: Users,
  },
  {
    path: "/zhuu-chat",
    title: "Public Chat",
    description: "Ngobrol bersama pengguna ZhuuSite lainnya.",
    Icon: MessageSquare,
  },
];

export default function HomePage() {
  useEffect(() => {
    fetch(`${API_BASE}/api/visitors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: "/" }),
    }).catch(() => {});
  }, []);

  return (
    <main className="min-h-screen bg-[#080b10] text-white">
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,0.10),transparent_45%)]" />

        <div className="relative mx-auto flex min-h-[650px] max-w-6xl flex-col items-center justify-center px-5 py-24 text-center sm:px-6">
          <div className="mb-7 flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3.5 py-1.5 text-xs text-white/55">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            ZhuuSite is online
          </div>

          <div className="mb-7 flex items-center gap-3">
            <div className="h-20 w-20 overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04] shadow-xl sm:h-24 sm:w-24">
              <img
                src={logoPath}
                alt="ZhuuSite"
                className="h-full w-full object-cover"
              />
            </div>

            <VerifiedBadge size={22} title="ZhuuSite Verified" />
          </div>

          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-6xl">
            Welcome to <span className="text-blue-400">ZhuuSite</span>
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-7 text-white/50 sm:text-lg">
            Satu platform untuk produk, tools, komunitas, AI, dan berbagai
            layanan Zhuu. Simple, cepat, dan terus berkembang.
          </p>

          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link href="/products">
              <button className="zs-button zs-button-primary inline-flex items-center gap-2 px-5 py-3">
                <ShoppingBag size={17} />
                Explore Products
                <ArrowRight size={16} />
              </button>
            </Link>

            <Link href="/free">
              <button className="zs-button zs-button-ghost inline-flex items-center gap-2 px-5 py-3">
                <Gift size={17} />
                Free Hub
              </button>
            </Link>

            <Show when="signed-out">
              <Link href="/sign-up">
                <button className="zs-button zs-button-ghost px-5 py-3">
                  Create account
                </button>
              </Link>
            </Show>
          </div>

          <div className="mt-10 flex items-center gap-2 text-xs text-white/35">
            <ShieldCheck size={15} />
            Secure account & verified platform
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-6">
        <div className="mb-7">
          <p className="zs-caption">Quick access</p>
          <h2 className="zs-title mt-1">Mulai dari sini</h2>
          <p className="zs-muted mt-2 max-w-xl">
            Fitur utama yang paling sering digunakan ada di satu tempat.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {QUICK_LINKS.map(({ path, title, description, Icon }) => (
            <Link key={path} href={path}>
              <div className="zs-surface zs-surface-hover group h-full p-5">
                <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.045] text-blue-400">
                  <Icon size={19} />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-white">
                    {title}
                  </h3>
                  <ArrowRight
                    size={16}
                    className="text-white/25 transition group-hover:translate-x-1 group-hover:text-white/60"
                  />
                </div>

                <p className="mt-2 text-sm leading-6 text-white/45">
                  {description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-24 sm:px-6">
        <div className="mb-7">
          <p className="zs-caption">Platform</p>
          <h2 className="zs-title mt-1">Lebih banyak fitur</h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ path, title, description, Icon }) => (
            <Link key={path} href={path}>
              <div className="zs-surface zs-surface-hover h-full p-5">
                <Icon size={19} className="text-white/60" />

                <h3 className="mt-5 text-sm font-semibold text-white">
                  {title}
                </h3>

                <p className="mt-2 text-xs leading-5 text-white/40">
                  {description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
