import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { setupServerPushNotifications } from "./serverPushNotifications";

function hasLocationPermission(permission) {
  return permission?.location === "granted" || permission?.coarseLocation === "granted";
}

async function requestNativeLocationPermission() {
  if (!Capacitor.isNativePlatform()) return;

  const current = await Geolocation.checkPermissions();
  if (hasLocationPermission(current)) return;

  await Geolocation.requestPermissions({ permissions: ["location"] });
}

export async function requestStartupNativePermissions() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await setupServerPushNotifications();
  } catch (err) {
    console.warn("Khong the xin quyen thong bao khi khoi dong app:", err);
  }

  try {
    await requestNativeLocationPermission();
  } catch (err) {
    console.warn("Khong the xin quyen vi tri khi khoi dong app:", err);
  }
}
