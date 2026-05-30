import APP_PERMISSIONS from "../components/role/configRole";

export function hasFullAccess(user) {
  const allowedScreens = getAllowedScreens(user);
  return APP_PERMISSIONS.screens.every((screen) => allowedScreens.includes(screen.id));
}

export function getAllowedScreens(user) {
  return Array.isArray(user?.screen) ? user.screen : [];
}

export function canAccessScreen(user, screenId) {
  if (!screenId) return false;
  if (screenId === "profile") return Boolean(user);
  if (hasFullAccess(user)) return true;
  return getAllowedScreens(user).includes(screenId);
}
