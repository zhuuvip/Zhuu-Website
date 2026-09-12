import { useState, useEffect } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

const CATEGORIES = [
  { id: "bug", label: "Bug Report", desc: "Something is broken" },
  { id: "feature", label: "Feature Request", desc: "An idea for something new" },
  { id: "design", label: "Design Feedback", desc: "Visual or UX suggestions" },
  { id: "performance", label: "Performance", desc: "Speed or technical issues" },
  { id: "content", label: "Content", desc: "About links, AI, or content" },
  { id: "other", label: "Other", desc: "Anything else" },
];

const RATINGS = ["😕", "😐", "🙂", "😊", "🤩"];
const RATING_LABELS = ["Not great", "It's okay", "Pretty good", "Really like it", "Love it!"];

export default function FeedbackPage() {
  const [category, setCategory] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [guestbook, setGuestbook] = useState<any[]>([]);

  const fetchGuestbook = () => {
    fetch(`${API_BASE}/api/guestbook`)
      .then(r => r.json())
      .then(data => Array.isArray(data) && setGuestbook(data))
      .catch(() => {});
  };

  useEffect(() => {
    fetchGuestbook();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      await fetch(`${API_BASE}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, rating, name, email, message }),
      });
      setSubmitted(true);
      fetchGuestbook();
    } catch {
      setError("Failed to send feedback. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (submitted) {
    return (
      <div className="ocean-bg min-h-screen pt-6 pb-28 px-4 flex items-center justify-center">
        <div className="glass-card p-12 text-center max-w-md w-full rounded-2xl">
          <div className="text-6xl mb-4">🌊</div>
          <h2 className="text-2xl font-black gradient-text mb-3">Thanks for the feedback!</h2>
          <p style={{ color: "rgba(0,200,220,0.55)", lineHeight: 1.6 }}>
            Your message has been received.
          </p>
          <button
            onClick={() => { setSubmitted(false); setMessage(""); setCategory(null); setRating(null); setName(""); setEmail(""); }}
            className="mt-8 neon-btn px-8 py-3 rounded-full font-semibold text-sm"
          >
            Send Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ocean-bg min-h-screen pt-6 pb-28 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <div className="text-4xl mb-3">💬</div>
          <h1 className="text-4xl font-black gradient-text mb-2">Feedback</h1>
          <p style={{ color: "rgba(0,200,220,0.5)" }}>Share your thoughts and suggestions.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="glass-card p-6 rounded-2xl">
            <h3 className="font-semibold mb-4" style={{ color: "rgba(0,200,220,0.8)" }}>Overall Experience</h3>
            <div className="flex justify-center gap-4">
              {RATINGS.map((emoji, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setRating(i)}
                  className="text-3xl transition-all duration-200 rounded-full p-2"
                  style={{
                    opacity: rating === null || rating === i ? 1 : 0.4,
                    transform: rating === i ? "scale(1.3)" : "scale(1)",
                    background: rating === i ? "rgba(0,200,220,0.1)" : "transparent",
                    border: rating === i ? "1px solid rgba(0,200,220,0.3)" : "1px solid transparent",
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
            {rating !== null && (
              <p className="text-center mt-3 text-sm" style={{ color: "rgba(0,200,220,0.55)" }}>
                {RATING_LABELS[rating]}
              </p>
            )}
          </div>

          <div className="glass-card p-6 rounded-2xl">
            <h3 className="font-semibold mb-4" style={{ color: "rgba(0,200,220,0.8)" }}>Category</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className="p-3 rounded-xl text-left transition-all duration-200"
                  style={{
                    background: category === cat.id ? "rgba(0,200,220,0.12)" : "rgba(0,20,40,0.5)",
                    border: category === cat.id ? "1px solid rgba(0,200,220,0.4)" : "1px solid rgba(0,200,220,0.1)",
                    cursor: "pointer",
                  }}
                >
                  <div className="text-sm font-semibold" style={{ color: category === cat.id ? "#00e5ff" : "rgba(0,220,240,0.7)" }}>
                    {cat.label}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "rgba(0,200,220,0.4)" }}>{cat.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="glass-card p-6 space-y-4 rounded-2xl">
            <h3 className="font-semibold mb-2" style={{ color: "rgba(0,200,220,0.8)" }}>Contact Info (optional)</h3>
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "rgba(0,200,220,0.55)" }}>Name</label>
              <input
                value={name} onChange={e => setName(e.target.value)}
                placeholder="Your name..."
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: "rgba(0,20,40,0.6)", border: "1px solid rgba(0,200,220,0.15)", color: "rgba(200,240,255,0.9)" }}
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "rgba(0,200,220,0.55)" }}>Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com..."
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: "rgba(0,20,40,0.6)", border: "1px solid rgba(0,200,220,0.15)", color: "rgba(200,240,255,0.9)" }}
              />
            </div>
          </div>

          <div className="glass-card p-6 rounded-2xl">
            <label className="font-semibold mb-3 block" style={{ color: "rgba(0,200,220,0.8)" }}>
              Your Message <span style={{ color: "#ff6b6b", fontSize: 12 }}>*</span>
            </label>
            <textarea
              value={message} onChange={e => setMessage(e.target.value)}
              placeholder="Tell us what you think..."
              rows={5}
              required
              className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
              style={{ background: "rgba(0,20,40,0.6)", border: "1px solid rgba(0,200,220,0.15)", color: "rgba(200,240,255,0.9)", lineHeight: 1.6 }}
            />
            <div className="mt-2 text-xs" style={{ color: "rgba(0,200,220,0.35)" }}>{message.length} characters</div>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl text-sm" style={{ background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.25)", color: "#f87171" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!message.trim() || sending}
            className="w-full py-4 rounded-full font-bold text-base transition-all duration-300 neon-btn"
          >
            {sending ? "Sending..." : "Send Feedback"}
          </button>
        </form>

        {guestbook.length > 0 && (
          <div className="mt-10">
            <h2 className="text-2xl font-black gradient-text mb-6 text-center">Guestbook</h2>
            <div className="flex flex-col gap-3">
              {guestbook.map((entry: any) => (
                <div key={entry.id} className="glass-card p-4 rounded-2xl">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-sm" style={{ color: "#00e5ff" }}>{entry.name || "Anonymous"}</span>
                    {entry.rating !== null && <span className="text-lg">{RATINGS[entry.rating]}</span>}
                    <span className="text-xs ml-auto" style={{ color: "rgba(0,200,220,0.35)" }}>
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: "rgba(200,240,255,0.7)", lineHeight: 1.6 }}>{entry.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
