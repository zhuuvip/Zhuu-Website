import { useState, useRef } from "react";
import { useUser } from "@clerk/react";

const CARD_THEMES = [
  { id: "ocean", label: "🌊 Ocean", bg: "linear-gradient(135deg, #000d1a 0%, #001a33 50%, #002244 100%)", accent: "#00d4ff" },
  { id: "void", label: "🖤 Void", bg: "linear-gradient(135deg, #0a0a0a 0%, #1a0a2e 50%, #0d0d0d 100%)", accent: "#a855f7" },
  { id: "fire", label: "🔥 Fire", bg: "linear-gradient(135deg, #1a0000 0%, #2d0a00 50%, #1a0505 100%)", accent: "#ff6b35" },
  { id: "cyber", label: "⚡ Cyber", bg: "linear-gradient(135deg, #000a1a 0%, #001a0d 50%, #000d1a 100%)", accent: "#00ff88" },
];

const TITLES = [
  "ZhuuVIP Member",
  "Deep Ocean Explorer",
  "Void Walker",
  "Zhuu Community OG",
  "AI Enthusiast",
  "Gaming Legend",
];

export default function ShareCardPage() {
  const { user } = useUser();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [theme, setTheme] = useState(CARD_THEMES[0]);
  const [title, setTitle] = useState(TITLES[0]);
  const [customName, setCustomName] = useState(user?.username || user?.firstName || "ZhuuVIP");
  const [generated, setGenerated] = useState(false);

  const generateCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 800;
    canvas.height = 450;

    // Background
    const gradient = ctx.createLinearGradient(0, 0, 800, 450);
    gradient.addColorStop(0, "#000d1a");
    gradient.addColorStop(0.5, "#001a33");
    gradient.addColorStop(1, "#002244");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 800, 450);

    // Border glow
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 3;
    ctx.shadowColor = theme.accent;
    ctx.shadowBlur = 20;
    ctx.strokeRect(10, 10, 780, 430);
    ctx.shadowBlur = 0;

    // Logo/Icon area
    ctx.fillStyle = theme.accent + "22";
    ctx.beginPath();
    ctx.arc(130, 180, 80, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Emoji as avatar
    ctx.font = "80px serif";
    ctx.textAlign = "center";
    ctx.fillText("🌊", 130, 210);

    // ZhuuVIP title
    ctx.font = "bold 48px Arial";
    ctx.fillStyle = theme.accent;
    ctx.textAlign = "left";
    ctx.shadowColor = theme.accent;
    ctx.shadowBlur = 15;
    ctx.fillText("ZhuuVIP", 240, 140);
    ctx.shadowBlur = 0;

    // Name
    ctx.font = "bold 32px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(customName, 240, 200);

    // Title/Role
    ctx.font = "20px Arial";
    ctx.fillStyle = theme.accent + "cc";
    ctx.fillText(title, 240, 240);

    // Divider
    ctx.strokeStyle = theme.accent + "44";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(240, 260);
    ctx.lineTo(740, 260);
    ctx.stroke();

    // Website
    ctx.font = "18px Arial";
    ctx.fillStyle = theme.accent + "99";
    ctx.fillText("zhuusite.vercel.app", 240, 295);

    // Bottom tag
    ctx.font = "bold 16px Arial";
    ctx.fillStyle = theme.accent + "66";
    ctx.textAlign = "center";
    ctx.fillText("— A ZhuuVIP Experience —", 400, 420);

    // Decorative dots
    for (let i = 0; i < 20; i++) {
      ctx.beginPath();
      ctx.arc(
        Math.random() * 800,
        Math.random() * 450,
        Math.random() * 2,
        0, Math.PI * 2
      );
      ctx.fillStyle = theme.accent + "33";
      ctx.fill();
    }

    setGenerated(true);
  };

  const downloadCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "zhuuvip-card.png";
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="ocean-bg min-h-screen pt-6 pb-28 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🎴</div>
          <h1 className="text-4xl font-black gradient-text mb-2" style={{ fontFamily: "Poppins, Inter, sans-serif" }}>
            Share Card
          </h1>
          <p style={{ color: "rgba(0,200,220,0.5)" }}>Generate your ZhuuVIP card and share it!</p>
        </div>

        {/* Options */}
        <div className="space-y-4 mb-6">
          {/* Name */}
          <div className="glass-card p-4 rounded-2xl">
            <label className="text-sm font-semibold mb-2 block" style={{ color: "rgba(0,200,220,0.8)" }}>Your Name</label>
            <input
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              placeholder="Enter your name..."
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: "rgba(0,20,40,0.6)", border: "1px solid rgba(0,200,220,0.15)", color: "rgba(200,240,255,0.9)" }}
            />
          </div>

          {/* Title */}
          <div className="glass-card p-4 rounded-2xl">
            <label className="text-sm font-semibold mb-2 block" style={{ color: "rgba(0,200,220,0.8)" }}>Title</label>
            <div className="grid grid-cols-2 gap-2">
              {TITLES.map(t => (
                <button
                  key={t}
                  onClick={() => setTitle(t)}
                  className="px-3 py-2 rounded-xl text-xs text-left transition-all"
                  style={{
                    background: title === t ? "rgba(0,200,220,0.15)" : "rgba(0,20,40,0.5)",
                    border: title === t ? "1px solid rgba(0,200,220,0.4)" : "1px solid rgba(0,200,220,0.1)",
                    color: title === t ? "#00e5ff" : "rgba(0,220,240,0.6)",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Theme */}
          <div className="glass-card p-4 rounded-2xl">
            <label className="text-sm font-semibold mb-2 block" style={{ color: "rgba(0,200,220,0.8)" }}>Theme</label>
            <div className="flex gap-2">
              {CARD_THEMES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t)}
                  className="flex-1 px-3 py-2 rounded-xl text-xs transition-all"
                  style={{
                    background: theme.id === t.id ? "rgba(0,200,220,0.15)" : "rgba(0,20,40,0.5)",
                    border: theme.id === t.id ? `1px solid ${t.accent}` : "1px solid rgba(0,200,220,0.1)",
                    color: t.accent,
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={generateCard}
          className="w-full py-4 rounded-full font-bold text-base neon-btn-solid mb-6"
        >
          Generate Card ✨
        </button>

        {/* Canvas Preview */}
        <div className="glass-card p-4 rounded-2xl mb-4">
          <canvas
            ref={canvasRef}
            className="w-full rounded-xl"
            style={{ display: "block" }}
          />
          {!generated && (
            <div className="text-center py-8" style={{ color: "rgba(0,200,220,0.3)" }}>
              Click Generate to preview your card
            </div>
          )}
        </div>

        {/* Download Button */}
        {generated && (
          <button
            onClick={downloadCard}
            className="w-full py-4 rounded-full font-bold text-base neon-btn"
          >
            Download Card 📥
          </button>
        )}
      </div>
    </div>
  );
}
