function trimTrailingSlash(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

export function getApiOrigin() {
  const envOrigin = getConfiguredApiOrigin();
  if (envOrigin) return envOrigin;

  if (typeof window !== "undefined" && window.location?.origin) {
    return trimTrailingSlash(window.location.origin);
  }

  return "";
}

export function getConfiguredApiOrigin() {
  if (import.meta.env.PROD) {
    return "https://chatbot-zhpy.onrender.com";
  }
  return trimTrailingSlash(import.meta.env.VITE_API_URL);
}

export function getApiBaseUrl() {
  const origin = getApiOrigin();
  if (!origin) return "/api";
  if (origin.endsWith("/api")) return origin;
  return `${origin}/api`;
}

export function apiUrl(path = "") {
  const normalizedPath = String(path || "");
  if (/^https?:\/\//i.test(normalizedPath)) return normalizedPath;
  return `${getApiOrigin()}${normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`}`;
}
