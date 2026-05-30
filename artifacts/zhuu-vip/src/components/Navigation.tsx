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
  { path: "/feedback", label: "Feedback" },
  { path: "/sharecard", label: "Share Card", highlight: "cyan" },
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
          background: scrolled
            ? "rgba(1,8,18,0.97)"
            : "rgba(1,10,20,0.82)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderBottom: scrolled
            ? "1px solid rgba(0,255,255,0.12)"
            : "1px solid rgba(0,255,255,0.06)",
          boxShadow: scrolled ? "0 4px 30px rgba(0,0,0,0.5)" : "none",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
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
                className="gradient-text font-bold text-lg tracking-tight"
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
                        boxShadow: active ? "0 0 16px rgba(120,80,255,0.4)" : "none",
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
                      background: active ? "rgba(0,255,255,0.08)" : "transparent",
                      boxShadow: active ? "0 0 12px rgba(0,255,255,0.12)" : "none",
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
          <div className="flex items-center gap-3">
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
              className="lg:hidden p-2 rounded-lg transition-all duration-200"
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

        {/* Mobile menu */}
        {mobileOpen && (
          <div
            className="lg:hidden px-4 pb-5 pt-1"
            style={{
              background: "rgba(1,8,18,0.98)",
              borderBottom: "1px solid rgba(0,255,255,0.1)",
            }}
          >
            <div className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => {
                const active = isActive(item.path);
                const isAi = item.highlight === "ai";
                const isPurple = item.highlight === "purple";
                return (
                  <Link key={item.path} href={item.path}>
                    <div
                      className="px-4 py-3 rounded-xl cursor-pointer text-sm font-medium transition-all duration-150"
                      style={{
                        color: isAi
                          ? "rgba(180,130,255,0.95)"
                          : isPurple
                          ? "rgba(192,132,252,0.9)"
                          : active
                          ? "#00ffff"
                          : "rgba(0,200,220,0.65)",
                        background: active
                          ? isAi
                            ? "rgba(120,80,255,0.12)"
                            : "rgba(0,255,255,0.07)"
                          : "transparent",
                        borderLeft: active
                          ? `2px solid ${isAi ? "rgba(150,100,255,0.7)" : "rgba(0,255,255,0.5)"}`
                          : "2px solid transparent",
                      }}
                    >
                      {isAi ? "✨ " : isPurple ? "🔗 " : ""}
                      {item.label}
                    </div>
                  </Link>
                );
              })}
              {isAdmin && (
                <Link href="/admin">
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-purple-300/80 cursor-pointer transition-all hover:text-purple-300">
                    <Shield size={14} />
                    Admin Panel
                  </div>
                </Link>
              )}
              <Show when="signed-out">
                <Link href="/sign-in">
                  <div
                    className="px-4 py-3 rounded-xl text-sm font-medium cursor-pointer mt-2 text-center"
                    style={{
                      background: "rgba(0,200,220,0.1)",
                      border: "1px solid rgba(0,200,220,0.22)",
                      color: "#00e5ff",
                    }}
                  >
                    Sign In →
                  </div>
                </Link>
              </Show>
            </div>
          </div>
        )}
      </nav>
      <div className="h-16" />
    </>
  );
}
