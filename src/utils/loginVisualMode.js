export const LOGIN_VISUAL_MODE_KEY = "loginVisualMode";

export const LOGIN_VISUAL_MODE_OPTIONS = [
  { value: "legacy", label: "Noel" },
  { value: "seasonal", label: "Bốn mùa tự động" },
  { value: "weather", label: "Thời tiết hiện tại" },
];

const LOGIN_VISUAL_MODES = new Set(
  LOGIN_VISUAL_MODE_OPTIONS.map((option) => option.value),
);

export function getLoginVisualMode() {
  try {
    const savedMode = localStorage.getItem(LOGIN_VISUAL_MODE_KEY);
    return LOGIN_VISUAL_MODES.has(savedMode) ? savedMode : "legacy";
  } catch {
    return "legacy";
  }
}

export function setLoginVisualMode(mode) {
  if (!LOGIN_VISUAL_MODES.has(mode)) return false;

  try {
    localStorage.setItem(LOGIN_VISUAL_MODE_KEY, mode);
    return true;
  } catch {
    return false;
  }
}
