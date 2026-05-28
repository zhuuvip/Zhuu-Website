import { useState, useEffect, useRef } from "react";
import { useUser, useAuth } from "@clerk/react";
import { Link } from "wouter";
import {
  useListLinks,
  useCreateLink,
  useUpdateLink,
  useDeleteLink,
  useListSongs,
  getListLinksQueryKey,
  getListSongsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Shield, Plus, Trash2, Edit2, Save, X, Link2, Music,
  Loader2, ChevronLeft, ToggleLeft, ToggleRight, Eye, EyeOff,
  MessageSquare, BarChart3, Star, Users, Bot, RefreshCw,
  Settings, Image as ImageIcon, Palette, Upload, CheckCircle2,
  GripVertical, ExternalLink,
} from "lucide-react";

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || "zhuusite@gmail.com";
const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

const RATING_EMOJIS = ["😕", "😐", "🙂", "😊", "🤩"];
const CATEGORY_COLORS: Record<string, string> = {
  bug: "#f87171", feature: "#00d4ff", design: "#a78bfa",
  performance: "#fbbf24", content: "#4ade80", other: "#94a3b8",
};

interface LinkForm {
  title: string; url: string; icon: string; sortOrder: number; isActive: boolean;
}

interface SongForm {
  title: string; artist: string; url: string; coverUrl: string; sortOrder: number;
}

interface FeedbackItem {
  id: number; category: string | null; rating: number | null;
  name: string | null; email: string | null; message: string; createdAt: string;
}

interface Stats {
  links: number; songs: number; feedback: number; conversations: number; messages: number; visitors?: number;
}

interface SiteSettings {
  profileName?: string; profileBio?: string; logoUrl?: string;
  bannerUrl?: string; themeColor?: string; statusText?: string;
}

type Tab = "stats" | "links" | "songs" | "settings" | "feedback";

const iconOptions = ["SiDiscord","SiYoutube","SiTiktok","SiInstagram","SiTwitch","SiX","SiGithub","SiSpotify","SiPatreon","SiReddit","SiWhatsapp"];

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="glass-card rounded-2xl p-5 hover:border-cyan-400/30 transition-all">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-blue-300/50 uppercase tracking-wider">{label}</span>
        <div style={{ color, opacity: 0.7 }}>{icon}</div>
      </div>
      <div className="text-3xl font-black" style={{ color, fontFamily: "Poppins, Inter, sans-serif" }}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const email = user?.primaryEmailAddress?.emailAddress;
  const externalEmail = user?.externalAccounts?.[0]?.emailAddress;
  const isAdmin = email === ADMIN_EMAIL || externalEmail === ADMIN_EMAIL;

  const { data: links = [], isLoading: linksLoading } = useListLinks();
  const { data: songs = [], isLoading: songsLoading } = useListSongs();
  const createLink = useCreateLink();
  const updateLink = useUpdateLink();
  const deleteLink = useDeleteLink();

  const [tab, setTab] = useState<Tab>("stats");

  // Link form state
  const [editingLinkId, setEditingLinkId] = useState<number | null>(null);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkForm, setLinkForm] = useState<LinkForm>({ title: "", url: "", icon: "", sortOrder: 0, isActive: true });

  // Song form state
  const [showSongForm, setShowSongForm] = useState(false);
  const [editingSongId, setEditingSongId] = useState<number | null>(null);
  const [songForm, setSongForm] = useState<SongForm>({ title: "", artist: "", url: "", coverUrl: "", sortOrder: 0 });
  const [songSaving, setSongSaving] = useState(false);
  const [deletingSongId, setDeletingSongId] = useState<number | null>(null);

  // Settings state
  const [settings, setSettings] = useState<SiteSettings>({});
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Feedback state
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [deletingFeedbackId, setDeletingFeedbackId] = useState<number | null>(null);

  // Stats state
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const authHeaders = async () => {
    const token = await getToken();
    console.log("DEBUG token:", token, "API_BASE:", API_BASE);
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/stats`, { headers: await authHeaders() });
      const visRes = await fetch(`${API_BASE}/api/visitors`);
      const visData = await visRes.json();
      if (res.ok) const statsData = await res.json(); setStats({ ...statsData, visitors: visData.count ?? 0 });
    } catch {}
    setStatsLoading(false);
  };

  const fetchFeedback = async () => {
    setFeedbackLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/feedback`, { headers: await authHeaders() });
      if (res.ok) setFeedback(await res.json());
    } catch {}
    setFeedbackLoading(false);
  };

  const fetchSettings = async () => {
    setSettingsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/settings`);
      if (res.ok) setSettings(await res.json());
    } catch {}
    setSettingsLoading(false);
  };

  const saveSettings = async () => {
    setSettingsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/settings`, {
        method: "PUT",
        headers: await authHeaders(),
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSettings(await res.json());
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 2500);
      }
    } catch {}
    setSettingsSaving(false);
  };

  useEffect(() => {
    if (!isAdmin || !user) return;
    if (tab === "stats") fetchStats();
    if (tab === "feedback") fetchFeedback();
    if (tab === "settings") fetchSettings();
  }, [tab, isAdmin, user]);

  // Song actions
  const handleSaveSong = async () => {
    if (!songForm.title || !songForm.artist || !songForm.url) return;
    setSongSaving(true);
    try {
      const method = editingSongId !== null ? "PATCH" : "POST";
      const url = editingSongId !== null ? `${API_BASE}/api/songs/${editingSongId}` : `${API_BASE}/api/songs`;
      const res = await fetch(url, {
        method,
        headers: await authHeaders(),
        body: JSON.stringify({
          title: songForm.title,
          artist: songForm.artist,
          url: songForm.url,
          coverUrl: songForm.coverUrl || null,
          sortOrder: songForm.sortOrder,
        }),
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: getListSongsQueryKey() });
        resetSongForm();
      }
    } catch {}
    setSongSaving(false);
  };

  const handleDeleteSong = async (id: number) => {
    if (!confirm("Delete this song?")) return;
    setDeletingSongId(id);
    try {
      await fetch(`${API_BASE}/api/songs/${id}`, { method: "DELETE", headers: await authHeaders() });
      queryClient.invalidateQueries({ queryKey: getListSongsQueryKey() });
    } catch {}
    setDeletingSongId(null);
  };

  const startEditSong = (song: typeof songs[0]) => {
    setEditingSongId(song.id);
    setSongForm({ title: song.title, artist: song.artist, url: song.url, coverUrl: song.coverUrl ?? "", sortOrder: song.sortOrder });
    setShowSongForm(true);
  };

  const resetSongForm = () => {
    setEditingSongId(null); setShowSongForm(false);
    setSongForm({ title: "", artist: "", url: "", coverUrl: "", sortOrder: 0 });
  };

  // Link actions
  const handleSaveLink = async () => {
    if (!linkForm.title || !linkForm.url) return;
    try {
      if (editingLinkId !== null) {
        await updateLink.mutateAsync({ id: editingLinkId, data: { title: linkForm.title, url: linkForm.url, icon: linkForm.icon || null, sortOrder: linkForm.sortOrder, isActive: linkForm.isActive } });
      } else {
        await createLink.mutateAsync({ data: { title: linkForm.title, url: linkForm.url, icon: linkForm.icon || undefined, sortOrder: linkForm.sortOrder } });
      }
      queryClient.invalidateQueries({ queryKey: getListLinksQueryKey() });
      resetLinkForm();
    } catch (e) { console.error(e); }
  };

  const handleDeleteLink = async (id: number) => {
    if (!confirm("Delete this link?")) return;
    await deleteLink.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListLinksQueryKey() });
  };

  const handleDeleteFeedback = async (id: number) => {
    if (!confirm("Delete this feedback entry?")) return;
    setDeletingFeedbackId(id);
    try {
      await fetch(`${API_BASE}/api/feedback/${id}`, { method: "DELETE", headers: await authHeaders() });
      setFeedback((prev) => prev.filter((f) => f.id !== id));
    } catch {}
    setDeletingFeedbackId(null);
  };

  const startEditLink = (link: typeof links[0]) => {
    setEditingLinkId(link.id);
    setLinkForm({ title: link.title, url: link.url, icon: link.icon ?? "", sortOrder: link.sortOrder, isActive: link.isActive });
    setShowLinkForm(true);
  };

  const resetLinkForm = () => {
    setEditingLinkId(null); setShowLinkForm(false);
    setLinkForm({ title: "", url: "", icon: "", sortOrder: 0, isActive: true });
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "stats", label: "Overview", icon: <BarChart3 size={14} /> },
    { id: "links", label: "Links", icon: <Link2 size={14} /> },
    { id: "songs", label: "Songs", icon: <Music size={14} /> },
    { id: "settings", label: "Settings", icon: <Settings size={14} /> },
    { id: "feedback", label: "Feedback", icon: <MessageSquare size={14} /> },
  ];

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 size={24} className="text-cyan-400 animate-spin" />
    </div>
  );

  if (!isAdmin) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <div className="glass-card rounded-3xl p-10 max-w-sm w-full">
        <Shield size={40} className="text-red-400/60 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-blue-100 mb-2">Access Denied</h2>
        <p className="text-blue-300/60 text-sm mb-6">This area is restricted to the site owner.</p>
        <Link href="/"><button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-400/10 border border-cyan-400/20 text-cyan-300 text-sm mx-auto cursor-pointer hover:bg-cyan-400/20 transition-all"><ChevronLeft size={14} />Back to Home</button></Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen px-4 py-8 max-w-4xl mx-auto" data-testid="admin-page">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-400 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/25">
          <Shield size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-blue-100" style={{ fontFamily: "'Orbitron', sans-serif" }}>Admin Panel</h1>
          <p className="text-blue-300/50 text-sm">Welcome back, {user.firstName || "Admin"} · {email}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-6 flex-wrap glass-card rounded-2xl p-1.5">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} data-testid={`tab-${t.id}`}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all flex-1 justify-center ${tab === t.id ? "bg-cyan-400/15 border border-cyan-400/30 text-cyan-300 shadow-sm" : "text-blue-200/60 hover:text-blue-200 hover:bg-white/5"}`}>
            {t.icon}<span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Stats Tab */}
      {tab === "stats" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-blue-100">Site Overview</h2>
            <button onClick={fetchStats} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-blue-300/60 hover:text-cyan-300 hover:bg-cyan-400/10 transition-all">
              <RefreshCw size={12} className={statsLoading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
          {statsLoading && !stats ? (
            <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-cyan-400" /></div>
          ) : stats ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard label="Linktree Links" value={stats.links} icon={<Link2 size={18} />} color="#00d4ff" />
              <StatCard label="Songs" value={stats.songs} icon={<Music size={18} />} color="#a78bfa" />
              <StatCard label="Feedback" value={stats.feedback} icon={<MessageSquare size={18} />} color="#4ade80" />
              <StatCard label="AI Conversations" value={stats.conversations} icon={<Bot size={18} />} color="#f9a8d4" />
              <StatCard label="AI Messages" value={stats.messages} icon={<Users size={18} />} color="#fbbf24" />
                  <StatCard label="Visitors" value={stats.visitors ?? 0} icon={<Eye size={18} />} color="#fb923c" />
            </div>
          ) : (
            <div className="text-center py-8 text-blue-300/30 text-sm">Failed to load stats. <button onClick={fetchStats} className="text-cyan-400 hover:underline">Try again</button></div>
          )}
          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-semibold text-blue-100 mb-4 flex items-center gap-2"><Shield size={16} className="text-purple-400" /> Admin Info</h3>
            <div className="space-y-0">
              {[
                { label: "Admin Account", value: email },
                { label: "User ID", value: user.id, mono: true },
                { label: "Role", value: null },
              ].map((row, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-cyan-400/5 last:border-0">
                  <span className="text-sm text-blue-300/50">{row.label}</span>
                  {row.value !== null ? (
                    <span className={`text-sm text-blue-100 ${row.mono ? "font-mono text-xs text-blue-100/60" : "font-medium"}`}>{row.value}</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-400/15 text-purple-300 border border-purple-400/30">ADMIN</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Links Tab */}
      {tab === "links" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-blue-100">Linktree Links <span className="text-sm font-normal text-blue-300/40">({links.length})</span></h2>
            <button onClick={() => { resetLinkForm(); setShowLinkForm(true); }} data-testid="btn-add-link"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-400/10 border border-cyan-400/20 text-cyan-300 text-sm hover:bg-cyan-400/20 transition-all">
              <Plus size={14} />Add Link
            </button>
          </div>

          {showLinkForm && (
            <div className="glass-card rounded-2xl p-5" data-testid="link-form">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-cyan-300">{editingLinkId !== null ? "Edit Link" : "New Link"}</h3>
                <button onClick={resetLinkForm} className="text-blue-300/50 hover:text-blue-300 p-1 rounded-lg hover:bg-white/5 transition-all"><X size={16} /></button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                {[
                  { label: "Title *", key: "title" as keyof LinkForm, placeholder: "Discord", testid: "input-link-title" },
                  { label: "URL *", key: "url" as keyof LinkForm, placeholder: "https://discord.gg/...", testid: "input-link-url" },
                ].map((field) => (
                  <div key={field.key}>
                    <label className="text-xs text-blue-300/50 mb-1 block">{field.label}</label>
                    <input value={linkForm[field.key] as string} onChange={(e) => setLinkForm({ ...linkForm, [field.key]: e.target.value })}
                      placeholder={field.placeholder} data-testid={field.testid}
                      className="w-full bg-white/5 border border-cyan-400/20 rounded-xl px-3 py-2.5 text-sm text-blue-100 placeholder-blue-300/25 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20 transition-all" />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-blue-300/50 mb-1 block">Icon</label>
                  <select value={linkForm.icon} onChange={(e) => setLinkForm({ ...linkForm, icon: e.target.value })} data-testid="select-link-icon"
                    className="w-full bg-slate-900 border border-cyan-400/20 rounded-xl px-3 py-2.5 text-sm text-blue-100 focus:outline-none focus:border-cyan-400/50 transition-all">
                    <option value="">No icon</option>
                    {iconOptions.map((o) => <option key={o} value={o}>{o.replace("Si", "")}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-blue-300/50 mb-1 block">Sort Order</label>
                  <input type="number" value={linkForm.sortOrder} onChange={(e) => setLinkForm({ ...linkForm, sortOrder: Number(e.target.value) })} data-testid="input-link-sort"
                    className="w-full bg-white/5 border border-cyan-400/20 rounded-xl px-3 py-2.5 text-sm text-blue-100 focus:outline-none focus:border-cyan-400/50 transition-all" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <button onClick={() => setLinkForm({ ...linkForm, isActive: !linkForm.isActive })} data-testid="toggle-link-active"
                  className={`text-sm flex items-center gap-2 transition-colors ${linkForm.isActive ? "text-cyan-400" : "text-blue-300/40"}`}>
                  {linkForm.isActive ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                  {linkForm.isActive ? "Active" : "Inactive"}
                </button>
                <div className="flex gap-2">
                  <button onClick={resetLinkForm} className="px-4 py-2 rounded-xl border border-white/10 text-blue-300/60 text-sm hover:text-blue-300 transition-all">Cancel</button>
                  <button onClick={handleSaveLink} disabled={createLink.isPending || updateLink.isPending} data-testid="btn-save-link"
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-purple-500 text-white text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50">
                    {(createLink.isPending || updateLink.isPending) ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {editingLinkId !== null ? "Update" : "Create"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {linksLoading ? (
            <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-cyan-400" /></div>
          ) : (
            <div className="flex flex-col gap-2" data-testid="admin-links-list">
              {links.map((link) => (
                <div key={link.id} data-testid={`admin-link-${link.id}`}
                  className={`glass-card rounded-xl px-4 py-3.5 flex items-center gap-3 transition-all hover:border-cyan-400/25 ${!link.isActive ? "opacity-50" : ""}`}>
                  <GripVertical size={14} className="text-blue-300/20 flex-shrink-0" />
                  <span className="text-xs text-blue-300/30 w-5 text-center">{link.sortOrder}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-blue-100">{link.title}</div>
                    <div className="text-xs text-blue-300/40 truncate">{link.url}</div>
                    <div className="text-xs text-cyan-400/60 mt-0.5">👆 {(link as any).clickCount ?? 0} clicks</div>
                  </div>
                  {link.icon && <span className="text-xs text-purple-400/60 bg-purple-400/10 px-2 py-0.5 rounded-full border border-purple-400/15">{link.icon.replace("Si", "")}</span>}
                  {link.isActive ? <Eye size={13} className="text-cyan-400/40" /> : <EyeOff size={13} className="text-blue-300/20" />}
                  <div className="flex gap-1">
                    <button onClick={() => startEditLink(link)} data-testid={`btn-edit-link-${link.id}`}
                      className="p-1.5 rounded-lg text-blue-300/50 hover:text-cyan-300 hover:bg-cyan-400/10 transition-all"><Edit2 size={13} /></button>
                    <button onClick={() => handleDeleteLink(link.id)} data-testid={`btn-delete-link-${link.id}`} disabled={deleteLink.isPending}
                      className="p-1.5 rounded-lg text-blue-300/50 hover:text-red-400 hover:bg-red-400/10 transition-all"><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
              {links.length === 0 && <div className="text-center py-10 text-blue-300/30 text-sm glass-card rounded-2xl">No links yet. Add your first link!</div>}
            </div>
          )}
        </div>
      )}

      {/* Songs Tab */}
      {tab === "songs" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-blue-100">Music Playlist <span className="text-sm font-normal text-blue-300/40">({songs.length} songs)</span></h2>
            <button onClick={() => { resetSongForm(); setShowSongForm(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-400/10 border border-purple-400/20 text-purple-300 text-sm hover:bg-purple-400/20 transition-all">
              <Plus size={14} />Add Song
            </button>
          </div>

          {showSongForm && (
            <div className="glass-card rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-purple-300">{editingSongId !== null ? "Edit Song" : "Add New Song"}</h3>
                <button onClick={resetSongForm} className="text-blue-300/50 hover:text-blue-300 p-1 rounded-lg hover:bg-white/5 transition-all"><X size={16} /></button>
              </div>
              <div className="space-y-1 mb-3 text-xs text-blue-300/40">
                💡 Paste any direct audio URL, YouTube URL (for display only), or Spotify track link
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                {[
                  { label: "Song Title *", key: "title" as keyof SongForm, placeholder: "Neon Ocean (feat. Wave)" },
                  { label: "Artist *", key: "artist" as keyof SongForm, placeholder: "Zhuu & DeepBeats" },
                  { label: "Audio URL *", key: "url" as keyof SongForm, placeholder: "https://... (MP3, YouTube, Spotify)" },
                  { label: "Cover Image URL", key: "coverUrl" as keyof SongForm, placeholder: "https://... (optional)" },
                ].map((field) => (
                  <div key={field.key} className={field.key === "url" ? "sm:col-span-2" : ""}>
                    <label className="text-xs text-blue-300/50 mb-1 block">{field.label}</label>
                    <input value={songForm[field.key] as string} onChange={(e) => setSongForm({ ...songForm, [field.key]: e.target.value })}
                      placeholder={field.placeholder}
                      className="w-full bg-white/5 border border-purple-400/20 rounded-xl px-3 py-2.5 text-sm text-blue-100 placeholder-blue-300/25 focus:outline-none focus:border-purple-400/50 focus:ring-1 focus:ring-purple-400/20 transition-all" />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-blue-300/50 mb-1 block">Sort Order</label>
                  <input type="number" value={songForm.sortOrder} onChange={(e) => setSongForm({ ...songForm, sortOrder: Number(e.target.value) })}
                    className="w-full bg-white/5 border border-purple-400/20 rounded-xl px-3 py-2.5 text-sm text-blue-100 focus:outline-none focus:border-purple-400/50 transition-all" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={resetSongForm} className="px-4 py-2 rounded-xl border border-white/10 text-blue-300/60 text-sm hover:text-blue-300 transition-all">Cancel</button>
                <button onClick={handleSaveSong} disabled={songSaving || !songForm.title || !songForm.artist || !songForm.url}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50">
                  {songSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {editingSongId !== null ? "Update Song" : "Add Song"}
                </button>
              </div>
            </div>
          )}

          {songsLoading ? (
            <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-cyan-400" /></div>
          ) : (
            <div className="flex flex-col gap-2" data-testid="admin-songs-list">
              {songs.map((song, i) => (
                <div key={song.id} data-testid={`admin-song-${song.id}`}
                  className="glass-card rounded-xl px-4 py-3.5 flex items-center gap-3 hover:border-purple-400/25 transition-all">
                  {song.coverUrl ? (
                    <img src={song.coverUrl} alt={song.title} className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-purple-400/20" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-400/20 flex items-center justify-center flex-shrink-0">
                      <Music size={16} className="text-purple-400/60" />
                    </div>
                  )}
                  <span className="text-xs text-blue-300/30 w-5 text-center flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-blue-100 truncate">{song.title}</div>
                    <div className="text-xs text-blue-300/40 truncate">{song.artist}</div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => startEditSong(song)}
                      className="p-1.5 rounded-lg text-blue-300/50 hover:text-purple-300 hover:bg-purple-400/10 transition-all"><Edit2 size={13} /></button>
                    <button onClick={() => handleDeleteSong(song.id)} disabled={deletingSongId === song.id}
                      className="p-1.5 rounded-lg text-blue-300/50 hover:text-red-400 hover:bg-red-400/10 transition-all">
                      {deletingSongId === song.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </div>
                </div>
              ))}
              {songs.length === 0 && (
                <div className="text-center py-10 text-blue-300/30 text-sm glass-card rounded-2xl">
                  No songs yet. Add your first track!
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {tab === "settings" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-blue-100">Site Settings</h2>
            <button onClick={saveSettings} disabled={settingsSaving}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${settingsSaved ? "bg-green-400/15 border border-green-400/30 text-green-300" : "bg-cyan-400/10 border border-cyan-400/20 text-cyan-300 hover:bg-cyan-400/20"}`}>
              {settingsSaving ? <Loader2 size={14} className="animate-spin" /> : settingsSaved ? <CheckCircle2 size={14} /> : <Save size={14} />}
              {settingsSaved ? "Saved!" : "Save All"}
            </button>
          </div>

          {settingsLoading ? (
            <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-cyan-400" /></div>
          ) : (
            <div className="space-y-4">
              {/* Profile section */}
              <div className="glass-card rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-semibold text-cyan-300 flex items-center gap-2"><Star size={14} />Profile & Identity</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: "Display Name", key: "profileName" as keyof SiteSettings, placeholder: "Zhuu" },
                    { label: "Status Text", key: "statusText" as keyof SiteSettings, placeholder: "Active — Deep ocean online" },
                  ].map((field) => (
                    <div key={field.key}>
                      <label className="text-xs text-blue-300/50 mb-1 block">{field.label}</label>
                      <input value={settings[field.key] ?? ""} onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })}
                        placeholder={field.placeholder}
                        className="w-full bg-white/5 border border-cyan-400/20 rounded-xl px-3 py-2.5 text-sm text-blue-100 placeholder-blue-300/25 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20 transition-all" />
                    </div>
                  ))}
                  <div className="sm:col-span-2">
                    <label className="text-xs text-blue-300/50 mb-1 block">Bio / Tagline</label>
                    <input value={settings.profileBio ?? ""} onChange={(e) => setSettings({ ...settings, profileBio: e.target.value })}
                      placeholder="Creator · Gamer · Builder"
                      className="w-full bg-white/5 border border-cyan-400/20 rounded-xl px-3 py-2.5 text-sm text-blue-100 placeholder-blue-300/25 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20 transition-all" />
                  </div>
                </div>
              </div>

              {/* Linktree visuals */}
              <div className="glass-card rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-semibold text-purple-300 flex items-center gap-2"><ImageIcon size={14} />Linktree Visuals</h3>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="text-xs text-blue-300/50 mb-1 block">Logo / Profile Picture URL</label>
                    <div className="flex gap-2">
                      <input value={settings.logoUrl ?? ""} onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
                        placeholder="https://... (PNG, JPG, WEBP, SVG, GIF)"
                        className="flex-1 bg-white/5 border border-purple-400/20 rounded-xl px-3 py-2.5 text-sm text-blue-100 placeholder-blue-300/25 focus:outline-none focus:border-purple-400/50 focus:ring-1 focus:ring-purple-400/20 transition-all" />
                      {settings.logoUrl && (
                        <img src={settings.logoUrl} alt="Logo preview" className="w-10 h-10 rounded-full object-cover border border-purple-400/30 flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      )}
                    </div>
                    <p className="text-xs text-blue-300/30 mt-1">Supports PNG, JPG, WEBP, SVG, GIF with transparency</p>
                  </div>
                  <div>
                    <label className="text-xs text-blue-300/50 mb-1 block">Banner / Background Image URL</label>
                    <input value={settings.bannerUrl ?? ""} onChange={(e) => setSettings({ ...settings, bannerUrl: e.target.value })}
                      placeholder="https://... (optional background image)"
                      className="w-full bg-white/5 border border-purple-400/20 rounded-xl px-3 py-2.5 text-sm text-blue-100 placeholder-blue-300/25 focus:outline-none focus:border-purple-400/50 focus:ring-1 focus:ring-purple-400/20 transition-all" />
                  </div>
                </div>
              </div>

              {/* Theme */}
              <div className="glass-card rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-semibold text-pink-300 flex items-center gap-2"><Palette size={14} />Theme Accent Color</h3>
                <div className="flex items-center gap-3">
                  <input type="color" value={settings.themeColor ?? "#00d4ff"} onChange={(e) => setSettings({ ...settings, themeColor: e.target.value })}
                    className="w-12 h-10 rounded-lg cursor-pointer border border-white/10 bg-transparent" />
                  <input value={settings.themeColor ?? "#00d4ff"} onChange={(e) => setSettings({ ...settings, themeColor: e.target.value })}
                    placeholder="#00d4ff"
                    className="flex-1 bg-white/5 border border-pink-400/20 rounded-xl px-3 py-2.5 text-sm text-blue-100 placeholder-blue-300/25 focus:outline-none focus:border-pink-400/50 transition-all font-mono" />
                  <div className="w-10 h-10 rounded-lg border border-white/10 flex-shrink-0" style={{ background: settings.themeColor ?? "#00d4ff", opacity: 0.8 }} />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {["#00d4ff", "#a78bfa", "#4ade80", "#f9a8d4", "#fbbf24", "#f87171"].map((c) => (
                    <button key={c} onClick={() => setSettings({ ...settings, themeColor: c })}
                      className="w-7 h-7 rounded-full border-2 transition-all hover:scale-110"
                      style={{ background: c, borderColor: settings.themeColor === c ? "white" : "transparent" }} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Feedback Tab */}
      {tab === "feedback" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-blue-100">User Feedback <span className="text-sm font-normal text-blue-300/40">({feedback.length})</span></h2>
            <button onClick={fetchFeedback} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-blue-300/60 hover:text-cyan-300 hover:bg-cyan-400/10 transition-all">
              <RefreshCw size={12} className={feedbackLoading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
          {feedbackLoading ? (
            <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-cyan-400" /></div>
          ) : feedback.length === 0 ? (
            <div className="text-center py-12 text-blue-300/30 text-sm glass-card rounded-2xl">No feedback received yet.</div>
          ) : (
            <div className="flex flex-col gap-3">
              {feedback.map((item) => (
                <div key={item.id} className="glass-card rounded-2xl p-4 hover:border-cyan-400/20 transition-all">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.category && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                          style={{ background: `${CATEGORY_COLORS[item.category] ?? "#94a3b8"}20`, color: CATEGORY_COLORS[item.category] ?? "#94a3b8", border: `1px solid ${CATEGORY_COLORS[item.category] ?? "#94a3b8"}40` }}>
                          {item.category}
                        </span>
                      )}
                      {typeof item.rating === "number" && <span className="text-base">{RATING_EMOJIS[item.rating]}</span>}
                      {item.name && <span className="text-xs text-blue-100/70 font-medium">{item.name}</span>}
                      {item.email && <span className="text-xs text-blue-300/40">{item.email}</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-blue-300/30">{new Date(item.createdAt).toLocaleDateString()}</span>
                      <button onClick={() => handleDeleteFeedback(item.id)} disabled={deletingFeedbackId === item.id}
                        className="p-1.5 rounded-lg text-blue-300/30 hover:text-red-400 hover:bg-red-400/10 transition-all">
                        {deletingFeedbackId === item.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-blue-200/75">{item.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
