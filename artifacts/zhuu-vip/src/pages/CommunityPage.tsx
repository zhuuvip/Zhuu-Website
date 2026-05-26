const DISCORD_INVITE = "https://discord.gg/zhuu";

const PLATFORMS = [
  { name: "Discord", icon: "💬", desc: "Our main community hub. Meet the crew, share work, get feedback, and have fun!", members: "500+", color: "#5865f2", link: DISCORD_INVITE, btn: "Join", badge: "Most Active" },
  { name: "YouTube", icon: "▶️", desc: "Full-length tutorials, vlogs, community highlights, and deep dives.", members: "800+", color: "#ff0000", link: "https://youtube.com/@zhuuvip", btn: "Subscribe", badge: null },
  { name: "TikTok", icon: "🎵", desc: "Short videos, tutorials, and fun content from the ZhuuVIP universe.", members: "1K+", color: "#ff0050", link: "https://tiktok.com/@zhuuvip", btn: "Follow", badge: null },
  { name: "Instagram", icon: "📸", desc: "Follow for daily inspiration, creative showcases, and behind-the-scenes content.", members: "2K+", color: "#e1306c", link: "https://instagram.com/zhuuvip", btn: "Follow", badge: null },
  { name: "Twitter / X", icon: "🐦", desc: "Real-time updates, thoughts, announcements, and community interactions.", members: "1.5K+", color: "#1da1f2", link: "https://twitter.com/zhuuvip", btn: "Follow", badge: null },
  { name: "GitHub", icon: "👾", desc: "Open source projects, code snippets, and technical contributions.", members: "300+", color: "#6e40c9", link: "https://github.com/zhuuvip", btn: "Star", badge: "Dev Hub" },
];

const RULES = [
  { icon: "🌊", title: "Be respectful", desc: "Treat everyone with kindness and respect. No harassment or hate speech." },
  { icon: "💡", title: "Share & inspire", desc: "Share your work, ideas, and knowledge to inspire others in the community." },
  { icon: "🤝", title: "Collaborate", desc: "Reach out, team up, and help others. We grow together." },
  { icon: "🌐", title: "Stay on topic", desc: "Keep discussions relevant and constructive. Use the right channels." },
];

export default function CommunityPage() {
  return (
    <div className="ocean-bg min-h-screen pt-6 pb-28 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <div className="text-5xl mb-4">🌊</div>
          <h1 className="text-4xl font-black gradient-text mb-3" style={{ fontFamily: "Poppins, Inter, sans-serif" }}>Join the Community</h1>
          <p style={{ color: "rgba(0,200,220,0.5)", maxWidth: 500, margin: "0 auto", lineHeight: 1.7 }}>
            Dive into ZhuuVIP's ocean community. A space for creators, developers, and dreamers to connect and grow.
          </p>
        </div>

        <div className="glass-card p-8 mb-10 text-center rounded-2xl" style={{ background: "linear-gradient(135deg, rgba(0,100,150,0.15), rgba(0,50,100,0.15))" }}>
          <div className="text-4xl mb-4">💬</div>
          <h2 className="text-2xl font-black gradient-text mb-2" style={{ fontFamily: "Poppins, Inter, sans-serif" }}>Discord Server</h2>
          <p className="mb-6" style={{ color: "rgba(0,200,220,0.6)" }}>Our main community hub. Meet the crew, share work, get feedback, and have fun!</p>
          <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">
            <button className="neon-btn-solid px-10 py-4 rounded-full font-bold text-base">
              Join Discord Now →
            </button>
          </a>
          <div className="mt-4 flex justify-center gap-6">
            {[["500+", "Members"], ["#general", "Channels"], ["24/7", "Active"]].map(([val, lbl]) => (
              <div key={lbl} className="text-center">
                <div className="font-black text-lg gradient-text" style={{ fontFamily: "Poppins, Inter, sans-serif" }}>{val}</div>
                <div className="text-xs" style={{ color: "rgba(0,200,220,0.4)" }}>{lbl}</div>
              </div>
            ))}
          </div>
        </div>

        <h2 className="text-2xl font-black gradient-text mb-6" style={{ fontFamily: "Poppins, Inter, sans-serif" }}>Find Us Everywhere</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-14">
          {PLATFORMS.map((p) => (
            <div key={p.name} className="glass-card glass-card-hover p-6 rounded-2xl">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{p.icon}</span>
                  <h3 className="font-bold" style={{ color: p.color, fontFamily: "Poppins, Inter, sans-serif" }}>{p.name}</h3>
                </div>
                {p.badge && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: `${p.color}20`, color: p.color, border: `1px solid ${p.color}30` }}>
                    {p.badge}
                  </span>
                )}
              </div>
              <p className="text-sm mb-4" style={{ color: "rgba(0,200,220,0.55)", lineHeight: 1.6 }}>{p.desc}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: "rgba(0,200,220,0.4)" }}>{p.members} followers</span>
                <a href={p.link} target="_blank" rel="noopener noreferrer">
                  <button className="neon-btn px-4 py-2 rounded-full text-sm font-semibold"
                    style={{ borderColor: `${p.color}50`, color: p.color }}>
                    {p.btn} →
                  </button>
                </a>
              </div>
            </div>
          ))}
        </div>

        <div className="glass-card p-8 rounded-2xl">
          <h2 className="text-2xl font-black gradient-text mb-6" style={{ fontFamily: "Poppins, Inter, sans-serif" }}>Community Guidelines</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {RULES.map((r) => (
              <div key={r.title} className="flex gap-4 p-4 rounded-xl" style={{ background: "rgba(0,200,220,0.04)", border: "1px solid rgba(0,200,220,0.08)" }}>
                <span className="text-2xl flex-shrink-0">{r.icon}</span>
                <div>
                  <h4 className="font-semibold mb-1" style={{ color: "rgba(0,220,240,0.85)" }}>{r.title}</h4>
                  <p className="text-sm" style={{ color: "rgba(0,200,220,0.5)", lineHeight: 1.55 }}>{r.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
