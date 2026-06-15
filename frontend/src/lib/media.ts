const API_ORIGIN = "http://localhost:3000";

export const resolveMediaUrl = (value?: string | null) => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `${API_ORIGIN}${value.startsWith("/") ? "" : "/"}${value}`;
};

export const isVideoMediaUrl = (value?: string | null) => {
  if (!value) return false;
  const path = value.split(/[?#]/, 1)[0].toLowerCase();
  return path.endsWith(".mp4");
};
