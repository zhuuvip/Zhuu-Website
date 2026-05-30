import { useState, useEffect } from "react";
import { X } from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export default function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<any>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/announcements`)
      .then(r => r.json())
      .then(data => data && setAnnouncement(data))
      .catch(() => {});
  }, []);

  if (!announcement || dismissed) return null;

  return (
    <div
      className="w-full px-4 py-3 flex items-center justify-between gap-3 text-sm font-medium"
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
        className="flex-shrink-0 hover:opacity-70 transition-opacity"
      >
        <X size={16} />
      </button>
    </div>
  );
}
