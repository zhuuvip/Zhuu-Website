import { useAuth } from "@clerk/react";
import { Bell, CheckCheck, MessageSquare, ShoppingBag, Gift, Wallet, Info, RefreshCw, Smartphone } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const API = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

type NotificationItem = {
  id: number;
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  read: boolean;
  createdAt: string;
};

function iconFor(type: string) {
  switch (type) {
    case "chat":
      return MessageSquare;
    case "products":
      return ShoppingBag;
    case "free":
      return Gift;
    case "wallet":
      return Wallet;
    case "orders":
      return ShoppingBag;
    case "updates":
      return RefreshCw;
    default:
      return Info;
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificationsPage() {
  const { getToken } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API}/api/notifications`, {
        headers: token
          ? { Authorization: `Bearer ${token}` }
          : {},
      });

      if (!res.ok) return;

      const data = await res.json();
      setItems(Array.isArray(data?.notifications) ? data.notifications : []);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (item: NotificationItem) => {
    if (item.read) {
      if (item.link) window.location.href = item.link;
      return;
    }

    const token = await getToken();

    await fetch(`${API}/api/notifications/${item.id}/read`, {
      method: "PATCH",
      headers: token
        ? { Authorization: `Bearer ${token}` }
        : {},
    });

    setItems((current) =>
      current.map((notification) =>
        notification.id === item.id
          ? { ...notification, read: true }
          : notification,
      ),
    );

    if (item.link) window.location.href = item.link;
  };

  const markAllRead = async () => {
    const token = await getToken();

    await fetch(`${API}/api/notifications/read-all`, {
      method: "POST",
      headers: token
        ? { Authorization: `Bearer ${token}` }
        : {},
    });

    setItems((current) =>
      current.map((notification) => ({
        ...notification,
        read: true,
      })),
    );
  };

  const unread = items.filter((item) => !item.read).length;

  useEffect(() => {
    const checkPush = async () => {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        return;
      }

      setPushSupported(true);

      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          setPushEnabled(true);
        }
      } catch (error) {
        console.error("Push setup check error:", error);
      }
    };

    checkPush();
  }, []);

  const enablePush = async () => {
    if (!pushSupported || pushLoading) return;

    setPushLoading(true);

    try {
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

      if (!publicKey) {
        throw new Error("VITE_VAPID_PUBLIC_KEY belum diatur");
      }

      const padding = "=".repeat((4 - (publicKey.length % 4)) % 4);
      const base64 = (publicKey + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");

      const raw = window.atob(base64);
      const applicationServerKey = Uint8Array.from(
        [...raw].map((char) => char.charCodeAt(0)),
      );

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      const token = await getToken();

      const res = await fetch(`${API}/api/notifications/push/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
        }),
      });

      if (!res.ok) {
        throw new Error("Gagal menyimpan subscription");
      }

      setPushEnabled(true);
    } catch (error) {
      console.error("Push notification error:", error);
      window.alert(
        error instanceof Error
          ? error.message
          : "Gagal mengaktifkan notifikasi",
      );
    } finally {
      setPushLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-3 sm:px-4 pt-4 pb-28">
      <div className="max-w-3xl mx-auto">
          {pushSupported && (
            <div className="glass-card rounded-2xl p-4 mb-4 flex items-center gap-3">
              <div className="w-10 h-10 shrink-0 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-zinc-200" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-zinc-100">
                  {pushEnabled
                    ? "Notifikasi HP aktif"
                    : "Aktifkan notifikasi HP"}
                </p>
                <p className="text-xs text-zinc-400/40 mt-0.5">
                  {pushEnabled
                    ? "ZHUU bisa mengirim notifikasi langsung ke perangkat kamu."
                    : "Terima notifikasi meskipun website sedang tidak dibuka."}
                </p>
              </div>

              {!pushEnabled && (
                <button
                  onClick={enablePush}
                  disabled={pushLoading}
                  className="shrink-0 rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-50"
                >
                  {pushLoading ? "Memproses..." : "Aktifkan"}
                </button>
              )}
            </div>
          )}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <Bell className="w-6 h-6 text-zinc-200" />
              <h1 className="text-2xl sm:text-3xl font-black gradient-text">
                Notifications
              </h1>
            </div>
            <p className="text-sm text-zinc-400/40 mt-1">
              Semua aktivitas penting dari akun ZHUU kamu.
            </p>
          </div>

          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold text-zinc-200 hover:bg-white/5"
            >
              <CheckCheck className="w-4 h-4" />
              Tandai semua
            </button>
          )}
        </div>

        <div className="glass-card rounded-3xl overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-sm text-zinc-400/40">
              Memuat notifikasi...
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center">
              <Bell className="w-10 h-10 mx-auto text-zinc-400/20 mb-3" />
              <p className="font-bold text-zinc-200">
                Belum ada notifikasi
              </p>
              <p className="text-xs text-zinc-400/30 mt-1">
                Notifikasi baru akan muncul di sini.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {items.map((item) => {
                const Icon = iconFor(item.type);

                return (
                  <button
                    key={item.id}
                    onClick={() => markRead(item)}
                    className={`w-full text-left p-4 sm:p-5 flex gap-3 transition ${
                      item.read
                        ? "bg-transparent"
                        : "bg-white/[0.03]"
                    } hover:bg-white/[0.035]`}
                  >
                    <div className="w-10 h-10 shrink-0 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-zinc-200" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <h2
                          className={`text-sm ${
                            item.read
                              ? "font-semibold text-zinc-400"
                              : "font-black text-zinc-100"
                          }`}
                        >
                          {item.title}
                        </h2>

                        {!item.read && (
                          <span className="w-2 h-2 shrink-0 rounded-full bg-white mt-1.5" />
                        )}
                      </div>

                      <p className="text-xs sm:text-sm text-zinc-400/50 mt-1 leading-relaxed">
                        {item.message}
                      </p>

                      <span className="text-[10px] text-zinc-400/30 mt-2 block">
                        {formatDate(item.createdAt)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
