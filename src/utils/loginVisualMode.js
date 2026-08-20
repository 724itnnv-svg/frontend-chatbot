export const LOGIN_VISUAL_MODE_KEY = "loginVisualMode";

export const LOGIN_VISUAL_MODE_OPTIONS = [
  { value: "legacy", label: "Noel" },
  { value: "seasonal", label: "Bốn mùa tự động" },
  { value: "weather", label: "Thời tiết hiện tại" },
];

const LOGIN_VISUAL_MODES = new Set(
  LOGIN_VISUAL_MODE_OPTIONS.map((option) => option.value),
);

function normalizeLoginVisualMode(mode) {
  return LOGIN_VISUAL_MODES.has(mode) ? mode : null;
}

export function getLoginVisualMode() {
  try {
    const savedMode = localStorage.getItem(LOGIN_VISUAL_MODE_KEY);
    return LOGIN_VISUAL_MODES.has(savedMode) ? savedMode : "legacy";
  } catch {
    return "legacy";
  }
}

export function setLoginVisualMode(mode) {
  if (!normalizeLoginVisualMode(mode)) return false;

  try {
    localStorage.setItem(LOGIN_VISUAL_MODE_KEY, mode);
    return true;
  } catch {
    return false;
  }
}

export async function fetchLoginVisualMode() {
  const response = await fetch("/api/public/settings/login-theme", {
    credentials: "same-origin",
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  const mode = normalizeLoginVisualMode(data?.mode);
  if (!response.ok || !mode) {
    throw new Error(data?.message || "Không thể tải giao diện đăng nhập.");
  }

  setLoginVisualMode(mode);
  return mode;
}

export async function updateGlobalLoginVisualMode(mode) {
  const normalizedMode = normalizeLoginVisualMode(mode);
  if (!normalizedMode) throw new Error("Giao diện đăng nhập không hợp lệ.");

  const response = await fetch("/api/admin-dashboard/login-theme", {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: normalizedMode }),
  });
  const data = await response.json().catch(() => ({}));
  const savedMode = normalizeLoginVisualMode(data?.mode);
  if (!response.ok || !savedMode) {
    throw new Error(data?.message || "Không thể cập nhật giao diện đăng nhập.");
  }

  setLoginVisualMode(savedMode);
  return savedMode;
}
