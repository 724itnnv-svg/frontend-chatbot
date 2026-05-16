export function hasFullAccess(user) {
  return Number(user?.allpage) === 1;
}

export function getAllowedScreens(user) {
  return Array.isArray(user?.screen) ? user.screen : [];
}

export function canAccessScreen(user, screenId) {
  if (!screenId) return false;
  if (screenId === "profile") return Boolean(user);
  return getAllowedScreens(user).includes(screenId);
}
