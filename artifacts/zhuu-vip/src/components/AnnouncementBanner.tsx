import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";

const API_BASE = (
  import.meta.env.VITE_API_URL || "https://zhuuapi.vercel.app"
).replace(/\/$/, "");

export default function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<any>(null);
  const [dismissed, setDismissed] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/announcements`, {
      cache: "no-store",
    })
      .then(r => r.json())
      .then(data => data && setAnnouncement(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const banner = bannerRef.current;

    if (!banner || !announcement || dismissed) {
      document.documentElement.style.removeProperty("--announcement-height");
      return;
    }

    const updateHeight = () => {
      document.documentElement.style.setProperty(
        "--announcement-height",
        `${banner.offsetHeight}px`
      );
    };

    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(banner);

    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--announcement-height");
    };
  }, [announcement, dismissed]);

  if (!announcement || dismissed) return null;

  return (
    <div
      ref={bannerRef}
      className="w-full px-4 py-2 flex items-center justify-between gap-3 text-sm font-medium"
      style={{
        background: announcement.color + "22",
        borderBottom: `1px solid ${announcement.color}44`,
        color: announcement.color,
      }}
    >
      <div className="flex items-center gap-2 flex-1 justify-center">
        <span>📢</span>
        <span>{announcement.message}</span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Close announcement" className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg hover:opacity-70 transition-opacity"
      >
        <X size={16} />
      </button>
    </div>
  );
}
