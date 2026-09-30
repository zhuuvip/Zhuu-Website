import { Link, useLocation } from "wouter";
import { Show, UserButton, useAuth, useUser } from "@clerk/react";
import { useEffect, useState } from "react";
import {
  Bell,
  ChevronDown,
  Gauge,
  Gift,
  Home,
  Link2,
  LogIn,
  Menu,
  MessageSquare,
  MoreHorizontal,
  ShoppingBag,
  Sparkles,
  Users,
  Wrench,
  X,
} from "lucide-react";
import logoPath from "@assets/file_000000003e9c72078d0f388bef03af6a_1778462394630.png";
import VerifiedBadge from "@/components/ui/VerifiedBadge";

const API = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

const MAIN_ITEMS = [
  { path: "/", label: "Home", Icon: Home },
  { path: "/products", label: "Products", Icon: ShoppingBag },
  { path: "/free", label: "Free Hub", Icon: Gift },
  { path: "/member", label: "Member", Icon: Sparkles },
];

const MORE_ITEMS = [
  { path: "/speedtest", label: "Speed Test", Icon: Gauge },
  { path: "/tools", label: "Tools", Icon: Wrench },
  { path: "/ai", label: "Zhuu AI", Icon: Sparkles },
  { path: "/linktree", label: "Linktree", Icon: Link2 },
  { path: "/portfolio", label: "Portfolio", Icon: Users },
  { path: "/community", label: "Community", Icon: Users },
  { path: "/zhuu-chat", label: "Chat", Icon: MessageSquare },
  { path: "/promote", label: "Promotion", Icon: Gift },
  { path: "/feedback", label: "Feedback", Icon: MessageSquare },
  { path: "/sharecard", label: "Share Card", Icon: Link2 },
];

function NotificationBell({ unread }: { unread: number }) {
  return (
    <Link
      href="/notifications"
      aria-label="Notifications"
      className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.04] text-white/60 transition hover:border-white/15 hover:bg-white/[0.07] hover:text-white"
    >
      <Bell size={17} />
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-2 border-[#080b10] bg-blue-500 px-1 text-[9px] font-bold text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}

export default function Navigation() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [isReseller, setIsReseller] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const { user } = useUser();
  const { getToken } = useAuth();

  const isActive = (path: string) =>
    path === "/" ? location === "/" : location.startsWith(path);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setMoreOpen(false);
  }, [location]);

  useEffect(() => {
    let cancelled = false;

    const loadNotifications = async () => {
      if (!user) {
        setUnreadNotifications(0);
        return;
      }

      try {
        const token = await getToken();
        const res = await fetch(`${API}/api/notifications`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!res.ok) return;

        const data = await res.json();
        if (!cancelled) {
          const notifications = Array.isArray(data?.notifications)
            ? data.notifications
            : [];

          setUnreadNotifications(
            notifications.filter((item: any) => !item.read).length,
          );
        }
      } catch {
        if (!cancelled) setUnreadNotifications(0);
      }
    };

    loadNotifications();
    const timer = window.setInterval(loadNotifications, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [user, getToken]);

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setIsReseller(false);
      return;
    }

    getToken()
      .then((token) =>
        fetch(`${API}/api/reseller/plans`, {
          headers: token
            ? { Authorization: `Bearer ${token}` }
            : {},
        }),
      )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) {
          setIsReseller(Boolean(data?.member?.active));
        }
      })
      .catch(() => {
        if (!cancelled) setIsReseller(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, getToken]);

  const moreItems = [
    ...MORE_ITEMS,
    ...(isReseller
      ? [{ path: "/reseller", label: "Reseller", Icon: ShoppingBag }]
      : []),
  ];

  const desktopMoreActive = moreItems.some((item) => isActive(item.path));

  return (
    <>
      <nav
        className={`zs-nav fixed left-0 right-0 top-0 z-50 transition-all duration-300 ${
          scrolled ? "border-white/[0.07] bg-[#080b10]/95 shadow-lg" : "bg-[#080b10]/80"
        }`}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-3 sm:h-16 sm:px-4 sm:px-6">
          <Link href="/" className="shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 overflow-hidden rounded-full border border-white/15 bg-white/[0.05] sm:h-9 sm:w-9">
                <img
                  src={logoPath}
                  alt="ZhuuSite"
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[15px] font-bold tracking-tight text-white sm:text-base">
                  ZhuuSite
                </span>
                <VerifiedBadge size={15} />
              </div>
            </div>
          </Link>

          <div className="hidden items-center gap-1 lg:flex">
            {MAIN_ITEMS.map(({ path, label, Icon }) => {
              const active = isActive(path);

              return (
                <Link key={path} href={path}>
                  <span
                    className={`zs-nav-link inline-flex items-center gap-1.5 ${
                      active ? "zs-nav-link-active" : ""
                    }`}
                  >
                    <Icon size={15} />
                    {label}
                  </span>
                </Link>
              );
            })}

            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreOpen((value) => !value)}
                className={`zs-nav-link inline-flex items-center gap-1.5 ${
                  desktopMoreActive ? "zs-nav-link-active" : ""
                }`}
              >
                <MoreHorizontal size={15} />
                More
                <ChevronDown
                  size={13}
                  className={`transition-transform ${
                    moreOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {moreOpen && (
                <div className="absolute right-0 top-[calc(100%+10px)] w-56 rounded-2xl border border-white/[0.07] bg-[#0b0f15]/98 p-1.5 shadow-2xl backdrop-blur-xl">
                  {moreItems.map(({ path, label, Icon }) => (
                    <Link key={path} href={path}>
                      <span
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                          isActive(path)
                            ? "bg-white/[0.08] text-white"
                            : "text-white/55 hover:bg-white/[0.05] hover:text-white"
                        }`}
                      >
                        <Icon size={16} />
                        {label}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/reseller-login">
              <span
                title="Login Reseller"
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                  isActive("/reseller-login")
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-white/[0.07] bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"
                }`}
              >
                <LogIn size={15} />
                <span className="hidden sm:inline">Reseller</span>
              </span>
            </Link>
            <Show when="signed-in">
              <NotificationBell unread={unreadNotifications} />
              <UserButton />
            </Show>

            <Show when="signed-out">
              <Link href="/sign-in">
                <button className="hidden rounded-xl border border-white/[0.07] bg-white/[0.04] px-3.5 py-2 text-sm font-medium text-white/80 transition hover:bg-white/[0.08] hover:text-white sm:block">
                  Sign in
                </button>
              </Link>
            </Show>

            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setMobileOpen((value) => !value)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.04] text-white/70 lg:hidden"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-t border-white/[0.07] bg-[#080b10]/98 px-3 pb-4 pt-2 shadow-2xl lg:hidden">
            {[...MAIN_ITEMS, ...moreItems].map(({ path, label, Icon }) => (
              <Link key={path} href={path}>
                <span
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm ${
                    isActive(path)
                      ? "bg-white/[0.08] text-white"
                      : "text-white/60"
                  }`}
                >
                  <Icon size={17} />
                  {label}
                </span>
              </Link>
            ))}

            <Show when="signed-out">
              <Link href="/sign-in">
                <span className="mt-1 flex items-center gap-3 rounded-xl border-t border-white/[0.07] px-3 py-3 text-sm text-white/60">
                  Sign in
                </span>
              </Link>
            </Show>
          </div>
        )}
      </nav>

      <div className="h-14 sm:h-16" />

      <div className="fixed bottom-3 left-3 right-3 z-40 lg:hidden">
        <div className="flex items-center justify-around rounded-2xl border border-white/[0.07] bg-[#090c12]/95 p-1.5 shadow-2xl backdrop-blur-xl">
          {MAIN_ITEMS.map(({ path, label, Icon }) => (
            <Link key={path} href={path}>
              <span
                className={`flex min-w-[58px] flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] transition ${
                  isActive(path)
                    ? "bg-white/[0.09] text-white"
                    : "text-white/40"
                }`}
              >
                <Icon size={17} />
                {label}
              </span>
            </Link>
          ))}

          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex min-w-[58px] flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] text-white/40"
          >
            <MoreHorizontal size={17} />
            More
          </button>
        </div>
      </div>
    </>
  );
}
