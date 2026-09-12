const PROJECTS = [
  {
    title: "ZhuuVIP Platform",
    desc: "A full-featured VIP community platform with speed test, AI chat, portfolio, and more. Built with React, TypeScript, and Claude AI.",
    tags: ["React", "TypeScript", "Claude AI", "Vite"],
    icon: "🌊", color: "#00ffff", status: "Live",
    link: "/",
  },
  {
    title: "Zhuu AI Assistant",
    desc: "Deep-sea AI companion powered by Anthropic Claude. Handles coding, questions, creative writing with streaming responses and chat history.",
    tags: ["Anthropic", "SSE", "Node.js", "Streaming"],
    icon: "✨", color: "#a78bfa", status: "Live",
    link: "/ai",
  },
  {
    title: "Ocean Speed Test",
    desc: "Real-time internet speed testing with download, upload, ping and jitter measurement. No third-party APIs.",
    tags: ["Web APIs", "Performance", "TypeScript"],
    icon: "⚡", color: "#34d399", status: "Live",
    link: "/speedtest",
  },
  {
    title: "Deep Sea Community",
    desc: "Online community hub for creators, developers, and ocean enthusiasts. Share, connect, and grow together.",
    tags: ["Community", "Social", "Discord"],
    icon: "👥", color: "#60a5fa", status: "Growing",
    link: "/community",
  },
  {
    title: "Link Collection",
    desc: "Curated library of useful links, tools, and resources from the web, organized by category for easy access.",
    tags: ["Curation", "Resources", "Tools"],
    icon: "🔗", color: "#f9a8d4", status: "Active",
    link: "/resources",
  },
  {
    title: "Zhuu Brand Design",
    desc: "The visual identity and branding system for ZhuuVIP — deep ocean colors, neon cyan palette, immersive ocean animations.",
    tags: ["Design", "Branding", "CSS", "Animation"],
    icon: "🎨", color: "#fcd34d", status: "v2.0",
    link: "#",
  },
];

const SKILLS = [
  { label: "React / TypeScript", pct: 95, color: "#00ffff" },
  { label: "AI Integration (Claude)", pct: 90, color: "#a78bfa" },
  { label: "UI/UX Design", pct: 85, color: "#34d399" },
  { label: "Node.js / Express", pct: 88, color: "#60a5fa" },
  { label: "CSS / Animations", pct: 92, color: "#f9a8d4" },
  { label: "Community Building", pct: 80, color: "#fcd34d" },
];

import logoPath from "@assets/file_000000003e9c72078d0f388bef03af6a_1778462394630.png";

export default function PortfolioPage() {
  return (
    <div className="ocean-bg min-h-screen pt-6 pb-28 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-6">
            <div style={{ width: 70, height: 70, borderRadius: "50%", overflow: "hidden", border: "3px solid rgba(0,255,255,0.4)", boxShadow: "0 0 25px rgba(0,255,255,0.3)" }}>
              <img src={logoPath} alt="Zhuu" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          </div>
          <h1 className="text-4xl font-black gradient-text mb-2" style={{ fontFamily: "Poppins, Inter, sans-serif" }}>Portfolio</h1>
          <p style={{ color: "rgba(0,200,220,0.5)", maxWidth: 500, margin: "0 auto" }}>
            Projects, creations, and digital works from the deep ocean of Zhuu's imagination.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-14">
          {PROJECTS.map((p) => (
            <a key={p.title} href={p.link} style={{ textDecoration: "none" }}>
              <div className="glass-card glass-card-hover p-6 cursor-pointer h-full flex flex-col rounded-2xl">
                <div className="flex items-start justify-between mb-4">
                  <div className="text-3xl">{p.icon}</div>
                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                    style={{ background: `${p.color}18`, color: p.color, border: `1px solid ${p.color}30` }}>
                    {p.status}
                  </span>
                </div>
                <h3 className="font-bold text-base mb-2" style={{ color: p.color, fontFamily: "Poppins, Inter, sans-serif" }}>{p.title}</h3>
                <p className="text-sm flex-1 mb-4" style={{ color: "rgba(0,200,220,0.55)", lineHeight: 1.6 }}>{p.desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {p.tags.map((tag) => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded"
                      style={{ background: "rgba(0,200,220,0.08)", color: "rgba(0,200,220,0.6)", border: "1px solid rgba(0,200,220,0.1)" }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </a>
          ))}
        </div>

        <div className="section-divider mb-14" />

        <div className="glass-card p-8 mb-10 rounded-2xl">
          <h2 className="text-2xl font-black gradient-text mb-6" style={{ fontFamily: "Poppins, Inter, sans-serif" }}>Skills & Expertise</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {SKILLS.map((s) => (
              <div key={s.label}>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium" style={{ color: "rgba(0,220,240,0.8)" }}>{s.label}</span>
                  <span className="text-sm font-bold" style={{ color: s.color }}>{s.pct}%</span>
                </div>
                <div style={{ height: 6, background: "rgba(0,200,220,0.1)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${s.pct}%`,
                    background: `linear-gradient(90deg, ${s.color}80, ${s.color})`,
                    borderRadius: 3,
                    boxShadow: `0 0 8px ${s.color}60`,
                    transition: "width 1s ease",
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-8 text-center rounded-2xl">
          <div className="text-4xl mb-4">🤝</div>
          <h2 className="text-2xl font-black gradient-text mb-3" style={{ fontFamily: "Poppins, Inter, sans-serif" }}>Want to Collaborate?</h2>
          <p className="mb-6" style={{ color: "rgba(0,200,220,0.55)" }}>
            Open for creative projects, collaborations, and community building.
          </p>
          <a href="/community">
            <button className="neon-btn-solid px-10 py-4 rounded-full font-bold text-base">
              Get in Touch 🌊
            </button>
          </a>
        </div>
      </div>
    </div>
  );
}
