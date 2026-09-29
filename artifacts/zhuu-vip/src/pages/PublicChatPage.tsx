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
        <div className="text-cyan-300">Memuat...</div>
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

          <p className="text-sm mb-6 text-cyan-100/50">
            Login terlebih dahulu untuk bergabung dengan public chat.
          </p>

          <SignInButton mode="modal">
            <button className="neon-btn-solid px-8 py-3 rounded-full font-bold">
              Login & Join Chat
            </button>
          </SignInButton>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-3 sm:px-4 pt-4 pb-28">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="glass-card rounded-3xl p-5 mb-4">
          <div className="flex items-center gap-3">
            <div className="text-3xl">💬</div>

            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-black gradient-text">
                Zhuu Public Chat
              </h1>

              <p className="text-xs text-cyan-100/40 truncate">
                Semua user ZhuuSite bisa ngobrol di sini
              </p>
            </div>

            <div className="ml-auto text-right hidden sm:block">
              <div className="text-xs text-cyan-100/40">
                Signed in as
              </div>
              <div className="text-sm font-semibold text-cyan-200">
                {user?.firstName ||
                  user?.username ||
                  user?.primaryEmailAddress?.emailAddress ||
                  "User"}
              </div>
            </div>
          </div>
        </div>

        {/* Chat */}
        <div className="glass-card rounded-3xl overflow-hidden">

          <div
            ref={chatScrollRef}
            className="h-[60vh] min-h-[420px] overflow-y-auto p-4 sm:p-6 space-y-3"
          >
            {loading ? (
              <div className="h-full flex items-center justify-center text-cyan-200/40">
                Memuat pesan...
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="text-5xl mb-3">🌊</div>
                <div className="font-bold text-cyan-100/70">
                  Belum ada pesan
                </div>
                <div className="text-sm text-cyan-100/30 mt-1">
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
                      className={`max-w-[85%] sm:max-w-[70%] ${
                        mine
                          ? "items-end"
                          : "items-start"
                      } flex flex-col`}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] text-cyan-100/40 mb-1 px-2">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt=""
                            className="w-4 h-4 rounded-full object-cover border border-white/10"
                          />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-cyan-400/10 border border-cyan-300/10" />
                        )}
                        <span>
                          {mine ? "You" : item.username || "User"}
                        </span>
                      </div>

                      <div
                        className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                          mine
                            ? "bg-cyan-400/15 border border-cyan-300/20 text-cyan-50 rounded-br-md"
                            : "bg-white/[0.04] border border-white/[0.07] text-cyan-50/90 rounded-bl-md"
                        }`}
                      >
                        {item.message}
                      </div>

                      <div className="text-[9px] text-cyan-100/20 mt-1 px-2">
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
          <div className="border-t border-white/[0.06] p-3 sm:p-4">
            {error && (
              <div className="text-xs text-red-300/80 mb-2 px-2">
                {error}
              </div>
            )}

            <div className="flex gap-2 items-end">
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={500}
                rows={1}
                placeholder="Tulis pesan..."
                className="flex-1 resize-none rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/30 placeholder:text-cyan-100/25"
              />

              <button
                onClick={sendMessage}
                disabled={!message.trim() || sending}
                className="neon-btn-solid px-5 py-3 rounded-2xl font-bold disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {sending ? "..." : "Kirim"}
              </button>
            </div>

            <div className="text-[10px] text-cyan-100/20 mt-2 px-2">
              Enter untuk kirim • Shift + Enter untuk baris baru
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
