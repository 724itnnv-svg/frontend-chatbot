import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { apiUrl } from "../api/baseUrl.js";
import { getDeviceId } from "./deviceIdentity.js";

const PUSH_CHANNEL_ID = "server_push_high";
const PUSH_TOKEN_KEY = "nnvPushToken";
let listenersReady = false;

function notificationRoute(notification) {
  return notification?.data?.route || notification?.notification?.data?.route || "/cham-cong";
}

function openNotificationRoute(notification) {
  const route = notificationRoute(notification);
  if (route) window.location.assign(route);
}

async function createPushChannels() {
  const channel = {
    id: PUSH_CHANNEL_ID,
    name: "Thong bao tu server",
    description: "Thong bao quan trong tu he thong NNV",
    importance: 5,
    visibility: 1,
    vibration: true,
    lights: true,
    lightColor: "#16A34A",
  };

  await PushNotifications.createChannel(channel);
}

async function sendDeviceTokenToServer(fcmToken) {
  const authToken = localStorage.getItem("token");
  if (!authToken || !fcmToken) return;

  const res = await fetch(apiUrl("/api/notifications/device-token"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
      "ngrok-skip-browser-warning": "true",
    },
    body: JSON.stringify({
      token: fcmToken,
      platform: Capacitor.getPlatform(),
      deviceId: getDeviceId(),
      appId: "com.nnv.chamcongvip",
    }),
  });

  if (!res.ok) {
    throw new Error(`Register push token failed: ${res.status}`);
  }
}

async function persistAndSyncToken(fcmToken) {
  if (!fcmToken) return;
  localStorage.setItem(PUSH_TOKEN_KEY, fcmToken);
  await sendDeviceTokenToServer(fcmToken);
}

export async function setupServerPushNotifications() {
  if (!Capacitor.isNativePlatform()) return;

  await createPushChannels();

  if (!listenersReady) {
    listenersReady = true;

    PushNotifications.addListener("registration", (token) => {
      persistAndSyncToken(token.value).catch((err) => {
        console.warn("Khong the dang ky FCM token:", err);
      });
    });

    PushNotifications.addListener("registrationError", (err) => {
      console.warn("Dang ky push notification loi:", err);
    });

    PushNotifications.addListener("pushNotificationActionPerformed", (event) => {
      openNotificationRoute(event.notification);
    });
  }

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== "granted") return;

  const cachedToken = localStorage.getItem(PUSH_TOKEN_KEY);
  if (cachedToken) {
    sendDeviceTokenToServer(cachedToken).catch((err) => {
      console.warn("Khong the dong bo lai FCM token:", err);
    });
  }

  await PushNotifications.register();
}

export { PUSH_CHANNEL_ID };
