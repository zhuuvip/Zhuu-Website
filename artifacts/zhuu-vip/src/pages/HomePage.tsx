import { Link } from "wouter";
import { useEffect } from "react";
import { Show, useUser } from "@clerk/react";
import { ChevronRight, Shield, Waves, Zap, Bot, Lock, Gauge } from "lucide-react";
import logoPath from "@assets/file_000000003e9c72078d0f388bef03af6a_1778462394630.png";

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || "";
const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

const FEATURES = [
  {
    icon: "⚡",
    emoji: true,
    title: "Speed Test",
    desc: "Real-time internet speed testing with download, upload, and latency measurement.",
    path: "/speedtest",
    color: "#00ffff",
    gradient: "from-cyan-400/15 to-transparent",
  },
  {
    icon: "✨",
    emoji: true,
    title: "Zhuu AI",
    desc: "Chat with Zhuu AI — your deep-sea companion powered by Gemini. Upload files, send voice messages.",
    path: "/ai",
    color: "#a78bfa",
    gradient: "from-violet-400/15 to-transparent",
  },
  {
    icon: "💼",
    emoji: true,
    title: "Portfolio",
    desc: "Explore projects and works curated by Zhuu and the community.",
    path: "/portfolio",
    color: "#34d399",
    gradient: "from-emerald-400/15 to-transparent",
  },
  {
    icon: "🌊",
    emoji: true,
    title: "Community",
    desc: "Join our underwater world. Meet creators, share ideas, and grow together.",
    path: "/community",
    color: "#60a5fa",
    gradient: "from-blue-400/15 to-transparent",
  },
  {
    icon: "🔗",
    emoji: true,
    title: "Resources",
    desc: "Curated links, tools, and resources for developers and creators.",
    path: "/resources",
    color: "#f9a8d4",
    gradient: "from-pink-400/15 to-transparent",
  },
  {
    icon: "💬",
    emoji: true,
    title: "Feedback",
    desc: "Share your thoughts, ideas, and suggestions to improve ZhuuVIP.",
    path: "/feedback",
    color: "#fcd34d",
    gradient: "from-yellow-400/15 to-transparent",
  },
];

const HIGHLIGHTS = [
  {
    Icon: Bot,
    label: "Gemini AI",
    sub: "Powered by Google",
    color: "rgba(167,139,250,0.8)",
    bg: "rgba(167,139,250,0.07)",
    border: "rgba(167,139,250,0.2)",
  },
  {
    Icon: Waves,
    label: "Ocean Theme",
    sub: "Deep sea aesthetic",
    color: "rgba(0,212,255,0.8)",
    bg: "rgba(0,212,255,0.07)",
    border: "rgba(0,212,255,0.2)",
  },
  {
    Icon: Lock,
    label: "Auth by Clerk",
    sub: "Google & email sign-in",
    color: "rgba(52,211,153,0.8)",
    bg: "rgba(52,211,153,0.07)",
    border: "rgba(52,211,153,0.2)",
  },
  {
    Icon: Zap,
    label: "Built for Speed",
    sub: "Vite + React",
    color: "rgba(251,191,36,0.8)",
    bg: "rgba(251,191,36,0.07)",
    border: "rgba(251,191,36,0.2)",
  },
];

export default function HomePage() {
  useEffect(() => {
    fetch(`${API_BASE}/api/visitors`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ page: "/" }) }).catch(() => {});
  }, []);
  const { user } = useUser();

  const isAdmin =
    user?.primaryEmailAddress?.emailAddress === ADMIN_EMAIL ||
    user?.externalAccounts?.[0]?.emailAddress === ADMIN_EMAIL;

  return (
    <div className="ocean-bg min-h-screen">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center min-h-[92vh] px-4 text-center relative">
        {/* Ambient glow */}
        <div
          style={{
            position: "absolute",
            top: "35%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 700,
            height: 700,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(0,200,220,0.06) 0%, transparent 65%)",
            pointerEvents: "none",
          }}
        />

        <div className="relative z-10 flex flex-col items-center">
          {/* Avatar */}
          <div className="relative mb-8 animate-float" data-testid="hero-avatar">
            <div
              style={{
                width: 136,
                height: 136,
                borderRadius: "50%",
                overflow: "hidden",
                border: "3px solid rgba(0,255,255,0.4)",
                boxShadow:
                  "0 0 36px rgba(0,255,255,0.22), 0 0 80px rgba(0,200,220,0.1)",
              }}
            >
              <img
                src={logoPath}
                alt="Zhuu"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
            {/* Badge */}
            <div
              style={{
                position: "absolute",
                bottom: 4,
                right: 4,
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #00d4ff, #9b59b6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 14px rgba(0,212,255,0.5)",
                border: "2px solid rgba(1,10,20,0.8)",
              }}
            >
              <Waves size={14} color="white" />
            </div>
          </div>

          {/* Status badge */}
          <div
            className="mb-5 inline-flex items-center gap-2 px-4 py-2 rounded-full"
            style={{
              background: "rgba(0,200,220,0.06)",
              border: "1px solid rgba(0,255,255,0.16)",
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#4ade80",
                display: "inline-block",
                boxShadow: "0 0 7px rgba(74,222,128,0.75)",
                flexShrink: 0,
              }}
            />
            <span
              className="text-xs font-medium tracking-wide"
              style={{ color: "rgba(0,200,220,0.75)" }}
            >
              Deep ocean, online 24/7
            </span>
          </div>

          {/* Title */}
          <h1
            className="text-6xl md:text-8xl font-black mb-5 leading-none"
            style={{ fontFamily: "Poppins, Inter, sans-serif" }}
          >
            <span className="gradient-text">Zhuu</span>
            <span className="text-white">VIP</span>
          </h1>

          <p
            className="text-lg md:text-xl max-w-lg mb-10 leading-relaxed"
            style={{ color: "rgba(0,200,220,0.6)" }}
          >
            Your VIP portal to the deep ocean — AI chat, speed tests, community,
            portfolio, and more.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Show when="signed-out">
              <Link href="/community">
                <button className="neon-btn-solid px-8 py-3.5 rounded-full font-bold text-base transition-all hover:scale-105">
                  Join the Community 🌊
                </button>
              </Link>
              <Link href="/ai">
                <button
                  className="neon-btn px-8 py-3.5 rounded-full font-bold text-base transition-all hover:scale-105"
                  style={{
                    borderColor: "rgba(167,139,250,0.45)",
                    color: "#c4b5fd",
                  }}
                >
                  Chat with Zhuu AI ✨
                </button>
              </Link>
            </Show>
            <Show when="signed-in">
              <Link href="/ai">
                <button className="neon-btn-solid px-8 py-3.5 rounded-full font-bold text-base flex items-center gap-2 transition-all hover:scale-105">
                  Open Zhuu AI ✨ <ChevronRight size={16} />
                </button>
              </Link>
              {isAdmin && (
                <Link href="/admin">
                  <button
                    className="neon-btn px-6 py-3.5 rounded-full font-bold text-base flex items-center gap-2 transition-all hover:scale-105"
                    style={{
                      borderColor: "rgba(150,80,255,0.45)",
                      color: "#c084fc",
                    }}
                  >
                    <Shield size={15} /> Admin
                  </button>
                </Link>
              )}
            </Show>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-30 select-none">
          <span className="text-xs text-cyan-400" style={{ letterSpacing: "0.14em" }}>
            SCROLL
          </span>
          <div
            style={{
              width: 1.5,
              height: 36,
              background:
                "linear-gradient(180deg, rgba(0,255,255,0.65), transparent)",
            }}
          />
        </div>
      </section>

      {/* Highlights strip */}
      <section className="px-4 pb-16">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          {HIGHLIGHTS.map(({ Icon, label, sub, color, bg, border }) => (
            <div
              key={label}
              className="glass-card p-5 text-center rounded-2xl transition-all duration-300 hover:scale-[1.03]"
              style={{
                background: bg,
                borderColor: border,
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3"
                style={{
                  background: `${bg}`,
                  border: `1px solid ${border}`,
                }}
              >
                <Icon size={18} style={{ color }} />
              </div>
              <div
                className="text-sm font-bold mb-0.5"
                style={{ color }}
              >
                {label}
              </div>
              <div
                className="text-xs"
                style={{ color: "rgba(0,200,220,0.4)" }}
              >
                {sub}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="section-divider mx-auto max-w-3xl mb-16" />

      {/* Features grid */}
      <section className="px-4 pb-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2
              className="text-3xl md:text-4xl font-black gradient-text mb-3"
              style={{ fontFamily: "Poppins, Inter, sans-serif" }}
            >
              Explore ZhuuVIP
            </h2>
            <p className="text-sm" style={{ color: "rgba(0,200,220,0.42)" }}>
              Everything you need, in the deep ocean
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <Link key={f.path} href={f.path}>
                <div
                  className="group glass-card glass-card-hover p-6 cursor-pointer h-full rounded-2xl transition-all duration-300 relative overflow-hidden"
                  style={{ borderColor: "rgba(0,255,255,0.07)" }}
                >
                  {/* Hover gradient overlay */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${f.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl pointer-events-none`}
                  />
                  <div className="relative">
                    <div className="text-3xl mb-3">{f.icon}</div>
                    <h3
                      className="font-bold text-lg mb-2 transition-all duration-200"
                      style={{
                        color: f.color,
                        fontFamily: "Poppins, Inter, sans-serif",
                      }}
                    >
                      {f.title}
                    </h3>
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: "rgba(0,200,220,0.5)" }}
                    >
                      {f.desc}
                    </p>
                    <div
                      className="mt-4 flex items-center gap-1.5 font-medium transition-all duration-200 group-hover:gap-2.5"
                      style={{ color: f.color, fontSize: 13 }}
                    >
                      Explore <ChevronRight size={13} />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA banner */}
      <section className="px-4 pb-24">
        <div
          className="max-w-2xl mx-auto text-center glass-card p-10 rounded-2xl relative overflow-hidden"
          style={{ borderColor: "rgba(0,255,255,0.1)" }}
        >
          {/* Subtle glow */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 400,
              height: 200,
              background: "radial-gradient(ellipse, rgba(0,200,220,0.045) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />
          <div className="relative">
            <div className="text-4xl mb-4">🌊</div>
            <h2
              className="text-3xl font-black gradient-text mb-3"
              style={{ fontFamily: "Poppins, Inter, sans-serif" }}
            >
              Ready to dive in?
            </h2>
            <p className="mb-8 text-sm" style={{ color: "rgba(0,200,220,0.5)" }}>
              Join ZhuuVIP and explore the deep ocean community.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link href="/community">
                <button className="neon-btn-solid px-10 py-3.5 rounded-full font-bold text-base transition-all hover:scale-105">
                  Join Community →
                </button>
              </Link>
              <Link href="/ai">
                <button
                  className="neon-btn px-8 py-3.5 rounded-full font-bold text-base transition-all hover:scale-105"
                  style={{
                    borderColor: "rgba(167,139,250,0.4)",
                    color: "#c4b5fd",
                  }}
                >
                  Try Zhuu AI ✨
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
