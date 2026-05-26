import { useListLinks } from "@workspace/api-client-react";
import { ExternalLink, Waves, Loader2, Heart, Wrench } from "lucide-react";
import {
  SiDiscord, SiYoutube, SiTiktok, SiInstagram, SiTwitch, SiX,
  SiGithub, SiSpotify, SiPatreon, SiReddit, SiWhatsapp,
} from "react-icons/si";
import logoPath from "@assets/file_000000003e9c72078d0f388bef03af6a_1778462394630.png";
import { useState, useEffect } from "react";

const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  SiDiscord, SiYoutube, SiTiktok, SiInstagram, SiTwitch, SiX,
  SiGithub, SiSpotify, SiPatreon, SiReddit, SiWhatsapp,
  SiHeart: Heart as React.ComponentType<{ size?: number; className?: string }>,
  SiWrench: Wrench as React.ComponentType<{ size?: number; className?: string }>,
};

const colorMap: Record<string, string> = {
  SiDiscord:   "from-indigo-500 to-indigo-700",
  SiYoutube:   "from-red-500 to-red-700",
  SiTiktok:    "from-slate-700 to-slate-900",
  SiInstagram: "from-pink-500 via-purple-500 to-orange-400",
  SiTwitch:    "from-purple-500 to-purple-700",
  SiX:         "from-slate-600 to-slate-900",
  SiGithub:    "from-gray-600 to-gray-900",
  SiSpotify:   "from-green-500 to-green-700",
  SiPatreon:   "from-orange-500 to-orange-700",
  SiReddit:    "from-orange-600 to-orange-700",
  SiWhatsapp:  "from-green-400 to-green-600",
  SiHeart:     "from-pink-500 to-rose-600",
  SiWrench:    "from-cyan-500 to-blue-600",
};

function stripEmoji(title: string): string {
  return title.replace(/^[\p{Emoji}\s]+/u, "").trim();
}

interface SiteSettings {
  profileName?: string;
  profileBio?: string;
  logoUrl?: string;
  bannerUrl?: string;
  themeColor?: string;
  statusText?: string;
}

const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export default function LinktreePage() {
  const { data: links = [], isLoading } = useListLinks();
  const activeLinks = links.filter((l) => l.isActive);

  const [settings, setSettings] = useState<SiteSettings>({});

  useEffect(() => {
    fetch(`${API_BASE}/api/settings`)
      .then((r) => r.json())
      .then((data) => setSettings(data))
      .catch(() => {});
  }, []);

  const accentColor = settings.themeColor || "#00d4ff";
  const logoUrl = settings.logoUrl || logoPath;
  const profileName = settings.profileName || "Zhuu";
  const profileBio = settings.profileBio || "Creator · Gamer · Builder";
  const statusText = settings.statusText || "Active — Deep ocean online";

  return (
    <div
      className="ocean-bg min-h-screen flex flex-col items-center px-4 pt-8 pb-24 relative"
      style={settings.bannerUrl ? {
        backgroundImage: `linear-gradient(to bottom, rgba(1,10,15,0.85) 0%, rgba(2,15,26,0.9) 100%), url(${settings.bannerUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      } : undefined}
    >
      {/* Profile section */}
      <div className="flex flex-col items-center mb-10 text-center">
        <div className="relative mb-4 animate-float">
          <div
            style={{
              width: 104, height: 104, borderRadius: "50%", overflow: "hidden",
              border: `3px solid ${accentColor}80`,
              boxShadow: `0 0 25px ${accentColor}55, 0 0 50px ${accentColor}25`,
              transition: "all 0.3s ease",
            }}
          >
            <img
              src={logoUrl}
              alt={profileName}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => { (e.target as HTMLImageElement).src = logoPath; }}
            />
          </div>
          <div
            style={{
              position: "absolute", bottom: 0, right: 0,
              width: 30, height: 30, borderRadius: "50%",
              background: `linear-gradient(135deg, ${accentColor}, #9b59b6)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 0 10px ${accentColor}80`,
              border: "2px solid rgba(1,10,20,0.8)",
            }}
          >
            <Waves size={13} color="white" />
          </div>
        </div>

        <h1
          className="text-3xl font-black mb-1"
          style={{
            fontFamily: "'Orbitron', sans-serif",
            background: `linear-gradient(135deg, ${accentColor} 0%, #9b59b6 50%, ${accentColor} 100%)`,
            backgroundSize: "200% 200%",
            animation: "ocean-shimmer 4s ease infinite",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
          data-testid="linktree-title"
        >
          {profileName}
        </h1>
        <p style={{ color: `${accentColor}80`, fontSize: 14 }}>{profileBio}</p>

        <div
          className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{ background: `${accentColor}12`, border: `1px solid ${accentColor}25` }}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ade80", display: "inline-block", boxShadow: "0 0 6px rgba(74,222,128,0.8)", flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: `${accentColor}b0`, fontWeight: 500 }}>{statusText}</span>
        </div>
      </div>

      {/* Links */}
      <div className="w-full max-w-md flex flex-col gap-3" data-testid="links-list">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin" style={{ color: accentColor }} />
          </div>
        ) : activeLinks.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 text-center text-blue-300/40 text-sm">
            No links configured yet.
          </div>
        ) : (
          activeLinks.map((link) => {
            const IconComponent = link.icon ? iconMap[link.icon] : null;
            const gradient = link.icon ? (colorMap[link.icon] || "from-cyan-500 to-blue-600") : "from-cyan-500 to-blue-600";
            const displayTitle = stripEmoji(link.title);
            const emoji = link.title.match(/^([\p{Emoji}]+)/u)?.[1] ?? null;

            return (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                data-testid={`link-item-${link.id}`}
                style={{ textDecoration: "none" }}
              >
                <div
                  className="glass-card rounded-2xl px-5 py-4 flex items-center gap-4 cursor-pointer group"
                  style={{ transition: "all 0.25s ease" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = `${accentColor}50`;
                    (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 32px ${accentColor}20, 0 0 60px ${accentColor}10`;
                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = "";
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "";
                    (e.currentTarget as HTMLDivElement).style.transform = "";
                  }}
                >
                  {/* Icon */}
                  <div
                    style={{
                      width: 48, height: 48, borderRadius: 13, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
                    }}
                    className={`bg-gradient-to-br ${gradient}`}
                  >
                    {link.imageUrl ? (
                      <img src={link.imageUrl} alt={link.title} style={{ width: 28, height: 28, objectFit: "contain" }} />
                    ) : IconComponent ? (
                      <IconComponent size={21} className="text-white" />
                    ) : emoji ? (
                      <span style={{ fontSize: 22 }}>{emoji}</span>
                    ) : (
                      <ExternalLink size={19} className="text-white" />
                    )}
                  </div>

                  {/* Title */}
                  <span
                    className="flex-1 font-semibold"
                    style={{ color: "rgba(200,240,255,0.9)", fontSize: 15 }}
                  >
                    {displayTitle || link.title}
                  </span>

                  {/* Arrow */}
                  <ExternalLink
                    size={15}
                    style={{ color: `${accentColor}50`, flexShrink: 0, transition: "color 0.2s" }}
                    className="group-hover:!text-cyan-300"
                  />
                </div>
              </a>
            );
          })
        )}
      </div>

      <p className="mt-12 text-blue-300/20 text-xs">
        ZhuuVIP · All links are official
      </p>
    </div>
  );
}
