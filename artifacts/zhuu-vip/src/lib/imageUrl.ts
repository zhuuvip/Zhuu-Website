const API_BASE = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "https://zhuuapi.vercel.app"
).replace(/\/$/, "");

const PRIVATE_FOLDERS = new Set([
  "products",
  "songs",
  "banner",
  "promotions",
  "free",
]);

export function getImageUrl(value?: string | null): string {
  if (!value) return "";

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  const folder = value.split("/")[0];

  if (!PRIVATE_FOLDERS.has(folder)) {
    return value;
  }

  return `${API_BASE}/api/private-image?pathname=${encodeURIComponent(value)}`;
}
