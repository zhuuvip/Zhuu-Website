import { Link } from "wouter";
import { BadgeCheck } from "lucide-react";
import { SiGithub, SiX, SiDiscord, SiYoutube } from "react-icons/si";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Zhuu AI", href: "/ai" },
  { label: "Speed Test", href: "/speedtest" },
  { label: "Linktree", href: "/linktree" },
  { label: "Community", href: "/community" },
  { label: "Tools", href: "/tools" },
  { label: "Resources", href: "/resources" },
  { label: "Feedback", href: "/feedback" },
  { label: "Testimoni", href: "/testimoni" },
];

const SOCIAL = [
  { icon: SiDiscord, href: "https://discord.gg/zhuu", label: "Discord" },
  { icon: SiYoutube, href: "https://youtube.com/@zhuuvip", label: "YouTube" },
  { icon: SiX, href: "https://twitter.com/zhuuvip", label: "X / Twitter" },
  { icon: SiGithub, href: "https://github.com/zhuuvip", label: "GitHub" },
];

export default function Footer() {
  return (
    <footer
      className="border-t pb-10 pt-12 mt-4"
      style={{ borderColor: "rgba(255,255,255,0.08)" }}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row items-start justify-between gap-10 mb-10">
          {/* Brand */}
          <div className="flex-shrink-0">
            <Link href="/">
              <div className="flex items-center gap-2.5 mb-3 cursor-pointer group">
                <BadgeCheck size={18} className="text-blue-400 transition-transform duration-200 group-hover:scale-105" />
                <span
                  className="font-black text-lg gradient-text"
                  style={{ fontFamily: "Poppins, Inter, sans-serif" }}
                >
                  ZhuuSite
                </span>
              </div>
            </Link>
            <p
              className="text-xs leading-relaxed max-w-[220px] mb-5"
              style={{ color: "rgba(255,255,255,0.38)" }}
            >
              Platform digital untuk produk, tools, AI, komunitas, dan berbagai kebutuhan lainnya.
            </p>
            {/* Social icons */}
            <div className="flex items-center gap-3">
              {SOCIAL.map(({ icon: Icon, href, label }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="transition-all duration-200 hover:scale-110"
                  style={{ color: "rgba(255,255,255,0.32)" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = "rgba(255,255,255,0.9)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = "rgba(255,255,255,0.32)")
                  }
                >
                  <Icon size={15} />
                </a>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-4"
              style={{ color: "rgba(255,255,255,0.32)" }}
            >
              Navigate
            </p>
            <div className="grid grid-cols-2 gap-x-10 gap-y-2.5">
              {NAV_LINKS.map((item) => (
                <Link key={item.href} href={item.href}>
                  <span
                    className="text-xs font-medium cursor-pointer transition-colors duration-200"
                    style={{ color: "rgba(255,255,255,0.42)" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = "rgba(255,255,255,0.9)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = "rgba(255,255,255,0.42)")
                    }
                  >
                    {item.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="section-divider mb-6" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p
            className="text-xs text-center sm:text-left"
            style={{ color: "rgba(255,255,255,0.22)" }}
          >
            © 2026 ZhuuSite · All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
              Powered by Gemini AI
            </span>
            <div className="flex items-center gap-1.5">
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "#4ade80",
                  display: "inline-block",
                  boxShadow: "0 0 5px rgba(74,222,128,0.7)",
                }}
              />
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.28)" }}>
                Online
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
