import { useEffect, useRef, useState } from "react";
import { useAuth, useUser, SignInButton } from "@clerk/react";

const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

type ChatMessage = {
  id: number;
  userId: string;
  username?: string;
  imageUrl?: string;
  message: string;
  createdAt: string;
};

export default function PublicChatPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const chatScrollRef = useRef<HTMLDivElement>(null);

  const authHeaders = async () => {
    const token = await getToken();

    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  };

  const loadMessages = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/public-chat/messages`, {
        headers: await authHeaders(),
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("Failed to load chat");
      }

      const data = await res.json();
      setMessages(data.messages || []);
      setError("");
    } catch {
      setError("Gagal memuat chat.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    loadMessages();

    const interval = window.setInterval(loadMessages, 3000);

    return () => window.clearInterval(interval);
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    const container = chatScrollRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    if (distanceFromBottom <= 80) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  const sendMessage = async () => {
    const text = message.trim();

    if (!text || sending) return;

    setSending(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/api/public-chat/messages`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send message");
      }

      setMessages((current) => [...current, data.message]);
      setMessage("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal mengirim pesan."
      );
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-zinc-200">Memuat...</div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-card w-full max-w-md p-8 rounded-3xl text-center">
          <div className="text-5xl mb-4">💬</div>

          <h1 className="text-3xl font-black gradient-text mb-3">
            Zhuu Public Chat
          </h1>

          <p className="text-sm mb-6 text-zinc-400/50">
            Login terlebih dahulu untuk bergabung dengan public chat.
          </p>

          <SignInButton mode="modal">
            <button className="bg-white text-black hover:bg-zinc-200 transition-colors px-8 py-3 rounded-full font-bold">
              Login & Join Chat
            </button>
          </SignInButton>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-3 sm:px-4 pt-5 pb-28">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-[10%] top-16 h-56 w-56 rounded-full bg-white/[0.025] blur-3xl" />
        <div className="absolute right-[8%] top-[35%] h-72 w-72 rounded-full bg-indigo-500/[0.025] blur-3xl" />
        <div className="absolute bottom-20 left-[35%] h-64 w-64 rounded-full bg-cyan-400/[0.018] blur-3xl" />
      </div>
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="relative overflow-hidden rounded-[26px] border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5 mb-4 shadow-[0_20px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.035] via-transparent to-indigo-400/[0.025]" />
          <div className="relative flex items-center gap-3">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.09] bg-white/[0.045] shadow-inner">
              <span className="text-xl">💬</span>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#090c12] bg-emerald-400" />
            </div>

            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Zhuu Public Chat
              </h1>

              <p className="text-[11px] sm:text-xs text-zinc-400/55 truncate">
                Semua user ZhuuSite bisa ngobrol di sini
              </p>
            </div>

            <div className="ml-auto hidden text-right sm:block">
              <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500/80">
                Signed in as
              </div>
              <div className="text-sm font-semibold text-zinc-100">
                {user?.firstName ||
                  user?.username ||
                  user?.primaryEmailAddress?.emailAddress ||
                  "User"}
              </div>
            </div>
          </div>
        </div>

        {/* Chat */}
        <div className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#090c12]/80 shadow-[0_25px_90px_rgba(0,0,0,0.3)] backdrop-blur-2xl">

          <div
            ref={chatScrollRef}
            className="h-[60vh] min-h-[420px] overflow-y-auto p-3.5 sm:p-6 space-y-3.5 scroll-smooth [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.08)_transparent]"
          >
            {loading ? (
              <div className="h-full flex items-center justify-center text-zinc-500/50">
                Memuat pesan...
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center px-6 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-white/[0.07] bg-white/[0.025] text-3xl shadow-inner">💬</div>
                <div className="font-semibold text-zinc-100">
                  Belum ada pesan
                </div>
                <div className="mt-1 text-sm text-zinc-500/65">
                  Jadilah orang pertama yang menyapa 👋
                </div>
              </div>
            ) : (
              messages.map((item) => {
                const mine = item.userId === user?.id;

                return (
                  <div
                    key={item.id}
                    className={`flex ${
                      mine ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`group max-w-[88%] sm:max-w-[70%] ${
                        mine
                          ? "items-end"
                          : "items-start"
                      } flex flex-col`}
                    >
                      <div className="mb-1 flex items-center gap-1.5 px-2 text-[10px] text-zinc-500/65">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt=""
                            className="h-5 w-5 rounded-full object-cover border border-white/[0.09] shadow-sm"
                          />
                        ) : (
                          <div className="h-5 w-5 rounded-full border border-white/[0.08] bg-white/[0.045]" />
                        )}
                        <span>
                          {mine ? "You" : item.username || "User"}
                        </span>
                      </div>

                      <div
                        className={`px-4 py-3.5 rounded-[20px] text-sm leading-relaxed shadow-sm transition-all duration-200 group-hover:border-white/[0.12] ${
                          mine
                            ? "bg-white/[0.08] border border-white/10 text-zinc-100 rounded-br-md"
                            : "bg-white/[0.04] border border-white/[0.07] text-zinc-100/90 rounded-bl-md"
                        }`}
                      >
                        {item.message}
                      </div>

                      <div className="mt-1 px-2 text-[9px] text-zinc-500/35">
                        {new Date(item.createdAt).toLocaleTimeString(
                          "id-ID",
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            <div aria-hidden="true" />
          </div>

          {/* Composer */}
          <div className="border-t border-white/[0.07] bg-white/[0.012] p-3 sm:p-4">
            {error && (
              <div className="mb-2 px-2 text-xs text-red-300/85">
                {error}
              </div>
            )}

            <div className="flex items-end gap-2">
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={500}
                rows={1}
                placeholder="Tulis pesan..."
                className="min-h-[46px] max-h-32 flex-1 resize-none rounded-[18px] border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-sm text-white outline-none transition-all duration-200 placeholder:text-zinc-500/50 focus:border-white/[0.16] focus:bg-white/[0.05] focus:ring-2 focus:ring-white/[0.025]"
              />

              <button
                onClick={sendMessage}
                disabled={!message.trim() || sending}
                className="flex h-[46px] shrink-0 items-center justify-center rounded-[18px] border border-white/[0.08] bg-white px-3.5 sm:px-5 font-bold text-black shadow-[0_8px_25px_rgba(255,255,255,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-zinc-100 hover:shadow-[0_10px_30px_rgba(255,255,255,0.12)] disabled:cursor-not-allowed disabled:opacity-30"
              >
                {sending ? "..." : "Kirim"}
              </button>
            </div>

            <div className="mt-2 px-2 text-[10px] text-zinc-500/40">
              Enter untuk kirim • Shift + Enter untuk baris baru
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
