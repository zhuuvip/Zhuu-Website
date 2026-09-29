import { useAuth } from "@clerk/react";
import { Bell, CheckCheck, MessageSquare, ShoppingBag, Gift, Wallet, Info, RefreshCw } from "lucide-react";
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

  return (
    <div className="min-h-screen px-3 sm:px-4 pt-4 pb-28">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <Bell className="w-6 h-6 text-cyan-300" />
              <h1 className="text-2xl sm:text-3xl font-black gradient-text">
                Notifications
              </h1>
            </div>
            <p className="text-sm text-cyan-100/40 mt-1">
              Semua aktivitas penting dari akun ZHUU kamu.
            </p>
          </div>

          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-cyan-300/15 bg-cyan-300/5 px-3 py-2 text-xs font-bold text-cyan-100 hover:bg-cyan-300/10"
            >
              <CheckCheck className="w-4 h-4" />
              Tandai semua
            </button>
          )}
        </div>

        <div className="glass-card rounded-3xl overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-sm text-cyan-100/40">
              Memuat notifikasi...
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center">
              <Bell className="w-10 h-10 mx-auto text-cyan-100/20 mb-3" />
              <p className="font-bold text-cyan-100/70">
                Belum ada notifikasi
              </p>
              <p className="text-xs text-cyan-100/30 mt-1">
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
                        : "bg-cyan-300/[0.045]"
                    } hover:bg-white/[0.035]`}
                  >
                    <div className="w-10 h-10 shrink-0 rounded-2xl bg-cyan-300/10 border border-cyan-300/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-cyan-300" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <h2
                          className={`text-sm ${
                            item.read
                              ? "font-semibold text-cyan-100/65"
                              : "font-black text-cyan-50"
                          }`}
                        >
                          {item.title}
                        </h2>

                        {!item.read && (
                          <span className="w-2 h-2 shrink-0 rounded-full bg-cyan-300 mt-1.5" />
                        )}
                      </div>

                      <p className="text-xs sm:text-sm text-cyan-100/45 mt-1 leading-relaxed">
                        {item.message}
                      </p>

                      <span className="text-[10px] text-cyan-100/25 mt-2 block">
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
