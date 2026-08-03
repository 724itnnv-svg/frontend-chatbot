const DEVICE_ID_KEY = "nnvDeviceId";
const LEGACY_DEVICE_ID_KEY = "_did";

export function getDeviceId() {
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;

  const legacy = localStorage.getItem(LEGACY_DEVICE_ID_KEY);
  if (legacy) {
    localStorage.setItem(DEVICE_ID_KEY, legacy);
    localStorage.removeItem(LEGACY_DEVICE_ID_KEY);
    return legacy;
  }

  const next = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(DEVICE_ID_KEY, next);
  return next;
}

export function getDeviceInfo() {
  return {
    deviceId: getDeviceId(),
    deviceName: navigator.userAgent || "",
    platform: navigator.platform || "",
  };
}
