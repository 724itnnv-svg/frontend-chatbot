import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

const ATTENDANCE_CHANNEL_ID = "attendance_reminders";
const ATTENDANCE_ROUTE = "/cham-cong";
const WORKDAYS = [2, 3, 4, 5, 6, 7];
const ATTENDANCE_REMINDERS = [
  {
    key: 25,
    hour: 7,
    minute: 25,
    title: "Nhac cham cong",
    body: "Da 7h25 sang, dung quen cham cong vao ca.",
  },
  {
    key: 130,
    hour: 11,
    minute: 30,
    title: "Nhac cham cong",
    body: "Da 11h30, dung quen cham cong ket thuc buoi sang.",
  },
  {
    key: 255,
    hour: 12,
    minute: 55,
    title: "Nhac cham cong",
    body: "Da 12h55, dung quen cham cong vao buoi chieu.",
  },
  {
    key: 700,
    hour: 17,
    minute: 0,
    title: "Nhac cham cong",
    body: "Da 17h, dung quen cham cong ra ve.",
  },
];
const LEGACY_REMINDER_IDS = [7025, 7130, 7255, 7700];

function reminderId(reminder, weekday) {
  return 700000 + weekday * 1000 + reminder.key;
}

function reminderDescriptors() {
  return [
    ...LEGACY_REMINDER_IDS,
    ...ATTENDANCE_REMINDERS.flatMap((reminder) => WORKDAYS.map((weekday) => reminderId(reminder, weekday))),
  ].map((id) => ({ id }));
}

async function ensureNotificationPermission() {
  const current = await LocalNotifications.checkPermissions();
  if (current.display === "granted") return true;

  const requested = await LocalNotifications.requestPermissions();
  return requested.display === "granted";
}

async function ensureAttendanceChannel() {
  await LocalNotifications.createChannel({
    id: ATTENDANCE_CHANNEL_ID,
    name: "Nhac cham cong",
    description: "Thong bao nhac vao/ra ca cham cong",
    importance: 4,
    visibility: 1,
    vibration: true,
    lights: true,
    lightColor: "#16A34A",
  });
}

export function setupAttendanceReminderNotifications() {
  if (!Capacitor.isNativePlatform()) return;

  LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
    const route = event?.notification?.extra?.route;
    if (route) window.location.assign(route);
  }).catch((err) => {
    console.warn("Khong the lang nghe thong bao cham cong:", err);
  });
}

export async function scheduleAttendanceReminder() {
  if (!Capacitor.isNativePlatform()) return;

  const granted = await ensureNotificationPermission();
  if (!granted) return;

  await ensureAttendanceChannel();

  try {
    await LocalNotifications.checkExactNotificationSetting();
  } catch {
    // Exact alarms are Android-only; keep scheduling with normal alarms elsewhere.
  }

  await LocalNotifications.cancel({ notifications: reminderDescriptors() });

  await LocalNotifications.schedule({
    notifications: ATTENDANCE_REMINDERS.flatMap((reminder) =>
      WORKDAYS.map((weekday) => ({
        id: reminderId(reminder, weekday),
        title: reminder.title,
        body: reminder.body,
        channelId: ATTENDANCE_CHANNEL_ID,
        autoCancel: true,
        extra: { route: ATTENDANCE_ROUTE, type: "attendance-reminder" },
        schedule: {
          on: {
            weekday,
            hour: reminder.hour,
            minute: reminder.minute,
          },
          repeats: true,
          allowWhileIdle: true,
        },
      }))
    ),
  });
}
