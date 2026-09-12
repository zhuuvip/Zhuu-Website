import { useState } from "react";

const LINKS = [
  {
    category: "🛠️ Dev Tools",
    items: [
      { title: "GitHub", url: "https://github.com", desc: "Host and collaborate on code", icon: "👾" },
      { title: "VS Code", url: "https://code.visualstudio.com", desc: "Free, powerful code editor", icon: "💻" },
      { title: "Vercel", url: "https://vercel.com", desc: "Deploy frontend apps instantly", icon: "▲" },
      { title: "Replit", url: "https://replit.com", desc: "Code and deploy in the browser", icon: "🔵" },
      { title: "Tailwind CSS", url: "https://tailwindcss.com", desc: "Utility-first CSS framework", icon: "🎨" },
      { title: "TypeScript", url: "https://typescriptlang.org", desc: "JavaScript with types", icon: "📘" },
    ],
  },
  {
    category: "🤖 AI Tools",
    items: [
      { title: "Claude", url: "https://claude.ai", desc: "Anthropic's AI assistant", icon: "🤖" },
      { title: "ChatGPT", url: "https://chat.openai.com", desc: "OpenAI's conversational AI", icon: "🧠" },
      { title: "Midjourney", url: "https://midjourney.com", desc: "AI image generation", icon: "🎨" },
      { title: "Cursor", url: "https://cursor.sh", desc: "AI-powered code editor", icon: "↗" },
      { title: "Perplexity", url: "https://perplexity.ai", desc: "AI-powered search engine", icon: "🔍" },
      { title: "Replicate", url: "https://replicate.com", desc: "Run AI models in the cloud", icon: "♻️" },
    ],
  },
  {
    category: "🎨 Design",
    items: [
      { title: "Figma", url: "https://figma.com", desc: "Collaborative design tool", icon: "✏️" },
      { title: "Framer", url: "https://framer.com", desc: "Interactive design & websites", icon: "🖼" },
      { title: "Dribbble", url: "https://dribbble.com", desc: "Design inspiration & showcase", icon: "🏀" },
      { title: "Coolors", url: "https://coolors.co", desc: "Color palette generator", icon: "🎨" },
      { title: "Google Fonts", url: "https://fonts.google.com", desc: "Free web fonts library", icon: "🔤" },
      { title: "Lucide Icons", url: "https://lucide.dev", desc: "Beautiful open source icons", icon: "✦" },
    ],
  },
  {
    category: "📚 Learning",
    items: [
      { title: "MDN Web Docs", url: "https://developer.mozilla.org", desc: "Web development documentation", icon: "📖" },
      { title: "React Docs", url: "https://react.dev", desc: "Official React documentation", icon: "⚛️" },
      { title: "freeCodeCamp", url: "https://freecodecamp.org", desc: "Free coding curriculum", icon: "🏕️" },
      { title: "Exercism", url: "https://exercism.org", desc: "Code challenges with mentoring", icon: "💪" },
      { title: "The Odin Project", url: "https://theodinproject.com", desc: "Full-stack web dev curriculum", icon: "🧙" },
      { title: "Roadmap.sh", url: "https://roadmap.sh", desc: "Developer learning roadmaps", icon: "🗺️" },
    ],
  },
  {
    category: "🌐 Useful Sites",
    items: [
      { title: "Hacker News", url: "https://news.ycombinator.com", desc: "Tech news & discussions", icon: "🔥" },
      { title: "Product Hunt", url: "https://producthunt.com", desc: "Discover new products daily", icon: "🐱" },
      { title: "Dev.to", url: "https://dev.to", desc: "Developer community & articles", icon: "👩‍💻" },
      { title: "CodePen", url: "https://codepen.io", desc: "Front-end code playground", icon: "✏️" },
      { title: "StackOverflow", url: "https://stackoverflow.com", desc: "Q&A for developers", icon: "💬" },
      { title: "Can I Use", url: "https://caniuse.com", desc: "Browser compatibility tables", icon: "🔄" },
    ],
  },
];

export default function ResourceLinksPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = LINKS.map(cat => ({
    ...cat,
    items: cat.items.filter(item =>
      !search || item.title.toLowerCase().includes(search.toLowerCase()) || item.desc.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(cat => !activeCategory ? true : cat.category === activeCategory)
    .filter(cat => cat.items.length > 0);

  return (
    <div className="ocean-bg min-h-screen pt-6 pb-28 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <div className="text-4xl mb-3">🔗</div>
          <h1 className="text-4xl font-black gradient-text mb-2" style={{ fontFamily: "Poppins, Inter, sans-serif" }}>Resources</h1>
          <p style={{ color: "rgba(0,200,220,0.5)" }}>Curated links, tools, and resources for creators & developers</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "rgba(0,200,220,0.5)" }}>🔍</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search links..."
              className="w-full pl-9 pr-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: "rgba(0,20,40,0.6)", border: "1px solid rgba(0,200,220,0.2)", color: "rgba(200,240,255,0.9)" }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setActiveCategory(null)}
              className="px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200"
              style={{ background: activeCategory === null ? "rgba(0,200,220,0.15)" : "rgba(0,20,40,0.5)", border: "1px solid rgba(0,200,220,0.2)", color: activeCategory === null ? "#00ffff" : "rgba(0,200,220,0.5)", cursor: "pointer" }}>
              All
            </button>
            {LINKS.map(cat => (
              <button key={cat.category} onClick={() => setActiveCategory(activeCategory === cat.category ? null : cat.category)}
                className="px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200"
                style={{ background: activeCategory === cat.category ? "rgba(0,200,220,0.15)" : "rgba(0,20,40,0.5)", border: "1px solid rgba(0,200,220,0.2)", color: activeCategory === cat.category ? "#00ffff" : "rgba(0,200,220,0.5)", cursor: "pointer" }}>
                {cat.category.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-8">
          {filtered.map((cat) => (
            <div key={cat.category}>
              <h2 className="font-bold text-lg mb-4" style={{ color: "rgba(0,200,220,0.7)", fontFamily: "Poppins, Inter, sans-serif" }}>{cat.category}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {cat.items.map((item) => (
                  <a key={item.title} href={item.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                    <div className="glass-card glass-card-hover p-4 flex items-center gap-3 cursor-pointer rounded-xl">
                      <div style={{ fontSize: 22, flexShrink: 0, width: 36, textAlign: "center" }}>{item.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm" style={{ color: "rgba(0,220,240,0.9)" }}>{item.title}</div>
                        <div className="text-xs truncate" style={{ color: "rgba(0,200,220,0.45)" }}>{item.desc}</div>
                      </div>
                      <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="rgba(0,200,220,0.3)" strokeWidth={2} style={{ flexShrink: 0 }}>
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points="15 3 21 3 21 9" strokeLinecap="round" strokeLinejoin="round" />
                        <line x1="10" y1="14" x2="21" y2="3" strokeLinecap="round" />
                      </svg>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">🌊</div>
              <p style={{ color: "rgba(0,200,220,0.5)" }}>No links found for "{search}"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
