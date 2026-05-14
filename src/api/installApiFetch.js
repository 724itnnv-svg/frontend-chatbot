import { apiUrl, getConfiguredApiOrigin } from "./baseUrl";

const API_PATH_PREFIXES = ["/api", "/chatweb", "/chatwebpopup"];
const EXTRA_API_HEADERS = {
  "ngrok-skip-browser-warning": "true",
};

function shouldRewrite(url) {
  return API_PATH_PREFIXES.some((prefix) => url === prefix || url.startsWith(`${prefix}/`) || url.startsWith(`${prefix}?`));
}

function mergeApiHeaders(headers) {
  const merged = new Headers(headers || {});
  for (const [key, value] of Object.entries(EXTRA_API_HEADERS)) {
    if (!merged.has(key)) merged.set(key, value);
  }
  return merged;
}

export function installApiFetch() {
  if (typeof window === "undefined" || typeof window.fetch !== "function") return;
  if (!getConfiguredApiOrigin()) return;
  if (window.__apiFetchInstalled) return;

  const originalFetch = window.fetch.bind(window);
  window.__apiFetchInstalled = true;

  window.fetch = (input, init = {}) => {
    if (typeof input === "string" && shouldRewrite(input)) {
      return originalFetch(apiUrl(input), {
        ...init,
        headers: mergeApiHeaders(init.headers),
      });
    }

    return originalFetch(input, init);
  };
}
