import { Link, useLocation } from "wouter";
import { Show, UserButton, useUser } from "@clerk/react";
import { useState, useEffect } from "react";
import { Menu, X, Shield, LogIn } from "lucide-react";
import logoPath from "@assets/file_000000003e9c72078d0f388bef03af6a_1778462394630.png";

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || "zhuusite@gmail.com";

const NAV_ITEMS = [
  { path: "/", label: "Home" },
  { path: "/speedtest", label: "Speed" },
  { path: "/tools", label: "Tools" },
  { path: "/ai", label: "Zhuu AI", highlight: "ai" },
  { path: "/linktree", label: "Linktree", highlight: "purple" },
  { path: "/portfolio", label: "Portfolio" },
  { path: "/community", label: "Community" },
  { path: "/member", label: "Member", highlight: "cyan" },
  { path: "/feedback", label: "Feedback" },
  { path: "/sharecard", label: "Share Card", highlight: "cyan" },
  { path: "/products", label: "🛒 Products", highlight: "cyan" },
];

export default function Navigation() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user } = useUser();

  const userEmail = user?.primaryEmailAddress?.emailAddress;
  const externalEmail = user?.externalAccounts?.[0]?.emailAddress;
  const isAdmin = userEmail === ADMIN_EMAIL || externalEmail === ADMIN_EMAIL;

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (mobileOpen) setMobileOpen(false);
  }, [location]);

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? "rgba(1,8,18,0.97)" : "rgba(1,10,20,0.82)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderBottom: scrolled
            ? "1px solid rgba(0,255,255,0.12)"
            : "1px solid rgba(0,255,255,0.06)",
          boxShadow: scrolled ? "0 4px 30px rgba(0,0,0,0.5)" : "none",
        }}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 flex items-center justify-between h-14 sm:h-16">
          {/* Logo */}
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer group">
              <div
                className="transition-all duration-300 group-hover:scale-105"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: "2px solid rgba(0,255,255,0.5)",
                  boxShadow: "0 0 14px rgba(0,255,255,0.25)",
                }}
              >
                <img
                  src={logoPath}
                  alt="ZhuuVIP"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
              <span
                className="gradient-text font-bold text-base sm:text-lg tracking-tight"
                style={{ fontFamily: "Poppins, Inter, sans-serif" }}
              >
                ZhuuVIP
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-0.5">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.path);
              if (item.highlight === "ai") {
                return (
                  <Link key={item.path} href={item.path}>
                    <button
                      className="ml-2 px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 hover:scale-105 hover:shadow-lg"
                      style={{
                        background: active
                          ? "linear-gradient(135deg, rgba(120,80,255,0.95), rgba(0,150,255,0.95))"
                          : "linear-gradient(135deg, rgba(120,80,255,0.75), rgba(0,150,255,0.75))",
                        border: "1px solid rgba(150,100,255,0.5)",
                        color: "white",
                        boxShadow: active
                          ? "0 0 16px rgba(120,80,255,0.4)"
                          : "none",
                      }}
                    >
                      ✨ {item.label}
                    </button>
                  </Link>
                );
              }
              if (item.highlight === "purple") {
                return (
                  <Link key={item.path} href={item.path}>
                    <button
                      className="ml-1 px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200"
                      style={{
                        background: active
                          ? "rgba(120,60,200,0.28)"
                          : "rgba(120,60,200,0.08)",
                        border: "1px solid rgba(150,80,255,0.35)",
                        color: active ? "#d8b4fe" : "#c084fc",
                        cursor: "pointer",
                      }}
                    >
                      🔗 {item.label}
                    </button>
                  </Link>
                );
              }
              return (
                <Link key={item.path} href={item.path}>
                  <div
                    className="px-3 py-1.5 rounded-full text-sm font-medium cursor-pointer transition-all duration-200 hover:text-cyan-300"
                    style={{
                      color: active ? "#00ffff" : "rgba(0,200,220,0.55)",
                      background: active
                        ? "rgba(0,255,255,0.08)"
                        : "transparent",
                      boxShadow: active
                        ? "0 0 12px rgba(0,255,255,0.12)"
                        : "none",
                    }}
                  >
                    {item.label}
                  </div>
                </Link>
              );
            })}
            {isAdmin && (
              <Link href="/admin">
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium cursor-pointer transition-all ml-1 ${
                    isActive("/admin")
                      ? "bg-purple-400/15 text-purple-300"
                      : "text-purple-300/55 hover:text-purple-300 hover:bg-purple-400/8"
                  }`}
                >
                  <Shield size={13} />
                  Admin
                </div>
              </Link>
            )}
          </div>

          {/* Auth + Mobile toggle */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <Show when="signed-in">
              <UserButton
                appearance={{
                  elements: {
                    avatarBox:
                      "w-8 h-8 ring-1 ring-cyan-400/40 hover:ring-cyan-400/80 transition-all rounded-full",
                  },
                }}
              />
            </Show>
            <Show when="signed-out">
              <Link href="/sign-in">
                <button className="hidden sm:flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-cyan-400/10 border border-cyan-400/25 text-cyan-300 text-sm font-medium hover:bg-cyan-400/18 hover:border-cyan-400/45 transition-all cursor-pointer">
                  <LogIn size={14} />
                  Sign In
                </button>
              </Link>
            </Show>
            <button
              className="hidden lg:hidden p-2 rounded-lg transition-all duration-200"
              style={{
                background: mobileOpen
                  ? "rgba(0,255,255,0.1)"
                  : "rgba(0,255,255,0.05)",
                border: "1px solid rgba(0,255,255,0.15)",
              }}
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle mobile menu"
            >
              {mobileOpen ? (
                <X size={20} style={{ color: "rgba(0,220,240,0.9)" }} />
              ) : (
                <Menu size={20} style={{ color: "rgba(0,220,240,0.75)" }} />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile horizontal bottom navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)]">
        <div
          className="w-full overflow-x-auto overscroll-x-contain"
          style={{
            scrollbarWidth: "none",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div className="flex min-w-max items-center gap-1 px-2 py-2 bg-[#010812]/95 backdrop-blur-xl border-t border-cyan-400/10 shadow-[0_-8px_30px_rgba(0,0,0,0.35)]">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.path);

              return (
                <Link key={item.path} href={item.path}>
                  <div
                    className="flex-shrink-0 min-w-[68px] h-12 px-3 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all active:scale-95"
                    style={{
                      color: active ? "#00ffff" : "rgba(150,210,230,0.65)",
                      background: active
                        ? "rgba(0,255,255,0.09)"
                        : "transparent",
                    }}
                  >
                    <span className="text-xs whitespace-nowrap">
                      {item.highlight === "ai"
                        ? "✨ "
                        : item.highlight === "purple"
                          ? "🔗 "
                          : ""}
                      {item.label}
                    </span>
                  </div>
                </Link>
              );
            })}

            {isAdmin && (
              <Link href="/admin">
                <div
                  className="flex-shrink-0 min-w-[68px] h-12 px-3 rounded-xl flex flex-col items-center justify-center cursor-pointer"
                  style={{
                    color: isActive("/admin")
                      ? "#d8b4fe"
                      : "rgba(192,132,252,0.65)",
                    background: isActive("/admin")
                      ? "rgba(168,85,247,0.1)"
                      : "transparent",
                  }}
                >
                  <span className="text-xs whitespace-nowrap">🛡️ Admin</span>
                </div>
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="h-16 lg:h-0" />
    </>
  );
}
